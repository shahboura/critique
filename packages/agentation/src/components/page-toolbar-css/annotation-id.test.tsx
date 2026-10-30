import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { PageFeedbackToolbarCSS } from "./index";
import * as timing from "../../utils/freeze-animations";
import { loadAnnotations, saveAnnotations } from "../../utils/storage";
import type { Annotation } from "../../types";

const pathname = "/annotation-id-test";
const root = () => within(document.querySelector("agentation-toolbar")!.shadowRoot! as unknown as HTMLElement);
const note = (id: string): Annotation => ({ id, x: 20, y: 50, comment: "Keep", element: "button", elementPath: "#target", timestamp: Date.now(), status: "pending" });
const response = (data: unknown) => Promise.resolve({ ok: true, json: async () => data });
class Source extends EventTarget {
  static instances: Source[] = [];
  static CLOSED = 2;
  readyState = 1;
  constructor(public url: string) { super(); Source.instances.push(this); }
  close() { this.readyState = 2; }
}
const postBody = (options?: RequestInit) => JSON.parse(String(options?.body)) as Annotation;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  history.replaceState(null, "", pathname);
  Source.instances = [];
  vi.stubGlobal("EventSource", Source);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(timing, "originalSetInterval").mockImplementation(() => setInterval(() => {}, 60000));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState(null, "", "/"); });

it("keeps one annotation when created arrives before the POST response resolves", async () => {
  let finishUpload!: (value: unknown) => void;
  const uploading = new Promise(resolve => { finishUpload = resolve; });
  let posted: Annotation | undefined;
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith("/sessions/session/annotations")) {
      posted = postBody(options);
      return uploading;
    }
    return response(url.endsWith("/health") ? {} : { id: "session", annotations: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<><p>Target</p><PageFeedbackToolbarCSS endpoint="http://dup.test" sessionId="session" /></>);
  await waitFor(() => expect(Source.instances).toHaveLength(1));
  const target = document.querySelector("p")!;
  document.elementFromPoint = () => target;
  document.elementsFromPoint = () => [target, document.body];
  fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
  fireEvent.click(target, { clientX: 10, clientY: 10 });
  fireEvent.change(root().getByRole("textbox"), { target: { value: "Fix this line" } });
  fireEvent.click(root().getByRole("button", { name: "Add" }));
  await waitFor(() => expect(posted).toBeDefined());

  // The server keeps a client id that already routes to this session.
  expect(posted!.id.startsWith("session_")).toBe(true);

  // The room emits the created event before the POST response reaches us.
  const created = { ...posted!, createdAt: new Date().toISOString() };
  await act(async () => {
    Source.instances[0].dispatchEvent(new MessageEvent("annotation.created", { data: JSON.stringify({ payload: created }) }));
  });
  await act(async () => finishUpload({ ok: true, json: async () => created }));

  await waitFor(() => expect(loadAnnotations<Annotation>(pathname)).toHaveLength(1));
  expect(loadAnnotations<Annotation>(pathname).map(a => a.id)).toEqual([posted!.id]);
});

it("does not re-upload or duplicate a note the server already has under its prefixed id", async () => {
  saveAnnotations(pathname, [note("123")]);
  const stored = { ...note("123"), id: "session_123", sessionId: "session" };
  const posted: Annotation[] = [];
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith("/annotations")) {
      posted.push(postBody(options));
      return response(postBody(options));
    }
    return response(url.endsWith("/health") ? {} : { id: "session", annotations: [stored] });
  }));
  render(<PageFeedbackToolbarCSS endpoint="http://dup.test" sessionId="session" />);
  await waitFor(() => expect(Source.instances).toHaveLength(1));
  await waitFor(() => expect(loadAnnotations<Annotation>(pathname).map(a => a.id)).toEqual(["session_123"]));
  expect(posted).toHaveLength(0);
});

