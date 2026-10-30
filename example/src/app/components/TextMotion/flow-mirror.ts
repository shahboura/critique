// TextFlow's line exits retain their visible ink on the live renderer's clock.
// New arrivals belong on the destination line, never inside a departing copy.
type Mirror = (target: HTMLElement) => () => void;
const renderers = new WeakMap<HTMLElement, Mirror>();

function registerFlowMirror(root: HTMLElement, mirror: Mirror) {
  renderers.set(root, mirror);
  return () => renderers.delete(root);
}

function mirrorFlowText(source: HTMLElement, target: HTMLElement) {
  const originals = source.querySelectorAll<HTMLElement>(
    '[data-text-motion]',
  );
  const copies = target.querySelectorAll<HTMLElement>('[data-text-motion]');
  const cleanup: (() => void)[] = [];
  originals.forEach((root, index) => {
    const mirror = renderers.get(root);
    if (mirror && copies[index]) cleanup.push(mirror(copies[index]));
  });
  return () => cleanup.forEach((dispose) => dispose());
}

export { registerFlowMirror, mirrorFlowText };
