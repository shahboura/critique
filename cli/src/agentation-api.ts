// Hono sub-app mounting the Agentation HTTP API.
// Proxies all annotation/session/SSE requests to the CommentRoom Durable Object.
// Mounted at /a in the main worker, so Agentation client calls /a/sessions/:id/annotations etc.
//
// The agents SDK (built on partyserver) requires an x-partykit-room header
// on every request to a DO stub so it can initialize its name. Without this
// header, the DO throws "Missing namespace or room headers". We inject it
// via proxyToDO() on every proxied request.

import { Hono } from "hono"
import type { Context } from "hono"
import type { KVNamespace } from "@cloudflare/workers-types"
import { checkDiffAccess, diffAccessGuard } from "./diff-password.js"
import { BUILD_ID } from "./build-info.js"
import { version as pkgVersion } from "../package.json"

type Bindings = {
  CRITIQUE_KV: KVNamespace
  CommentRoom: {
    idFromName(name: string): { toString(): string }
    get(id: { toString(): string }): {
      fetch(request: Request): Promise<Response>
    }
  }
}

const api = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>()

// Helper: proxy a request to the CommentRoom DO for a given session ID.
// Sets x-partykit-room so the agents SDK can initialize the DO name.
function proxyToDO(
  env: Bindings,
  sessionId: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const doId = env.CommentRoom.idFromName(sessionId)
  const stub = env.CommentRoom.get(doId)
  const headers = new Headers(init?.headers)
  headers.set("x-partykit-room", sessionId)
  return stub.fetch(new Request(url, { ...init, headers }))
}

// Helper: extract session ID from an annotation ID ({sessionId}_{uuid})
function parseAnnotationId(annotationId: string): { sessionId: string; rawId: string } | null {
  const idx = annotationId.indexOf("_")
  if (idx === -1) return null
  return {
    sessionId: annotationId.slice(0, idx),
    rawId: annotationId,
  }
}

const OWNER_SECRET_HEADER = "X-Critique-Owner-Secret"

// The only server-verifiable credential here is the per-diff owner secret stored at
// upload (`owner:<id>` in KV), the same one PATCH /upload/:id/og requires. Thread
// replies may claim role "agent" only when that secret matches.
async function isOwnerRequest(
  c: Context<{ Bindings: Bindings; Variables: { userId: string } }>,
  sessionId: string,
): Promise<boolean> {
  const secret = c.req.header(OWNER_SECRET_HEADER)
  if (!secret) return false
  const stored = await c.env.CRITIQUE_KV.get(`owner:${sessionId}`)
  if (!stored) return false
  // Constant-time compare; worker.tsx has the same helper but does not export it.
  if (secret.length !== stored.length) return false
  let diff = 0
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ stored.charCodeAt(i)
  return diff === 0
}

// Session IDs are diff IDs, so comments of a password protected diff need its password too.
// "/sessions/:id/*" also matches "/sessions/:id".
api.use("/sessions/:id/*", diffAccessGuard((c) => c.req.param("id")))
api.use("/annotations/:id/*", diffAccessGuard((c) => parseAnnotationId(c.req.param("id") ?? "")?.sessionId))

// Health check (Agentation polls this)
api.get("/health", (c) => c.json({
  status: "ok",
  version: pkgVersion,
  build: BUILD_ID,
}))



// Create session (Agentation calls POST /sessions with { url })
api.post("/sessions", async (c) => {
  const body = await c.req.json<{ url?: string }>()
  const url = body.url
  const match = url?.match(/\/v\/(p?[a-f0-9]{16,32})/)
  if (match?.[1] && !(await checkDiffAccess(c, match[1])).allowed) {
    return c.json({ error: "Password required" }, 401)
  }
  const sessionId = match?.[1] || crypto.randomUUID()
  const resp = await proxyToDO(c.env, sessionId, "https://internal/api/session")
  const session = await resp.json()
  return c.json({ id: sessionId, ...session as object })
})

// List sessions — return empty for v1
api.get("/sessions", (c) => {
  return c.json({ sessions: [] })
})

// Get session with all annotations
api.get("/sessions/:id", async (c) => {
  const sessionId = c.req.param("id")
  const resp = await proxyToDO(c.env, sessionId, "https://internal/api/session")
  return new Response(resp.body, resp)
})

