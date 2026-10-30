import { TextMotionModel } from './model';
import type { GlyphFrame, Slot, TextMotionHandoff } from './model';
import { rollAccent, tintAmount } from './color';
import styles from './TextMotion.module.css';
import type { TextMotionUnit } from './segments';
import { registerFlowMirror } from './flow-mirror';
import type { TextMotionLayoutParticipant } from './layout-context';
import { createPresentationClock } from './presentationClock';
import { attachMeasurementProbe } from './measurementSurface';
import { attachButtonPaintAnchor } from './buttonPaintAnchor';

/** All controllers paint on one clock without React updates. Control geometry
 * is sampled once after the batch, before the browser presents the frame. */
const active = new Set<(time: number) => boolean>();
let frame: number | undefined;
function schedule(paint: (time: number) => boolean) {
  active.add(paint);
  if (frame !== undefined) return;
  frame = requestAnimationFrame(function tick() {
    frame = undefined;
    // A callback's supplied frame timestamp can predate a long synchronous
    // commit in this same rendering opportunity. Use one current timestamp.
    const time = performance.now();
    for (const render of active) if (!render(time)) active.delete(render);
    if (active.size) frame = requestAnimationFrame(tick);
  });
}

function createTextMotion(
  root: HTMLElement,
  ruler: HTMLElement,
  paint: HTMLElement,
  value: string,
  width?: number,
  align: 'start' | 'center' | 'end' = 'center',
  by: TextMotionUnit = 'character',
  containExits = false,
  decorateInk?: (ink: HTMLElement) => void,
  layout?: TextMotionLayoutParticipant,
  nativeInput = false,
) {
  const original = [...paint.childNodes].map((node) => node.cloneNode(true));
  const originalWidth = root.style.width;
  const originalPaintLeft = paint.style.left;
  const originalPaintTransform = paint.style.transform;
  const originalPaintWillChange = paint.style.willChange;
  const buttonAnchor = attachButtonPaintAnchor(root);
  const originalInkWidth = root.style.getPropertyValue(
    '--TextMotion-ink-width',
  );
  const nodes = new Map<
    number,
    {
      slot: HTMLElement;
      ink: HTMLElement;
      base: HTMLElement;
      tint: HTMLElement;
      surface?: HTMLElement;
      anchorX: number;
      treatment?: string;
      decorated?: boolean;
    }
  >();
  const probe = ruler.cloneNode(true) as HTMLElement;
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    contain: 'layout style paint',
  });
  const measurementSurface = attachMeasurementProbe(probe);
  if (measurementSurface.isolated)
    Object.assign(probe.style, {
      display: 'inline-block',
      width: 'max-content',
      minHeight: '1lh',
      boxSizing: 'border-box',
      whiteSpace: 'nowrap',
    });
  let lastLayout = '';
  let currentValue = value;
  let constrained = width;
  let alignment = align;
  let direction: 'up' | 'down' = 'up';
  let handoff: TextMotionHandoff = 'crossfade';
  let rollColor: string | undefined;
  let measuredRuler = { width: 0, height: 0 };
  const measurements = new Map<
    string,
    { width: number; height: number; slots: Slot[] }
  >();
  const mirrors = new Set<() => void>();
  const clock = createPresentationClock();

  function measure(): { width: number; slots: Slot[]; scale: number } {
    // Measure outside the pressing button. CSSOM's computed width is rounded
    // (104.15625 becomes 104.156), which can cost a layout unit when assigned
    // back. An untransformed probe retains the browser's exact fractions.
    const typography = getComputedStyle(ruler);
    const probeScale = measurementSurface.scale();
    const properties = [
      // Shorthand serialization can be empty with feature/variation settings.
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'font-stretch',
      'line-height',
      'font-kerning',
      'font-variant',
      'font-feature-settings',
      'font-variation-settings',
      'font-optical-sizing',
      'letter-spacing',
      'word-spacing',
      'text-transform',
      'direction',
    ].map(
      (property) => [property, typography.getPropertyValue(property)] as const,
    );
    const key = JSON.stringify([
      properties,
      probeScale,
      [...ruler.children].map((child) => child.textContent),
    ]);
    let metrics = measurements.get(key);
    if (!metrics) {
      for (const [property, value] of properties)
        probe.style.setProperty(property, value);
      probe.replaceChildren(
        ...[...ruler.childNodes].map((node) => node.cloneNode(true)),
      );
      if (measurementSurface.isolated) {
        for (const child of probe.children)
          Object.assign((child as HTMLElement).style, {
            position: 'relative',
            display: 'inline-block',
            isolation: 'isolate',
            whiteSpace: 'pre',
            verticalAlign: 'baseline',
          });
      }
      const rect = probe.getBoundingClientRect();
      // A native editor shapes one text run, rather than rounding each inline
      // glyph's advance separately. Preserve those same cumulative positions.
      const nativeSlots: Slot[] = [];
      let nativeWidth: number | undefined;
      if (nativeInput) {
        const parts = [...ruler.children].map(
          (child) => child.textContent ?? '',
        );
        probe.textContent = parts.join('');
        const bounds = probe.getBoundingClientRect();
        nativeWidth = bounds.width / probeScale;
        const text = probe.firstChild;
        if (text) {
          const range = document.createRange();
          let offset = 0;
          for (const part of parts) {
            range.setStart(text, offset);
            range.setEnd(text, offset + part.length);
            nativeSlots.push({
              text: part,
              x:
                (range.getBoundingClientRect().left - bounds.left) / probeScale,
            });
            offset += part.length;
          }
        }
      }
      metrics = {
        width: nativeWidth ?? rect.width / probeScale,
        height: rect.height / probeScale,
        slots: nativeInput
          ? nativeSlots
          : [...probe.children].map((child) => ({
              text: child.textContent ?? '',
              x: (child.getBoundingClientRect().left - rect.left) / probeScale,
            })),
      };
      // Repeated toggles reuse exact font metrics instead of rebuilding a
      // measuring tree and forcing another layout on every pointer click.
      if (measurements.size === 8)
        measurements.delete(measurements.keys().next().value!);
      measurements.set(key, metrics);
    }
    measuredRuler = { width: metrics.width, height: metrics.height };
    const width = metrics.width;
    // Scale compensation is only used when changing the outer width. Fixed
    // labels keep their geometry, even inside a pressing/scaling button.
    let scale = 1;
    if (
      constrained === undefined ||
      constrained !== parseFloat(root.style.width)
    ) {
      const liveRect = ruler.getBoundingClientRect();
      scale =
        width > 0
          ? liveRect.width / width
          : metrics.height > 0
            ? liveRect.height / metrics.height
            : 1;
    }
    const targetWidth = constrained ?? width;
    const rtl = typography.getPropertyValue('direction') === 'rtl';
    const offset =
      alignment === 'center'
        ? (targetWidth - width) / 2
        : (alignment === 'end') !== rtl
          ? targetWidth - width
          : 0;
    return {
      width: targetWidth,
      scale: scale || 1,
      slots: metrics.slots.map((slot) => ({ ...slot, x: slot.x + offset })),
    };
  }

  const initial = measure();
  let originFactor = 0;
  lastLayout = JSON.stringify([value, initial.width, initial.slots]);
  const model = new TextMotionModel(value, initial.slots, initial.width, by);
  const initialFrame = model.sample(0);
  [...paint.children].forEach((slot, index) => {
    const glyph = initialFrame.glyphs[index];
    if (glyph) {
      const ink = slot.firstElementChild as HTMLElement;
      const surface = decorateInk
        ? (ink.firstElementChild as HTMLElement)
        : undefined;
      const colors = surface ?? ink;
      nodes.set(glyph.id, {
        slot: slot as HTMLElement,
        ink,
        base: colors.children[0] as HTMLElement,
        tint: colors.children[1] as HTMLElement,
        surface,
        anchorX: glyph.x,
      });
    }
  });

  function drawGlyph(glyph: GlyphFrame, width: number) {
    let node = nodes.get(glyph.id);
    if (!node) {
      const slot = document.createElement('span');
      slot.className = styles.slot;
      const ink = document.createElement('span');
      ink.className = styles.character;
      const base = document.createElement('span');
      base.className = styles.base;
      base.textContent = glyph.text;
      const tint = document.createElement('span');
      tint.className = styles.tint;
      tint.textContent = glyph.text;
      const surface = decorateInk ? document.createElement('span') : undefined;
      if (surface) {
        surface.className = styles.surface;
        surface.append(base, tint);
        ink.append(surface);
      } else ink.append(base, tint);
      slot.append(ink);
      paint.append(slot);
      node = { slot, ink, base, tint, surface, anchorX: glyph.x };
      nodes.set(glyph.id, node);
    }
    const { slot, ink, base, tint } = node;
    if (decorateInk && node.surface) {
      node.surface.style.setProperty('--TextMotion-ink-x', `${glyph.x}px`);
      if (!node.decorated) {
        node.surface.dataset.motionInk = '';
        decorateInk(node.surface);
        node.decorated = true;
      }
    }
    slot.dataset.glyphId = String(glyph.id);
    slot.dataset.leaving = String(glyph.leaving);
    // A line exit owns the departing value. Painting it again on the arrival
    // line makes a wrapping replacement appear to happen in two places.
    slot.style.visibility = mirrors.size && glyph.leaving ? 'hidden' : '';
    slot.style.position = 'absolute';
    slot.style.top = '0';
    // Keep the raster origin fixed. Moving layout offsets lets the compositor
    // round each letter independently, even when DOM spacing stays constant.
    slot.style.left = `${node.anchorX}px`;
    slot.style.transform = `translateX(${glyph.x - node.anchorX}px)`;
    // A shrinking inline value must not paint its departing tail over the next
    // word. Feather only exiting ink, never shared or arriving glyph textures.
    // Standalone labels retain their approved unmasked rendering.
    if (containExits)
      slot.style.maskImage = glyph.leaving
        ? `linear-gradient(to right, #000 calc(${width - glyph.x}px - .3em), transparent ${width - glyph.x}px)`
        : '';
    ink.style.transform = `translateY(${glyph.y}em) scale(${glyph.scale}) rotate(${glyph.rotate}deg)`;
    ink.style.filter = `blur(${glyph.blur}em)`;
    ink.style.opacity = String(glyph.opacity);
    if (rollColor && node.treatment !== rollColor) {
      // Changing text colour on every frame invalidates the glyph texture.
      // Raster both colours once, then mix their existing pixels via opacity.
      tint.style.color = rollAccent(rollColor, glyph.x, width);
      ink.dataset.tinted = '';
      node.treatment = rollColor;
    }
    const amount = tintAmount(rollColor, glyph.opacity);
    base.style.opacity = String(1 - amount);
    tint.style.opacity = String(amount);
  }

  function render(time: number) {
    const state = model.sample(time);
    const layoutMoving = layout?.render(time) ?? false;
    root.style.width = `${state.width}px`;
    if (decorateInk)
      root.style.setProperty('--TextMotion-ink-width', `${state.width}px`);
    paint.style.left = nativeInput
      ? '0px'
      : `calc(${originFactor * 100}% - ${initial.width * originFactor}px)`;
    paint.style.transform = nativeInput
      ? 'translateX(0px)'
      : `translateX(${(initial.width - state.width) * originFactor}px)`;
    if (buttonAnchor) {
      paint.style.left = '0px';
      paint.style.transform = 'none';
      paint.style.willChange = 'auto';
    }
    root.dataset.motionPhase = state.moving ? 'moving' : 'rest';
    const kept = new Set<number>();
    for (const glyph of state.glyphs) {
      kept.add(glyph.id);
      drawGlyph(glyph, state.width);
    }
    for (const [id, node] of nodes)
      if (!kept.has(id)) {
        node.slot.remove();
        nodes.delete(id);
      }
    buttonAnchor?.schedule();
    for (const mirror of mirrors) mirror();
    return state.moving || layoutMoving;
  }
  render(0);
  const present = (wallTime: number) => render(clock.present(wallTime));

  const unregisterMirror = registerFlowMirror(root, (target) => {
    const targetPaint = target.lastElementChild as HTMLElement;
    const copies = new Map<number, HTMLElement>();
    // Retain the ink that was actually visible on this line. Its existing
    // tracks keep running, but new arrivals belong only on the new line.
    const retained = new Set(
      model
        .sample(clock.read(performance.now()))
        .glyphs.filter((glyph) => glyph.opacity > 0.001)
        .map((glyph) => glyph.id),
    );
    targetPaint.replaceChildren();
    const sync = () => {
      target.style.width = root.style.width;
      target.dataset.motionPhase = root.dataset.motionPhase;
      targetPaint.style.cssText = paint.style.cssText;
      for (const [id, node] of nodes) {
        if (!retained.has(id)) continue;
        let slot = copies.get(id);
        if (!slot) {
          slot = node.slot.cloneNode(true) as HTMLElement;
          copies.set(id, slot);
          targetPaint.append(slot);
        }
        slot.style.cssText = node.slot.style.cssText;
        slot.style.visibility = '';
        slot.dataset.leaving = node.slot.dataset.leaving;
        const ink = slot.firstElementChild as HTMLElement;
        ink.style.cssText = node.ink.style.cssText;
        if (node.ink.hasAttribute('data-tinted')) ink.dataset.tinted = '';
        const colors = node.surface
          ? (ink.firstElementChild as HTMLElement)
          : ink;
        if (node.surface) colors.style.cssText = node.surface.style.cssText;
        (colors.children[0] as HTMLElement).style.cssText =
          node.base.style.cssText;
        (colors.children[1] as HTMLElement).style.cssText =
          node.tint.style.cssText;
      }
      for (const [id, slot] of copies)
        if (!nodes.has(id)) {
          slot.remove();
          copies.delete(id);
        }
    };
    mirrors.add(sync);
    render(clock.read(performance.now()));
    return () => {
      mirrors.delete(sync);
      render(clock.read(performance.now()));
    };
  });

  function update(
    next: string,
    duration: number,
    width?: number,
    align: 'start' | 'center' | 'end' = 'center',
    roll: 'up' | 'down' = 'up',
    nextHandoff: TextMotionHandoff = 'crossfade',
    settleUnchanged = true,
  ) {
    constrained = width;
    alignment = align;
    direction = roll;
    handoff = nextHandoff;
    const time = clock.read(performance.now());
    render(time);
    if (settleUnchanged) layout?.update(time, duration);
    const measured = measure();
    const key = JSON.stringify([next, measured.width, measured.slots]);
    if (key === lastLayout) {
      if (!duration && settleUnchanged) {
        model.settle();
        layout?.settle();
        render(time);
        clock.present(performance.now());
        active.delete(present);
      }
      if (layout?.render(time)) {
        if (settleUnchanged && duration) clock.hold(time);
        schedule(present);
      }
      return;
    }
    lastLayout = key;
    // One synchronous final-layout probe, restored before paint. Width and
    // glyphs then share the same interpolation; no second compensating timeline.
    const currentWidth = root.style.width;
    const widthDelta = measured.width - parseFloat(currentWidth);
    let originShift = 0;
    if (widthDelta !== 0) {
      buttonAnchor?.sync();
      const before = root.getBoundingClientRect();
      root.style.width = `${measured.width}px`;
      buttonAnchor?.sync();
      originShift =
        (root.getBoundingClientRect().left - before.left) / measured.scale;
      root.style.width = currentWidth;
      buttonAnchor?.sync();
    }
    if (Math.abs(widthDelta) > 1 / 32) {
      // Learn how the parent anchors width changes: start, center, end, or a
      // distributed layout. Allow two layout units of measurement rounding.
      originFactor =
        [0, 0.5, 1].find(
          (factor) => Math.abs(originShift + widthDelta * factor) <= 1 / 32,
        ) ?? -originShift / widthDelta;
    }
    model.update(
      next,
      measured.slots,
      measured.width,
      originShift,
      time,
      duration,
      direction === 'up' ? 1 : -1,
      handoff,
    );
    currentValue = next;
    if (render(time)) {
      if (duration) clock.hold(time);
      schedule(present);
    } else {
      clock.present(performance.now());
      active.delete(present);
    }
  }

  return {
    update,
    setRollColor: (color: string | undefined) => {
      rollColor = color;
      render(clock.read(performance.now()));
    },
    // ResizeObserver also reports the new label measured by update(). That
    // notification must not finish the transition that just started.
    reflow: (rulerWidth?: number, rulerHeight?: number) => {
      // The ResizeObserver confirmation for a value we just measured is not
      // another typography change. Avoid cloning the probe and forcing layout.
      if (
        rulerWidth === measuredRuler.width &&
        rulerHeight !== undefined &&
        // Serializing inherited line-height into the probe can round its
        // height by one layout unit. Glyph widths still require an exact match.
        Math.abs(rulerHeight - measuredRuler.height) <= 1 / 64
      )
        return;
      // A loaded font can change metrics without changing its CSS family.
      measurements.clear();
      update(
        currentValue,
        0,
        constrained,
        alignment,
        direction,
        handoff,
        false,
      );
    },
    settle: () => {
      model.settle();
      layout?.settle();
      render(clock.present(performance.now()));
      active.delete(present);
    },
    dispose: () => {
      unregisterMirror();
      mirrors.clear();
      measurements.clear();
      active.delete(present);
      if (!active.size && frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
      }
      paint.replaceChildren(...original);
      measurementSurface.dispose();
      root.style.width = originalWidth;
      paint.style.left = originalPaintLeft;
      paint.style.transform = originalPaintTransform;
      paint.style.willChange = originalPaintWillChange;
      buttonAnchor?.release();
      if (decorateInk)
        root.style.setProperty('--TextMotion-ink-width', originalInkWidth);
      delete root.dataset.motionPhase;
    },
  };
}

export { createTextMotion };
