import { segments } from './segments';
import type { TextMotionUnit } from './segments';

type TextMotionHandoff = 'crossfade' | 'clear';

/** The renderer owns layout coordinates, never positions read from moving DOM. */
interface Slot {
  text: string;
  x: number;
}

interface Appearance {
  y: number;
  scale: number;
  rotate: number;
  blur: number;
  opacity: number;
}

interface Track<T> {
  from: T;
  to: T;
  start: number;
  duration: number;
  linearOpacity?: boolean;
}

interface Glyph {
  id: number;
  text: string;
  index: number;
  value: string;
  leaving: boolean;
  position: Track<number>;
  appearance: Track<Appearance>;
}

interface GlyphFrame extends Appearance {
  id: number;
  text: string;
  x: number;
  leaving: boolean;
}

const rest: Appearance = { y: 0, scale: 1, rotate: 0, blur: 0, opacity: 1 };
const arrival: Appearance = {
  y: 0.35,
  scale: 0.6,
  rotate: 2,
  blur: 0.1,
  opacity: 0,
};
const departure: Appearance = { ...arrival, y: -0.35 };
const wordArrival: Appearance = {
  y: 0,
  scale: 0.94,
  rotate: 0,
  blur: 0.08,
  opacity: 0,
};
// Shared-text motion retains the same glyphs and spacing as the approved
// renderer. Changed letters share one clock on the baseline. A small scale
// change softens the replacement without the vertical roll or letter stagger.
const runArrival: Appearance = { ...rest, scale: 0.9, opacity: 0 };

function characters(value: string): string[] {
  return segments(value);
}

/** Keep meaningful, ordered edges. Do not hunt for stray letters in new words. */
function sharedCharacters(
  before: string[],
  after: string[],
): Map<number, number> {
  const result = new Map<number, number>();
  let prefix = 0;
  while (
    prefix < Math.min(before.length, after.length) &&
    before[prefix] === after[prefix]
  ) {
    result.set(prefix, prefix);
    prefix++;
  }
  let oldEnd = before.length - 1;
  let newEnd = after.length - 1;
  while (
    oldEnd >= prefix &&
    newEnd >= prefix &&
    before[oldEnd] === after[newEnd]
  ) {
    result.set(newEnd--, oldEnd--);
  }
  return result;
}

/** Ordered shared letters, including the interior of Craft -> Creative.
 * Bounded to labels: long prose falls back to the linear edge matcher. */
function sharedRun(before: string[], after: string[]): Map<number, number> {
  if (before.length * after.length > 65_536)
    return sharedCharacters(before, after);
  const columns = after.length + 1;
  const lengths = new Uint32Array((before.length + 1) * columns);
  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      lengths[i * columns + j] =
        before[i] === after[j]
          ? 1 + lengths[(i + 1) * columns + j + 1]
          : Math.max(
              lengths[(i + 1) * columns + j],
              lengths[i * columns + j + 1],
            );
  const result = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) result.set(j++, i++);
    else if (lengths[(i + 1) * columns + j] > lengths[i * columns + j + 1]) i++;
    else j++;
  }
  return result;
}

/** Solve the existing visual reference's cubic-bezier(.22, 1, .36, 1). */
function ease(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let t = progress;
  for (let i = 0; i < 7; i++) {
    const x = ((0.58 * t - 0.24) * t + 0.66) * t;
    const slope = (1.74 * t - 0.48) * t + 0.66;
    t = Math.max(0, Math.min(1, t - (x - progress) / slope));
  }
  return 1 - (1 - t) ** 3;
}

const progress = <T>(track: Track<T>, now: number) =>
  track.duration ? ease((now - track.start) / track.duration) : 1;
const finished = <T>(track: Track<T>, now: number) =>
  !track.duration || now >= track.start + track.duration;
const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;
const positionAt = (track: Track<number>, now: number) =>
  mix(track.from, track.to, progress(track, now));