// Create annotation within a session
api.post("/sessions/:id/annotations", async (c) => {
  const sessionId = c.req.param("id")
  const body = await c.req.json<Record<string, unknown>>()

  // Prefix annotation ID with session ID for routing
  if (typeof body.id !== "string" || !body.id.startsWith(`${sessionId}_`)) {
    body.id = `${sessionId}_${crypto.randomUUID()}`
  }
  // authorId comes from the authenticated context only. Client-supplied authorId
  // and the legacy createdBy field are accepted but can never win.
  delete body.createdBy
  body.authorId = c.get("userId")
  body.sessionId = sessionId

  const resp = await proxyToDO(c.env, sessionId, "https://internal/api/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return new Response(resp.body, resp)
})

// Submit action request for a session
api.post("/sessions/:id/action", async (c) => {
  const sessionId = c.req.param("id")
  const body = await c.req.text()
  const resp = await proxyToDO(c.env, sessionId, "https://internal/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })
  return new Response(resp.body, resp)
})

// Get annotation by ID (annotation IDs encode session: {sessionId}_{uuid})
api.get("/annotations/:id", async (c) => {
  const parsed = parseAnnotationId(c.req.param("id"))
  if (!parsed) {
    return c.json({ error: "Invalid annotation ID format" }, 400)
  }
  const resp = await proxyToDO(c.env, parsed.sessionId, `https://internal/api/annotations/${parsed.rawId}`)
  return new Response(resp.body, resp)
})

// Fields a client may PATCH. The DO merges the body into the stored row
// ({...existing, ...partial}), so anything else would let a caller rewrite
// server-owned data: authorId/sessionId (identity), createdAt, or thread
// (forging a role:"agent" reply).
const PATCHABLE_FIELDS = ["status", "comment", "resolvedAt", "resolvedBy", "intent", "severity"] as const

// Update annotation
api.patch("/annotations/:id", async (c) => {
  const parsed = parseAnnotationId(c.req.param("id"))
  if (!parsed) {
    return c.json({ error: "Invalid annotation ID format" }, 400)
  }
  const input = await c.req.json<Record<string, unknown> | null>().catch(() => null)
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return c.json({ error: "Invalid JSON body" }, 400)
  }
  const body: Record<string, unknown> = {}
  for (const field of PATCHABLE_FIELDS) {
    if (input[field] !== undefined) body[field] = input[field]
  }
  if (body.comment !== undefined && typeof body.comment !== "string") {
    return c.json({ error: "comment must be a string" }, 400)
  }
  const resp = await proxyToDO(c.env, parsed.sessionId, `https://internal/api/annotations/${parsed.rawId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return new Response(resp.body, resp)
})

// Delete annotation
api.delete("/annotations/:id", async (c) => {
  const parsed = parseAnnotationId(c.req.param("id"))
  if (!parsed) {
    return c.json({ error: "Invalid annotation ID format" }, 400)
  }
  const resp = await proxyToDO(c.env, parsed.sessionId, `https://internal/api/annotations/${parsed.rawId}`, {
    method: "DELETE",
  })
  return new Response(resp.body, resp)
})

// Thread messages
api.post("/annotations/:id/thread", async (c) => {
  const parsed = parseAnnotationId(c.req.param("id"))
  if (!parsed) {
    return c.json({ error: "Invalid annotation ID format" }, 400)
  }
  const body = await c.req.json<{ role?: unknown; content?: unknown } | null>().catch(() => null)
  if (!body) {
    return c.json({ error: "Invalid JSON body" }, 400)
  }
  // role is server-assigned: only the diff owner can post as an agent, everyone
  // else is a human.
  const role = body.role === "agent" && (await isOwnerRequest(c, parsed.sessionId)) ? "agent" : "human"
  const resp = await proxyToDO(c.env, parsed.sessionId, `https://internal/api/annotations/${parsed.rawId}/thread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, role }),
  })
  return new Response(resp.body, resp)
})

// Pending annotations for a session
api.get("/sessions/:id/pending", async (c) => {
  const sessionId = c.req.param("id")
  const resp = await proxyToDO(c.env, sessionId, "https://internal/api/pending")
  return new Response(resp.body, resp)
})



// SSE events — proxy to DO's SSE endpoint
api.get("/sessions/:id/events", async (c) => {
  const sessionId = c.req.param("id")
  const resp = await proxyToDO(c.env, sessionId, "https://internal/api/events")
  const headers = new Headers(resp.headers)
  headers.set("Content-Type", "text/event-stream")
  headers.set("Cache-Control", "no-cache")
  headers.set("Connection", "keep-alive")
  headers.set("Access-Control-Allow-Origin", "*")
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  })
})

export { api as agentationApi }
