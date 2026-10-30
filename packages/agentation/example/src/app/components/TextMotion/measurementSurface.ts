/** A shadow boundary keeps exact DOM measurement while preventing unrelated
 * document selectors from invalidating on every probe mutation. Font metrics
 * are still copied from the real label, never approximated with canvas. */
const surfaces = new WeakMap<
  Document,
  { host: HTMLElement; root: ShadowRoot; users: number }
>();
export function attachMeasurementProbe(probe: HTMLElement) {
  const doc = probe.ownerDocument ?? document;
  let surface = surfaces.get(doc);
  if (!surface) {
    const host = doc.createElement('span');
    // Keep minimal DOM test environments and older embedders functional.
    if (typeof host.attachShadow !== 'function') {
      doc.body.append(probe);
      return { isolated: false, scale: () => 1, dispose: () => probe.remove() };
    }
    Object.assign(host.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '0',
      height: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      contain: 'strict',
    });
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('data-text-measurement-surface', '');
    surface = { host, root: host.attachShadow({ mode: 'closed' }), users: 0 };
    surfaces.set(doc, surface);
    doc.body.append(host);
  }
  ++surface.users;
  surface.root.append(probe);
  let disposed = false;
  return {
    isolated: true,
    scale() {
      let scale = 1;
      // The shadow host is outside a pressing control, but still inherits page zoom.
      for (
        let node: HTMLElement | null = surface!.host;
        node;
        node = node.parentElement
      ) {
        const value = getComputedStyle(node).getPropertyValue('zoom');
        scale *= value.endsWith('%')
          ? parseFloat(value) / 100
          : parseFloat(value) || 1;
      }
      return scale;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      probe.remove();
      if (--surface.users === 0) {
        surface.host.remove();
        surfaces.delete(doc);
      }
    },
  };
}