const appearanceAt = (track: Track<Appearance>, now: number): Appearance => {
  const p = progress(track, now);
  const opacityProgress =
    track.linearOpacity && track.duration
      ? Math.max(0, Math.min(1, (now - track.start) / track.duration))
      : p;
  return {
    y: mix(track.from.y, track.to.y, p),
    scale: mix(track.from.scale, track.to.scale, p),
    rotate: mix(track.from.rotate, track.to.rotate, p),
    blur: mix(track.from.blur, track.to.blur, p),
    opacity: mix(track.from.opacity, track.to.opacity, opacityProgress),
  };
};
const fixed = <T>(value: T): Track<T> => ({
  from: value,
  to: value,
  start: 0,
  duration: 0,
});

class TextMotionModel {
  private nextId = 0;
  private glyphs = new Map<number, Glyph>();
  private order: number[] = [];
  private width: Track<number>;
  private value: string;

  constructor(
    value: string,
    slots: Slot[],
    width: number,
    private readonly by: TextMotionUnit = 'character',
  ) {
    this.value = value;
    this.width = fixed(width);
    for (const [index, slot] of slots.entries()) {
      const id = this.nextId++;
      this.glyphs.set(id, {
        id,
        text: slot.text,
        index,
        value,
        leaving: false,
        position: fixed(slot.x),
        appearance: fixed(rest),
      });
      this.order.push(id);
    }
  }

