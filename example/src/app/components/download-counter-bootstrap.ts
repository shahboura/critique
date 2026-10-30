import type { parseDownloadCounter, resumeDownloadCounter } from "./download-counter";

// Runs before the static HTML paints. Pass the same pure policy used by React
// so cache migration and the hydration value cannot disagree.
export function initializeDownloadCounter(
  key: string,
  total: number,
  parse: typeof parseDownloadCounter,
  resume: typeof resumeDownloadCounter,
) {
  let stored: string | null = null;
  try { stored = localStorage.getItem(key); } catch { /* Storage is optional. */ }
  const state = resume(total, parse(stored), Date.now(), Math.random());
  document.documentElement.style.setProperty("--agentation-download-start", JSON.stringify(state.displayed.toLocaleString("en-US")));
  try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* The initial value still paints without storage. */ }
}
