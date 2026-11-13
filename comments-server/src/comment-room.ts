// CommentRoom — Durable Object Agent for managing annotations per room.
// Each room is identified by a key (typically a diff ID). Annotations are
// persisted as JSON blobs in SQLite with minimal indexed columns (id, timestamp, status).
// Thread messages are stored inside the annotation JSON directly.
//
// Exposes an HTTP API (onRequest) compatible with the Agentation spec,
// plus SSE streaming for real-time updates.

import { Agent } from "agents"
import { writeWithDeadline } from "./sse.js"
import {
  PATCHABLE_ANNOTATION_FIELDS,
  type RoomState,
  type Annotation,
  type ThreadMessage,
  type AgentationEvent,
  type ActionRequestedPayload,
} from "./types.js"

interface CommentRoomEnv {
  [key: string]: unknown
}

const MAX_THREAD_CONTENT_LENGTH = 10_000
// A proxied SSE request can outlive its browser, and a write to that dead
// stream can stay pending, so abort cleanup alone never fires. Ping on a timer
// and drop writers that do not accept the bytes within the deadline. The
// deadline is shorter than the heartbeat, so reaper passes cannot overlap.
const SSE_HEARTBEAT_MS = 30_000
const SSE_WRITE_TIMEOUT_MS = 10_000
const SSE_PING = new TextEncoder().encode(": ping\n\n")

export class CommentRoom extends Agent<CommentRoomEnv, RoomState> {
  initialState: RoomState = { annotations: [] }

  // shortcut: sseClients has no cap, so a public room can hold many live
  // streams; add a per-room cap and a worker-level rate limit if abuse appears.
  private sseClients = new Set<WritableStreamDefaultWriter>()
  private sseHeartbeat: ReturnType<typeof setInterval> | undefined
  private sequence = 0

  constructor(state: DurableObjectState, env: CommentRoomEnv) {
    super(state, env)
    this.emitSSE = this.emitSSE.bind(this)
    this.handleAnnotationsGet = this.handleAnnotationsGet.bind(this)
    this.handleAnnotationsPost = this.handleAnnotationsPost.bind(this)
    this.handleAnnotationGet = this.handleAnnotationGet.bind(this)
    this.handleAnnotationPatch = this.handleAnnotationPatch.bind(this)
    this.handleAnnotationDelete = this.handleAnnotationDelete.bind(this)
    this.handleThreadPost = this.handleThreadPost.bind(this)
    this.handlePending = this.handlePending.bind(this)
    this.handleActionPost = this.handleActionPost.bind(this)
    this.handleSession = this.handleSession.bind(this)
    this.handleEvents = this.handleEvents.bind(this)
  }

