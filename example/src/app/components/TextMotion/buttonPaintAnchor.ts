/** A resizing, scaling control needs a stable raster origin. Its box still
 * takes part in normal layout; equal and opposite relative offsets and
 * translations move fractional positioning into the compositor instead of
 * repeatedly rounding nested paint offsets. */
interface ButtonPaintAnchor {
  sync(): void;
  schedule(): void;
  release(): void;
}
interface InkRoot {
  element: HTMLElement;
  left: string;
  translate: string;
  baseLeft: number;
}
interface Control {
  element: HTMLElement;
  left: string;
  translate: string;
  width?: number;
  roots: Set<InkRoot>;
  observer: ResizeObserver;
}
const controls = new WeakMap<HTMLElement, Control>();
const dirty = new Set<Control>();
let queued = false;

function borderWidth(style: CSSStyleDeclaration) {
  let width = parseFloat(style.width);
  if (style.boxSizing !== 'border-box')
    width +=
      parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight) +
      parseFloat(style.borderLeftWidth) +
      parseFloat(style.borderRightWidth);
  return Math.round(width * 64) / 64;
}
function readControl(control: Control) {
  const style = getComputedStyle(control.element);
  const width = borderWidth(style);
  const rect = control.element.getBoundingClientRect();
  const transform = new DOMMatrixReadOnly(style.transform);
  const scale = rect.width / width;
  const parentScale = scale / Math.abs(transform.a);
  if (!width || !Number.isFinite(parentScale) || !parentScale) return;
  // The old relative offset is temporarily paired with the new percentage
  // translation until this layout pass updates the control's width.
  const center =
    rect.left +
    rect.width / 2 +
    (control.width === undefined
      ? 0
      : ((width - control.width) / 2) * parentScale);
  const density = window.devicePixelRatio || 1;
  const delta = (Math.round(center * density) / density - center) / parentScale;
  const left = Math.round((width / 2 + delta) * 64) / 64;
  return { control, width, rect, scale, left, remainder: left - width / 2 };
}
function writeControl(frame: NonNullable<ReturnType<typeof readControl>>) {
  const { control, width, left, remainder } = frame;
  control.width = width;
  control.element.style.left = `${left}px`;
  control.element.style.translate = `calc(-50% - ${remainder}px)`;
}
function flush() {
  queued = false;
  // Batch all geometry reads before writes. One layout pass serves every
  // changing label, including feedback slots that move otherwise static text.
  const frames = [...dirty]
    .map(readControl)
    .filter((frame) => frame !== undefined);
  dirty.clear();
  const ink = frames.flatMap(({ control, rect, scale }) =>
    [...control.roots].map((root) => {
      const x = (root.element.getBoundingClientRect().left - rect.left) / scale;
      const left = Math.round((root.baseLeft - x) * 64) / 64;
      return { root, left, translate: root.baseLeft - left };
    }),
  );
  frames.forEach(writeControl);
  for (const { root, left, translate } of ink) {
    root.element.style.left = `${left}px`;
    root.element.style.translate = `${translate}px`;
  }
}
function schedule(control: Control) {
  if (!control.roots.size) return;
  dirty.add(control);
  if (queued) return;
  queued = true;
  queueMicrotask(flush);
}

function attachButtonPaintAnchor(
  root: HTMLElement,
): ButtonPaintAnchor | undefined {
  const button = root.closest?.<HTMLElement>('[data-motion-button]');
  if (!button) return;
  const rootStyle = getComputedStyle(root);
  if (
    rootStyle.position !== 'relative' ||
    rootStyle.translate !== 'none' ||
    rootStyle.transform !== 'none'
  )
    return;
  let control = controls.get(button);
  if (!control) {
    const style = getComputedStyle(button);
    // Consumer positioning and translations keep their own coordinate system.
    if (
      style.position !== 'relative' ||
      !['auto', '0px'].includes(style.left) ||
      style.translate !== 'none'
    )
      return;
    const observer = new ResizeObserver(() => schedule(control!));
    control = {
      element: button,
      left: button.style.left,
      translate: button.style.translate,
      roots: new Set(),
      observer,
    };
    controls.set(button, control);
    observer.observe(button);
  }
  const ink: InkRoot = {
    element: root,
    left: root.style.left,
    translate: root.style.translate,
    baseLeft: Math.round((parseFloat(rootStyle.left) || 0) * 64) / 64,
  };
  control.roots.add(ink);
  const owned = control;
  const sync = () => {
    const frame = readControl(owned);
    if (frame) writeControl(frame);
  };
  sync();
  schedule(owned);
  return {
    sync,
    schedule: () => schedule(owned),
    release() {
      if (!owned.roots.delete(ink)) return;
      root.style.left = ink.left;
      root.style.translate = ink.translate;
      if (owned.roots.size) return;
      owned.observer.disconnect();
      owned.element.style.left = owned.left;
      owned.element.style.translate = owned.translate;
      dirty.delete(owned);
      controls.delete(button);
    },
  };
}
export { attachButtonPaintAnchor };
