import type { Annotation } from "../types";
import { originalSetInterval, originalSetTimeout } from "./freeze-animations";

/** Keep terminal annotation statuses current even if a proxy silently loses SSE. */
export function subscribeSessionResolutions(
  endpoint: string,
  sessionId: string,
  hasPending: () => boolean,
  onResolved: (annotation: Annotation) => void,
  onLive: {
    created?: (annotation: Annotation) => void;
    deleted?: (id: string) => void;
  } = {},
) {
  let disposed = false;
  let disconnect: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = 1000;
  let request: AbortController | undefined;
  const apply = (annotation: Annotation) => {
    if (!disposed && (annotation?.status === "resolved" || annotation?.status === "dismissed")) {
      onResolved(annotation);
    }
  };
  const reconcile = async () => {
    if (disposed || request || !hasPending()) return;
    const current = new AbortController();
    request = current;
    const timeout = originalSetTimeout(() => current.abort(), 5000);
    try {
      const response = await fetch(`${endpoint}/sessions/${sessionId}`, { signal: current.signal });
      if (!response.ok) return;
      const session = await response.json();
      if (!disposed && !current.signal.aborted && Array.isArray(session.annotations)) {
        session.annotations.forEach(apply);
      }
    } catch {
      // Keep local work intact and retry at the next check.
    } finally {
      clearTimeout(timeout);
      if (request === current) request = undefined;
    }
  };
  const connect = () => {
    if (disposed) return;
    const source = new EventSource(`${endpoint}/sessions/${sessionId}/events`);
    const open = () => { retryDelay = 1000; void reconcile(); };
    const update = (event: Event) => {
      try { apply(JSON.parse((event as MessageEvent).data).payload); } catch { /* Ignore malformed events. */ }
    };
    const live = (event: Event, handle: (annotation: Annotation) => void) => {
      try {
        const { payload } = JSON.parse((event as MessageEvent).data);
        if (!disposed && payload?.id) handle(payload);
      } catch { /* Ignore malformed events. */ }
    };
    const created = (event: Event) => live(event, annotation => onLive.created?.(annotation));
    const deleted = (event: Event) => live(event, annotation => onLive.deleted?.(annotation.id));
    const error = () => {
      // CONNECTING retries are handled natively. A terminal HTTP error leaves
      // EventSource CLOSED, so recovery requires a new instance.
      if (source.readyState !== EventSource.CLOSED || disposed || retry !== undefined) return;
      disconnect?.();
      retry = originalSetTimeout(() => { retry = undefined; connect(); }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10000);
    };
    source.addEventListener("open", open);
    source.addEventListener("annotation.updated", update);
    source.addEventListener("annotation.created", created);
    source.addEventListener("annotation.deleted", deleted);
    source.addEventListener("error", error);
    disconnect = () => {
      source.removeEventListener("open", open);
      source.removeEventListener("annotation.updated", update);
      source.removeEventListener("annotation.created", created);
      source.removeEventListener("annotation.deleted", deleted);
      source.removeEventListener("error", error);
      source.close();
    };
  };
  connect();
  // Health alone cannot detect a stream left open by an intermediary. Only
  // check while this page has feedback that might have been resolved remotely.
  const interval = originalSetInterval(() => { void reconcile(); }, 10000);
  return () => {
    disposed = true;
    disconnect?.();
    if (retry !== undefined) clearTimeout(retry);
    clearInterval(interval);
    request?.abort();
  };
}