it("captures the nearest data-anchor on a created annotation", async () => {
  const posted: Annotation[] = [];
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith("/sessions/session/annotations")) {
      const body = postBody(options);
      posted.push(body);
      return response(body);
    }
    return response(url.endsWith("/health") ? {} : { id: "session", annotations: [] });
  }));
  render(<>
    <div data-anchor="cli/src/cli.tsx:42"><p>Target</p></div>
    <PageFeedbackToolbarCSS endpoint="http://anchor.test" sessionId="session" />
  </>);
  await waitFor(() => expect(Source.instances).toHaveLength(1));
  const target = document.querySelector("p")!;
  document.elementFromPoint = () => target;
  document.elementsFromPoint = () => [target, document.body];
  fireEvent.keyDown(document, { key: "f", ctrlKey: true, shiftKey: true });
  fireEvent.click(target, { clientX: 10, clientY: 10 });
  fireEvent.change(root().getByRole("textbox"), { target: { value: "Fix this line" } });
  fireEvent.click(root().getByRole("button", { name: "Add" }));
  await waitFor(() => expect(posted).toHaveLength(1));
  expect(posted[0].anchor).toBe("cli/src/cli.tsx:42");
});

it("adds a note created elsewhere and removes one deleted elsewhere", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) =>
    response(url.endsWith("/health") ? {} : { id: "session", annotations: [] })));
  render(<PageFeedbackToolbarCSS endpoint="http://live.test" sessionId="session" />);
  await waitFor(() => expect(Source.instances).toHaveLength(1));
  fireEvent.click(root().getByRole("button", { name: "Start feedback mode" }));
  const markers = () => document.querySelector("agentation-toolbar")!.shadowRoot!
    .querySelectorAll("[data-annotation-marker]");

  await act(async () => {
    Source.instances[0].dispatchEvent(new MessageEvent("annotation.created", {
      data: JSON.stringify({ payload: note("remote-note") }),
    }));
  });
  await waitFor(() => expect(loadAnnotations<Annotation>(pathname).map(a => a.id)).toEqual(["remote-note"]));
  await waitFor(() => expect(markers()).toHaveLength(1));

  await act(async () => {
    Source.instances[0].dispatchEvent(new MessageEvent("annotation.deleted", {
      data: JSON.stringify({ payload: { id: "remote-note" } }),
    }));
  });
  await waitFor(() => expect(loadAnnotations<Annotation>(pathname)).toEqual([]));
  await waitFor(() => expect(markers()).toHaveLength(0));
});

it("prefixes a note saved before the session existed when it is uploaded", async () => {
  saveAnnotations(pathname, [note("123")]);
  const posted: Annotation[] = [];
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith("/sessions")) return response({ id: "fresh-session", url: pathname });
    if (url.endsWith("/annotations")) {
      const body = postBody(options);
      posted.push(body);
      return response(body);
    }
    return response({});
  }));
  render(<PageFeedbackToolbarCSS endpoint="http://dup.test" />);
  await waitFor(() => expect(posted).toHaveLength(1));
  expect(posted[0].id).toBe("fresh-session_123");
  expect(loadAnnotations<Annotation>(pathname).map(a => a.id)).toEqual(["fresh-session_123"]);
});

it("does not duplicate the live created event of a note this tab is uploading", async () => {
  saveAnnotations(pathname, [note("123")]);
  let finishUpload!: (value: unknown) => void;
  const uploading = new Promise(resolve => { finishUpload = resolve; });
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith("/sessions")) return response({ id: "fresh-session", url: pathname });
    if (url.endsWith("/annotations")) return uploading;
    return response(url.endsWith("/health") ? {} : { id: "fresh-session", annotations: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<PageFeedbackToolbarCSS endpoint="http://dup.test" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "http://dup.test/sessions/fresh-session/annotations", expect.objectContaining({ method: "POST" })));
  await waitFor(() => expect(Source.instances).toHaveLength(1));

  // The room broadcasts the prefixed id before the upload response arrives.
  const uploaded = { ...note("123"), id: "fresh-session_123" };
  await act(async () => {
    Source.instances[0].dispatchEvent(new MessageEvent("annotation.created", { data: JSON.stringify({ payload: uploaded }) }));
  });
  expect(loadAnnotations<Annotation>(pathname).map(a => a.id)).toEqual(["123"]);

  await act(async () => finishUpload({ ok: true, json: async () => uploaded }));
  await waitFor(() => expect(loadAnnotations<Annotation>(pathname).map(a => a.id)).toEqual(["fresh-session_123"]));
});