  async onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`

    const versionRow = this.sql<{ value: string }>`
      SELECT value FROM meta WHERE key = 'schema_version'
    `
    const schemaVersion = versionRow[0]?.value ?? "0"

    if (schemaVersion !== "2") {
      // One-time migration: drop old wide-column schema + separate thread_messages table.
      // All data was duplicated in fullJson anyway; threads are now stored inside annotation JSON.
      this.sql`DROP TABLE IF EXISTS thread_messages`
      this.sql`DROP TABLE IF EXISTS annotations`

      this.sql`
        CREATE TABLE IF NOT EXISTS annotations (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          data TEXT NOT NULL
        )
      `

      this.sql`CREATE INDEX IF NOT EXISTS idx_annotations_status ON annotations(status)`
      this.sql`INSERT INTO meta (key, value) VALUES ('schema_version', '2') ON CONFLICT(key) DO UPDATE SET value = '2'`
    }

    // Load annotations into state on startup
    const annotations = this.loadAllAnnotations()
    this.setState({ annotations })
  }

  // --- SQL helpers ---

  private loadAllAnnotations(): Annotation[] {
    const rows = this.sql<{ data: string }>`
      SELECT data FROM annotations ORDER BY timestamp ASC
    `
    return rows.map((row) => JSON.parse(row.data) as Annotation)
  }

  private loadAnnotation(id: string): Annotation | null {
    const rows = this.sql<{ data: string }>`
      SELECT data FROM annotations WHERE id = ${id}
    `
    if (rows.length === 0) return null
    return JSON.parse(rows[0].data) as Annotation
  }

  // --- Annotation CRUD ---

  createAnnotation(input: Partial<Annotation> & { comment: string }): Annotation {
    const now = new Date().toISOString()
    const annotation: Annotation = {
      id: input.id || crypto.randomUUID(),
      comment: input.comment,
      elementPath: input.elementPath || "",
      timestamp: input.timestamp || Date.now(),
      x: input.x ?? 0,
      y: input.y ?? 0,
      element: input.element || "div",
      url: input.url,
      boundingBox: input.boundingBox,
      reactComponents: input.reactComponents,
      cssClasses: input.cssClasses,
      computedStyles: input.computedStyles,
      accessibility: input.accessibility,
      nearbyText: input.nearbyText,
      selectedText: input.selectedText,
      fullPath: input.fullPath,
      nearbyElements: input.nearbyElements,
      isFixed: input.isFixed,
      isMultiSelect: input.isMultiSelect,
      intent: input.intent,
      severity: input.severity,
      status: input.status || "pending",
      resolvedAt: input.resolvedAt,
      resolvedBy: input.resolvedBy,
      authorId: input.authorId,
      userName: input.userName,
      anchor: input.anchor,
      sessionId: input.sessionId,
      createdAt: now,
      updatedAt: now,
    }

    // Idempotent create: a retried POST with the same id keeps the first row and
    // must not duplicate in-memory state or emit a second annotation.created.
    const inserted = this.sql<{ id: string }>`
      INSERT INTO annotations (id, timestamp, status, data)
      VALUES (${annotation.id}, ${annotation.timestamp}, ${annotation.status ?? null}, ${JSON.stringify(annotation)})
      ON CONFLICT(id) DO NOTHING
      RETURNING id
    `

    if (inserted.length === 0) {
      const existing = this.loadAnnotation(annotation.id)
      if (!existing) throw new Error(`Annotation ${annotation.id} not found`)
      return existing
    }

    this.setState({
      annotations: [...this.state.annotations, annotation],
    })

    this.emitSSE("annotation.created", annotation)
    return annotation
  }

  updateAnnotation(id: string, partial: Partial<Annotation>): Annotation {
    const existing = this.loadAnnotation(id)
    if (!existing) {
      throw new Error(`Annotation ${id} not found`)
    }

    // The public proxy already filters, but the DO is a trust boundary too:
    // identity, session, thread and timestamps must not be client-writable.
    const allowed = new Set<string>(PATCHABLE_ANNOTATION_FIELDS)
    const patch = Object.fromEntries(
      Object.entries(partial).filter(([key]) => allowed.has(key)),
    ) as Partial<Annotation>

    const now = new Date().toISOString()
    const updated: Annotation = { ...existing, ...patch, id, updatedAt: now }

    this.sql`
      UPDATE annotations
      SET status = ${updated.status ?? null},
          data = ${JSON.stringify(updated)}
      WHERE id = ${id}
    `

    this.setState({
      annotations: this.state.annotations.map((a) =>
        a.id === id ? updated : a,
      ),
    })

    this.emitSSE("annotation.updated", updated)
    return updated
  }

  deleteAnnotation(id: string): void {
    const existing = this.loadAnnotation(id)
    if (!existing) {
      throw new Error(`Annotation ${id} not found`)
    }

    this.sql`DELETE FROM annotations WHERE id = ${id}`

    this.setState({
      annotations: this.state.annotations.filter((a) => a.id !== id),
    })

    this.emitSSE("annotation.deleted", { id } as Annotation)
  }

  addThreadMessage(annotationId: string, input: { role: "human" | "agent"; content: string }): ThreadMessage {
    // Thread messages are rendered as markdown for agents, so keep both fields
    // inside the shapes the UI expects. Throwing TypeError maps to HTTP 400.
    if (input?.role !== "human" && input?.role !== "agent") {
      throw new TypeError("role must be \"human\" or \"agent\"")
    }
    if (typeof input.content !== "string" || input.content.length === 0 || input.content.length > MAX_THREAD_CONTENT_LENGTH) {
      throw new TypeError(`content must be a non-empty string of at most ${MAX_THREAD_CONTENT_LENGTH} characters`)
    }

    const existing = this.loadAnnotation(annotationId)
    if (!existing) {
      throw new Error(`Annotation ${annotationId} not found`)
    }

    const msg: ThreadMessage = {
      id: crypto.randomUUID(),
      role: input.role,
      content: input.content,
      timestamp: Date.now(),
    }

    const now = new Date().toISOString()
    const updated: Annotation = {
      ...existing,
      thread: [...(existing.thread || []), msg],
      updatedAt: now,
    }

    this.sql`
      UPDATE annotations
      SET data = ${JSON.stringify(updated)}
      WHERE id = ${annotationId}
    `

    this.setState({
      annotations: this.state.annotations.map((a) =>
        a.id === annotationId ? updated : a,
      ),
    })

    this.emitSSE("thread.message", msg)
    return msg
  }

  // --- SSE ---

  private startSSEHeartbeat(): void {
    if (this.sseHeartbeat !== undefined) return
    this.sseHeartbeat = setInterval(() => {
      void this.reapSSEClients()
    }, SSE_HEARTBEAT_MS)
  }

  private stopSSEHeartbeat(): void {
    if (this.sseHeartbeat === undefined) return
    clearInterval(this.sseHeartbeat)
    this.sseHeartbeat = undefined
  }

  private removeSSEClient(writer: WritableStreamDefaultWriter): void {
    if (!this.sseClients.delete(writer)) return
    // close() waits for queued writes, and the write that timed out never
    // drains on a dead client; abort discards the queue and ends the response.
    writer.abort(new Error("sse client gone")).catch(() => undefined)
    if (this.sseClients.size === 0) this.stopSSEHeartbeat()
  }

  // shortcut: one missed ping removes the writer. A client that cannot drain
  // 8 bytes for 10s is effectively gone; EventSource reconnects, but events
  // emitted in that gap are not replayed.
  private async reapSSEClients(): Promise<void> {
    await Promise.all([...this.sseClients].map(async (writer) => {
      if (!this.sseClients.has(writer)) return
      if (!(await writeWithDeadline(writer, SSE_PING, SSE_WRITE_TIMEOUT_MS))) {
        this.removeSSEClient(writer)
      }
    }))
    if (this.sseClients.size === 0) this.stopSSEHeartbeat()
  }

  private emitSSE(
    type: AgentationEvent["type"],
    payload: AgentationEvent["payload"],
  ): number {
    this.sequence++
    const event: AgentationEvent = {
      type,
      timestamp: new Date().toISOString(),
      sessionId: this.name,
      sequence: this.sequence,
      payload,
    }
    const data = `event: ${type}\ndata: ${JSON.stringify(event)}\nid: ${this.sequence}\n\n`
    const encoded = new TextEncoder().encode(data)
    const activeWriters = Array.from(this.sseClients)
    for (const writer of activeWriters) {
      // Only the ping judges liveness: a payload write on a slow client can
      // legitimately take longer than the ping deadline. A dead writer's write
      // never settles and is reaped by the heartbeat.
      writer.write(encoded).catch(() => this.removeSSEClient(writer))
    }
    return activeWriters.length
  }

  // --- HTTP API (onRequest) ---

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // GET /api/annotations — list all
    if (path === "/api/annotations" && method === "GET") {
      return this.handleAnnotationsGet()
    }

    // POST /api/annotations — create
    if (path === "/api/annotations" && method === "POST") {
      return this.handleAnnotationsPost(request)
    }

    // GET /api/annotations/:id
    const annotationMatch = path.match(/^\/api\/annotations\/([^/]+)$/)
    if (annotationMatch && method === "GET") {
      return this.handleAnnotationGet(annotationMatch[1])
    }

    // PATCH /api/annotations/:id
    if (annotationMatch && method === "PATCH") {
      return this.handleAnnotationPatch(annotationMatch[1], request)
    }

    // DELETE /api/annotations/:id
    if (annotationMatch && method === "DELETE") {
      return this.handleAnnotationDelete(annotationMatch[1])
    }

    // POST /api/annotations/:id/thread
    const threadMatch = path.match(/^\/api\/annotations\/([^/]+)\/thread$/)
    if (threadMatch && method === "POST") {
      return this.handleThreadPost(threadMatch[1], request)
    }

    // GET /api/pending
    if (path === "/api/pending" && method === "GET") {
      return this.handlePending()
    }

    // POST /api/action
    if (path === "/api/action" && method === "POST") {
      return this.handleActionPost(request)
    }

    // GET /api/session
    if (path === "/api/session" && method === "GET") {
      return this.handleSession()
    }

    // GET /api/events — SSE
    if (path === "/api/events" && method === "GET") {
      return this.handleEvents(request)
    }

    return new Response("Not found", { status: 404 })
  }

  private handleAnnotationsGet(): Response {
    const annotations = this.loadAllAnnotations()
    return Response.json(annotations)
  }

  private async handleAnnotationsPost(request: Request): Promise<Response> {
    const body = await request.json() as Partial<Annotation> & { comment: string }
    const annotation = this.createAnnotation(body)
    return Response.json(annotation, { status: 201 })
  }

  private handleAnnotationGet(id: string): Response {
    const annotation = this.loadAnnotation(id)
    if (!annotation) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }
    return Response.json(annotation)
  }

  private async handleAnnotationPatch(id: string, request: Request): Promise<Response> {
    try {
      const body = await request.json() as Partial<Annotation>
      const updated = this.updateAnnotation(id, body)
      return Response.json(updated)
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 404 })
    }
  }

  private handleAnnotationDelete(id: string): Response {
    try {
      this.deleteAnnotation(id)
      return Response.json({ success: true })
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 404 })
    }
  }

  private async handleThreadPost(annotationId: string, request: Request): Promise<Response> {
    const body = await request
      .json<{ role: "human" | "agent"; content: string } | null>()
      .catch(() => null)
    if (!body) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const msg = this.addThreadMessage(annotationId, body)
      return Response.json(msg, { status: 201 })
    } catch (error) {
      const status = error instanceof TypeError ? 400 : 404
      return Response.json({ error: (error as Error).message }, { status })
    }
  }

  private handlePending(): Response {
    const pending = this.state.annotations.filter((a) => a.status === "pending")
    return Response.json({ count: pending.length, annotations: pending })
  }

  private async handleActionPost(request: Request): Promise<Response> {
    let output = ""
    try {
      const body = await request.json() as { output?: unknown }
      if (typeof body.output === "string") {
        output = body.output
      }
    } catch {
      // Empty or malformed JSON body is treated as empty output.
    }

    const annotationCount = this.state.annotations.length
    const payload: ActionRequestedPayload = {
      output,
      annotationCount,
    }
    const sseListeners = this.emitSSE("action.requested", payload)

    return Response.json({
      success: true,
      annotationCount,
      delivered: {
        sseListeners,
        webhooks: 0,
        total: sseListeners,
      },
    })
  }

  private handleSession(): Response {
    const now = new Date().toISOString()
    return Response.json({
      id: this.name,
      status: "active",
      createdAt: now,
      updatedAt: now,
      annotations: this.state.annotations,
    })
  }

  private handleEvents(request: Request): Response {
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    this.sseClients.add(writer)
    this.startSSEHeartbeat()

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      request.signal.removeEventListener("abort", cleanup)
      this.removeSSEClient(writer)
    }
    request.signal.addEventListener("abort", cleanup, { once: true })

    // Send initial connection event
    const connectEvent = `event: connected\ndata: ${JSON.stringify({ sessionId: this.name })}\n\n`
    void writeWithDeadline(writer, new TextEncoder().encode(connectEvent), SSE_WRITE_TIMEOUT_MS)
      .then((alive) => {
        if (!alive) cleanup()
      })
      .catch(() => cleanup())

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  }
}
