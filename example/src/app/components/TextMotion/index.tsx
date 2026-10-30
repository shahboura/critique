"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";
import { createTextMotion } from "./controller";
import { segments } from "./segments";
import styles from "./TextMotion.module.css";

const InitialInk = memo(function InitialInk({ value }: { value: string }) {
  return <>{segments(value).map((character, index) => (
    <span className={styles.slot} key={index}>
      <span className={styles.character}>
        <span className={styles.base}>{character}</span>
        <span className={styles.tint}>{character}</span>
      </span>
    </span>
  ))}</>;
});

/** Persistent glyph motion for the downloads counter. */
export function TextMotion({ children, animated = true }: {
  children: string;
  animated?: boolean;
}) {
  const [initial] = useState(children);
  const root = useRef<HTMLSpanElement>(null);
  const ruler = useRef<HTMLSpanElement>(null);
  const paint = useRef<HTMLSpanElement>(null);
  const controller = useRef<ReturnType<typeof createTextMotion> | null>(null);

  useLayoutEffect(() => {
    if (!root.current || !ruler.current || !paint.current) return;
    const engine = createTextMotion(root.current, ruler.current, paint.current, initial, undefined, "start");
    controller.current = engine;
    const observer = new ResizeObserver(([entry]) => engine.reflow(entry?.contentRect.width, entry?.contentRect.height));
    observer.observe(ruler.current);
    return () => { observer.disconnect(); engine.dispose(); controller.current = null; };
  }, [initial]);

  useLayoutEffect(() => {
    if (!animated) controller.current?.settle();
    controller.current?.update(children, animated ? 200 : 0, undefined, "start", "up", "crossfade");
  }, [children, animated]);

  return (
    <span ref={root} className={styles.root} data-align="start">
      <span className="docs-sr-only">{children}</span>
      <span ref={ruler} className={styles.ruler} aria-hidden="true">
        {segments(children).map((character, index) => <span className={styles.character} key={index}>{character}</span>)}
      </span>
      <span ref={paint} className={styles.paint} aria-hidden="true"><InitialInk value={initial} /></span>
    </span>
  );
}
