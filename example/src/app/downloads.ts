// Public npm download total through this date; future requests add only new days.
export const DOWNLOAD_SNAPSHOT = { downloads: 24358220, end: "2026-09-19" };

/** Static docs have no API server. Add only complete days after our snapshot. */
export async function fetchDownloadTotal(signal: AbortSignal, now = new Date()) {
  const start = new Date(`${DOWNLOAD_SNAPSHOT.end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - 1);
  const from = start.toISOString().slice(0, 10);
  const through = end.toISOString().slice(0, 10);
  if (from > through) return DOWNLOAD_SNAPSHOT;

  const response = await fetch(`https://api.npmjs.org/downloads/point/${from}:${through}/agentation`, { signal });
  if (!response.ok) throw new Error("npm download count unavailable");
  const data = await response.json();
  const downloads = DOWNLOAD_SNAPSHOT.downloads + data.downloads;
  // npm can clamp long ranges. An incomplete range must not reduce the total.
  if (data.start !== from || data.end !== through || !Number.isSafeInteger(data.downloads) ||
      data.downloads < 0 || !Number.isSafeInteger(downloads)) {
    throw new Error("Incomplete npm download range");
  }
  return { downloads, end: through };
}
