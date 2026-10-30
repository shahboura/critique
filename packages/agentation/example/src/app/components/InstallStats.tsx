"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DOWNLOAD_SNAPSHOT, fetchDownloadTotal } from "../downloads";
import { CommandBlock } from "./CommandBlock";
import { TextMotion } from "./TextMotion";
import { DOWNLOAD_COUNTER_KEY, parseDownloadCounter, resumeDownloadCounter, tickDownloadCounter, type DownloadCounterCache } from "./download-counter";

function readCache() {
  try { return parseDownloadCounter(localStorage.getItem(DOWNLOAD_COUNTER_KEY)); }
  catch { return null; }
}
function saveCache(value: DownloadCounterCache) {
  try { localStorage.setItem(DOWNLOAD_COUNTER_KEY, JSON.stringify(value)); }
  catch { /* Storage can be unavailable in private or embedded browsers. */ }
}

export function InstallStats() {
  const [count, setCount] = useState<number | null>(null);
  const [end, setEnd] = useState(DOWNLOAD_SNAPSHOT.end);
  const [reducedMotion, setReducedMotion] = useState(false);
  const current = useRef<DownloadCounterCache | null>(null);

  useLayoutEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const controller = new AbortController();
    const publish = (next: DownloadCounterCache) => {
      current.current = next;
      setCount(next.displayed);
      setEnd(next.verifiedThrough ?? DOWNLOAD_SNAPSHOT.end);
      document.documentElement.style.setProperty("--agentation-download-start", JSON.stringify(next.displayed.toLocaleString("en-US")));
      saveCache(next);
    };
    const cached = readCache();
    const initial = resumeDownloadCounter(DOWNLOAD_SNAPSHOT.downloads, cached, Date.now(), Math.random());
    const painted = document.documentElement.style.getPropertyValue("--agentation-download-start").replace(/[^\d]/g, "");
    // Adopt the already-painted value exactly; the first change is a normal tick.
    if (cached?.version === 2) initial.displayed = cached.displayed;
    else if (!cached && painted && Number.isSafeInteger(Number(painted))) initial.displayed = Math.min(initial.verifiedTotal, Number(painted));
    publish(initial);

    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden || !current.current || current.current.displayed >= current.current.verifiedTotal) return;
      timer = setTimeout(() => {
        const state = current.current!;
        const otherTab = readCache();
        const total = Math.max(state.verifiedTotal, otherTab?.verifiedTotal ?? 0);
        const displayed = Math.max(state.displayed, otherTab?.displayed ?? 0);
        const latest = otherTab && (otherTab.checkedAt ?? 0) > (state.checkedAt ?? 0) ? otherTab : state;
        publish(tickDownloadCounter({
          ...latest, displayed, verifiedTotal: total,
          updatedAt: Math.max(state.updatedAt, otherTab?.updatedAt ?? 0),
        }, Date.now(), Math.random()));
        schedule();
      }, 1000 + Math.random() * 900);
    };
    const visibility = () => {
      if (!document.hidden && current.current) {
        const stored = readCache();
        const latest = stored && stored.displayed > current.current.displayed ? stored : current.current;
        publish(resumeDownloadCounter(current.current.verifiedTotal, latest, Date.now(), 0));
      }
      schedule();
    };
    const motion = () => setReducedMotion(preference.matches);
    const storage = (event: StorageEvent) => {
      if (event.key !== DOWNLOAD_COUNTER_KEY || !current.current) return;
      const cached = parseDownloadCounter(event.newValue);
      if (cached) {
        const state = current.current;
        const latest = (cached.checkedAt ?? 0) > (state.checkedAt ?? 0) ? cached : state;
        current.current = { ...latest, displayed: Math.max(state.displayed, cached.displayed), verifiedTotal: Math.max(state.verifiedTotal, cached.verifiedTotal) };
        setCount(current.current.displayed);
        setEnd(current.current.verifiedThrough ?? DOWNLOAD_SNAPSHOT.end);
        document.documentElement.style.setProperty("--agentation-download-start", JSON.stringify(current.current.displayed.toLocaleString("en-US")));
      }
    };
    const refresh = async () => {
      if (current.current?.checkedAt && Date.now() - current.current.checkedAt < 3600000) return;
      try {
        const data = await fetchDownloadTotal(controller.signal);
        if (!controller.signal.aborted && current.current && data.downloads >= current.current.verifiedTotal) {
          publish({ ...current.current, verifiedTotal: data.downloads, verifiedThrough: data.end, checkedAt: Date.now() });
          schedule();
        }
      } catch { /* Keep the last verified total when offline. */ }
    };
    motion();
    schedule();
    void refresh();
    const refreshTimer = setInterval(refresh, 3600000);
    preference.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("storage", storage);
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearInterval(refreshTimer);
      preference.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("storage", storage);
    };
  }, []);

  return (
    <div className="docs-install-stats">
      <a className="docs-download-count" href="https://www.npmjs.com/package/agentation" title={`npm downloads through ${end}`}>
        {count === null
          ? <span className="docs-download-placeholder" aria-hidden="true" style={{ "--download-fallback": JSON.stringify((DOWNLOAD_SNAPSHOT.downloads - 650000).toLocaleString("en-US")) } as CSSProperties} />
          : <TextMotion animated={!reducedMotion}>{count.toLocaleString("en-US")}</TextMotion>}
        <span>downloads</span>
      </a>
      <CommandBlock command="npm install agentation -D" label="Copy install command" />
    </div>
  );
}