  update(
    value: string,
    slots: Slot[],
    width: number,
    originShift: number,
    now: number,
    duration = 200,
    direction: 1 | -1 = 1,
    handoff: TextMotionHandoff = 'crossfade',
  ) {
    const enterPose =
      this.by === 'run'
        ? runArrival
        : this.by === 'word'
          ? wordArrival
          : arrival;
    const leavePose =
      this.by === 'run'
        ? runArrival
        : this.by === 'word'
          ? { ...wordArrival, y: -wordArrival.y }
          : departure;
    const stagger = this.by === 'character' ? 0.3 : 0;
    const enter = {
      ...enterPose,
      y: enterPose.y * direction,
      rotate: enterPose.rotate * direction,
    };
    const leave = {
      ...leavePose,
      y: leavePose.y * direction,
      rotate: leavePose.rotate * direction,
    };
    const previous = this.order.map((id) => this.glyphs.get(id)!);
    const keep = (this.by === 'run' ? sharedRun : sharedCharacters)(
      previous.map((g) => g.text),
      slots.map((s) => s.text),
    );
    const used = new Set<number>();
    const order: number[] = [];
    const fresh: Glyph[] = [];
    const incoming = slots.length - keep.size;
    let entered = 0;

    for (const [index, slot] of slots.entries()) {
      const oldIndex = keep.get(index);
      let glyph = oldIndex === undefined ? undefined : previous[oldIndex];
      if (!glyph) {
        // Returning during an exit reuses that exact label's still-visible ink.
        // It never assigns a random repeated letter from an unrelated word.
        glyph = [...this.glyphs.values()].find(
          (g) =>
            g.leaving &&
            g.value === value &&
            g.index === index &&
            g.text === slot.text &&
            !used.has(g.id) &&
            appearanceAt(g.appearance, now).opacity > 0.001,
        );
      }
      if (glyph) {
        const x = positionAt(glyph.position, now);
        glyph.position = { from: x, to: slot.x, start: now, duration };
        if (glyph.leaving) {
          glyph.appearance = {
            from: appearanceAt(glyph.appearance, now),
            to: rest,
            start: now,
            duration,
          };
        }
        // A shared, still-arriving glyph keeps its appearance clock unchanged.
        glyph.leaving = false;
        glyph.index = index;
        glyph.value = value;
      } else {
        const id = this.nextId++;
        const delay = incoming
          ? (duration * stagger * entered++) / incoming
          : 0;
        glyph = {
          id,
          text: slot.text,
          index,
          value,
          leaving: false,
          position: {
            from: slot.x + originShift,
            to: slot.x,
            start: now,
            duration,
          },
          appearance: {
            from: enter,
            to: rest,
            start: now + delay,
            duration,
            linearOpacity: this.by === 'run',
          },
        };
        this.glyphs.set(id, glyph);
        fresh.push(glyph);
      }
      used.add(glyph.id);
      order.push(glyph.id);
    }

    const departing = previous.filter((g) => !used.has(g.id));
    for (const glyph of this.glyphs.values()) {
      if (used.has(glyph.id)) continue;
      const x = positionAt(glyph.position, now);
      glyph.position = { from: x, to: x - originShift, start: now, duration };
      if (!glyph.leaving) {
        const index = departing.indexOf(glyph);
        glyph.appearance = {
          from: appearanceAt(glyph.appearance, now),
          to: leave,
          start:
            now +
            (duration *
              (handoff === 'clear' ? 0 : stagger) *
              Math.max(0, index)) /
              Math.max(1, departing.length),
          duration: handoff === 'clear' ? duration * 0.4 : duration,
          linearOpacity: handoff === 'clear' || this.by === 'run',
        };
        glyph.leaving = true;
      } else if (
        handoff === 'clear' &&
        glyph.appearance.start + glyph.appearance.duration >
          now + duration * 0.4
      ) {
        // A mode change or interruption never prolongs an earlier exit.
        glyph.appearance = {
          from: appearanceAt(glyph.appearance, now),
          to: leave,
          start: now,
          duration: duration * 0.4,
          linearOpacity: true,
        };
      }
    }
    if (handoff === 'clear') {
      let clearAt = now;
      for (const glyph of this.glyphs.values()) {
        if (
          glyph.leaving &&
          appearanceAt(glyph.appearance, now).opacity > 0.001
        )
          clearAt = Math.max(
            clearAt,
            glyph.appearance.start + glyph.appearance.duration,
          );
      }
      const enterDuration = Math.max(0, duration - (clearAt - now));
      fresh.forEach((glyph, index) => {
        glyph.appearance.start =
          clearAt + (enterDuration * stagger * index) / fresh.length;
        glyph.appearance.duration = enterDuration;
        glyph.appearance.linearOpacity = true;
      });
    } else if (this.by === 'word') {
      // Whole words need less overlap than isolated glyphs. Start making room
      // immediately, then reveal the replacement as the old ink softens away.
      // No blank hold, vertical roll, or independent per-letter motion.
      let hasExit = false;
      for (const glyph of this.glyphs.values()) {
        if (!glyph.leaving) continue;
        const from = appearanceAt(glyph.appearance, now);
        hasExit ||= from.opacity > 0.001;
        const remaining =
          glyph.appearance.start + glyph.appearance.duration - now;
        glyph.appearance = {
          from,
          to: leave,
          start: now,
          duration: Math.max(0, Math.min(remaining, duration * 0.38)),
          linearOpacity: true,
        };
      }
      for (const glyph of fresh) {
        glyph.appearance.start = now + (hasExit ? duration * 0.25 : 0);
        glyph.appearance.duration = duration * (hasExit ? 0.75 : 1);
        glyph.appearance.linearOpacity = true;
      }
    }
    this.width = {
      from: positionAt(this.width, now),
      to: width,
      start: now,
      duration,
    };
    this.order = order;
    this.value = value;
    if (!duration) this.settle();
  }

  settle() {
    this.width = fixed(this.width.to);
    for (const glyph of this.glyphs.values()) {
      if (glyph.leaving) this.glyphs.delete(glyph.id);
      else {
        glyph.position = fixed(glyph.position.to);
        glyph.appearance = fixed(rest);
      }
    }
  }

  sample(now: number): {
    width: number;
    glyphs: GlyphFrame[];
    moving: boolean;
    value: string;
  } {
    const frames: GlyphFrame[] = [];
    let moving = !finished(this.width, now);
    for (const glyph of this.glyphs.values()) {
      if (glyph.leaving && finished(glyph.appearance, now)) {
        this.glyphs.delete(glyph.id);
        continue;
      }
      moving ||=
        !finished(glyph.position, now) || !finished(glyph.appearance, now);
      frames.push({
        id: glyph.id,
        text: glyph.text,
        leaving: glyph.leaving,
        x: positionAt(glyph.position, now),
        ...appearanceAt(glyph.appearance, now),
      });
    }
    return {
      width: positionAt(this.width, now),
      glyphs: frames,
      moving,
      value: this.value,
    };
  }
}

export { TextMotionModel, characters, sharedCharacters, ease };
export type { Slot, GlyphFrame, TextMotionHandoff };
