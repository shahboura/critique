import { useCallback, useSyncExternalStore } from "react";

export function usePagePath(useHashLocation: boolean): string {
  const subscribe = useCallback((notify: () => void) => {
    if (!useHashLocation) return () => {};
    window.addEventListener("hashchange", notify);
    window.addEventListener("popstate", notify);
    return () => {
      window.removeEventListener("hashchange", notify);
      window.removeEventListener("popstate", notify);
    };
  }, [useHashLocation]);
  return useSyncExternalStore(subscribe,
    () => window.location.pathname + (useHashLocation ? window.location.hash : ""),
    () => "/");
}

// A route can unmount while a request is in flight, then mount again before
// the response arrives. Finish its writes before the new instance reads it.
const pending = new Map<string, Promise<void>>();
export function runPageTask<T>(key: string, work: () => Promise<T>): Promise<T> {
  const task = (pending.get(key) ?? Promise.resolve()).then(work);
  const settled = task.then(() => {}, () => {});
  pending.set(key, settled);
  void settled.then(() => {
    if (pending.get(key) === settled) pending.delete(key);
  });
  return task;
}

export function matchesPage(url: string, pathname: string, origin: string): boolean {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin && parsed.pathname + parsed.hash === pathname;
  } catch {
    return false;
  }
}
