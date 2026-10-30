'use client';

import * as React from 'react';
import * as Primitive from '@radix-ui/react-select';
import styles from './Select.module.css';

/** A value picker opens around its selection, not at the start of the list.
 * Preparation is synchronous and local to the viewport; it never scrolls the
 * surrounding page. The same mounted viewport survives interrupted exits. */
function SelectViewport({ children }: { children: React.ReactNode }) {
  const viewport = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    let prepared = false;
    let userScroll = false;
    let scrolled = false;
    const measure = () => {
      // Radix also renders options in a disconnected fragment while closed.
      if (!node.isConnected || !node.clientHeight) return;
      if (!prepared) {
        const selected = node.querySelector<HTMLElement>(
          '[data-state="checked"]',
        );
        if (selected && node.scrollHeight > node.clientHeight) {
          const rows = [
            ...node.querySelectorAll<HTMLElement>('[role="option"]'),
          ];
          const ideal = Math.max(
            0,
            Math.min(
              node.scrollHeight - node.clientHeight,
              selected.offsetTop -
                (node.clientHeight - selected.offsetHeight) / 2,
            ),
          );
          const first = rows.reduce((nearest, row) =>
            Math.abs(row.offsetTop - ideal) <
            Math.abs(nearest.offsetTop - ideal)
              ? row
              : nearest,
          );
          const start = first.offsetTop;
          const end = rows.reduce((edge, row) => {
            const bottom = row.offsetTop + row.offsetHeight;
            return bottom <= start + node.clientHeight
              ? Math.max(edge, bottom)
              : edge;
          }, start);
          // Whole rows at rest, including variable-height descriptions. Scroll
          // masks only become necessary once the user actually moves the list.
          if (end >= selected.offsetTop + selected.offsetHeight) {
            node.style.setProperty(
              '--Select-visible-height',
              `${end - start}px`,
            );
          }
          node.scrollTop = start;
        }
        prepared = true;
      }
      const start = Math.max(0, node.scrollTop);
      const end = Math.max(0, node.scrollHeight - node.clientHeight - start);
      node.toggleAttribute('data-select-overflow-start', start > 1);
      node.toggleAttribute('data-select-overflow-end', end > 1);
      node.toggleAttribute('data-select-scrolled', scrolled);
      node.style.setProperty(
        '--Select-scroll-start',
        `${scrolled ? Math.min(12, start) : 0}px`,
      );
      node.style.setProperty(
        '--Select-scroll-end',
        `${scrolled ? Math.min(12, end) : 0}px`,
      );
    };
    const intent = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        !['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(
          event.key,
        ) &&
        !(
          event.key.length === 1 &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        )
      )
        return;
      userScroll = true;
    };
    const scroll = () => {
      if (userScroll) scrolled = true;
      measure();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    for (const child of node.children) resize.observe(child);
    node.addEventListener('wheel', intent, { passive: true });
    node.addEventListener('touchmove', intent, { passive: true });
    node.addEventListener('keydown', intent);
    node.addEventListener('scroll', scroll, { passive: true });
    measure();
    return () => {
      resize.disconnect();
      node.removeEventListener('wheel', intent);
      node.removeEventListener('touchmove', intent);
      node.removeEventListener('keydown', intent);
      node.removeEventListener('scroll', scroll);
    };
  }, []);

  return (
    <div className={styles.scrollFrame}>
      <Primitive.Viewport ref={viewport} className={styles.viewport}>
        {children}
      </Primitive.Viewport>
      {/* Quiet, real boundaries before scrolling; no resting veil or buttons
          that resize the viewport when they appear/disappear. */}
      <div
        className={styles.scrollBoundary}
        data-edge="start"
        aria-hidden="true"
      />
      <div
        className={styles.scrollBoundary}
        data-edge="end"
        aria-hidden="true"
      />
    </div>
  );
}

export { SelectViewport };
