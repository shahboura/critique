import { afterEach, expect, test, vi } from "vitest";
import { DOWNLOAD_SNAPSHOT, fetchDownloadTotal } from "./downloads";

afterEach(() => vi.unstubAllGlobals());

test("uses the verified baseline before another complete day is available", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await fetchDownloadTotal(new AbortController().signal, new Date("2026-09-20T12:00:00Z"))).toEqual(DOWNLOAD_SNAPSHOT);
  expect(fetch).not.toHaveBeenCalled();
});

test("adds complete days directly from npm on the static website", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ start: "2026-09-20", end: "2026-09-21", downloads: 500 }) });
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  expect(await fetchDownloadTotal(signal, new Date("2026-09-22T12:00:00Z"))).toEqual({ downloads: DOWNLOAD_SNAPSHOT.downloads + 500, end: "2026-09-21" });
  expect(fetch).toHaveBeenCalledWith("https://api.npmjs.org/downloads/point/2026-09-20:2026-09-21/agentation", { signal });
});

test.each([
  { start: "2026-09-19", end: "2026-09-21", downloads: 100 },
  { start: "2026-09-20", end: "2026-09-20", downloads: 100 },
  { start: "2026-09-20", end: "2026-09-21", downloads: -1 },
  { start: "2026-09-20", end: "2026-09-21", downloads: "100" },
  { start: "2026-09-20", end: "2026-09-21", downloads: Number.MAX_SAFE_INTEGER },
])("rejects incomplete or invalid totals: %j", async data => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  await expect(fetchDownloadTotal(new AbortController().signal, new Date("2026-09-22T12:00:00Z"))).rejects.toThrow("Incomplete npm download range");
});
