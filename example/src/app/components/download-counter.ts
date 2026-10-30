export type DownloadCounterCache = {
  version: 1 | 2;
  displayed: number;
  verifiedTotal: number;
  updatedAt: number;
  checkedAt?: number;
  verifiedThrough?: string;
};

// Isolate this pacing policy from older open tabs, which can otherwise write
// their already-exhausted value back over the new counter's reserve.
export const DOWNLOAD_COUNTER_KEY = "agentation:download-counter:v2";

export function parseDownloadCounter(value: string | null): DownloadCounterCache | null {
  try {
    const data = JSON.parse(value ?? "null");
    return (data?.version === 1 || data?.version === 2) && Number.isSafeInteger(data.displayed) &&
      Number.isSafeInteger(data.verifiedTotal) && data.displayed >= 0 &&
      data.displayed <= data.verifiedTotal && Number.isFinite(data.updatedAt) && data.updatedAt > 0 &&
      (data.checkedAt === undefined || (Number.isFinite(data.checkedAt) && data.checkedAt > 0)) &&
      (data.verifiedThrough === undefined || /^\d{4}-\d{2}-\d{2}$/.test(data.verifiedThrough))
      ? data : null;
  } catch { return null; }
}

export function resumeDownloadCounter(total: number, cached: DownloadCounterCache | null, now: number, random: number): DownloadCounterCache {
  const verifiedTotal = Math.max(total, cached?.verifiedTotal ?? 0);
  // A large reserve plus adaptive pacing lasts through extended visits. Migrate
  // only exhausted v1 counters once, before paint; subsequent reloads resume.
  const offset = Math.round(400000 + Math.max(0, Math.min(1, random)) * 500000);
  const exhaustedLegacy = cached?.version === 1 && cached.displayed === cached.verifiedTotal;
  const displayed = cached && !exhaustedLegacy
    ? cached.displayed
    : Math.max(0, verifiedTotal - offset);
  return { ...cached, version: 2, displayed, verifiedTotal, updatedAt: now };
}

export function tickDownloadCounter(state: DownloadCounterCache, now: number, random: number): DownloadCounterCache {
  // Other tabs share the clock as well as the value, so opening more tabs does
  // not consume the reserve faster. Never catch up missed ticks in a burst.
  if (now - state.updatedAt < 1000) return state;
  const remaining = state.verifiedTotal - state.displayed;
  if (remaining <= 0) return state;
  const requested = 18 + Math.floor(Math.max(0, Math.min(1, random)) * 48);
  const step = Math.min(requested, Math.max(2, Math.floor(remaining / 21600)));
  return { ...state, displayed: Math.min(state.verifiedTotal, state.displayed + step), updatedAt: now };
}
