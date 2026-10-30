// Route: GET /v/:id/annotations
// Returns all annotations as markdown, matching agentation's generateOutput format.
// This is the format agents and LLMs consume best.

import { Hono } from "hono"
import type { KVNamespace } from "@cloudflare/workers-types"
import { checkDiffAccess, DIFF_ID_REGEX, PASSWORD_HEADER } from "../diff-password.js"

type Bindings = {
  CRITIQUE_KV: KVNamespace
  PUBLIC_URL?: string
  CommentRoom: {
    idFromName(name: string): { toString(): string }
    get(id: { toString(): string }): {
      fetch(request: Request): Promise<Response>
    }
  }
}

type AnnotationData = {
  id: string
  comment: string
  element: string
  elementPath: string
  nearbyText?: string
  selectedText?: string
  anchor?: string
  intent?: string
  severity?: string
  status?: string
  authorId?: string
  userName?: string
  createdAt?: string
  thread?: Array<{ role: string; content: string; timestamp: number }>
}

// Every free-text field below comes from a client POST, so it is untrusted:
// collapse CR/LF and other control characters so a note cannot forge markdown
// headings, list items or fields, and cannot inject lines.
function oneLine(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ")
}

// file:line or file:line-line, no whitespace, no colon in the path.
const ANCHOR_REGEX = /^[^\s:]+:\d+(-\d+)?$/

function generateMarkdown(
  annotations: AnnotationData[],
  diffUrl: string,
): string {
  if (annotations.length === 0) return "No annotations yet.\n"

  let output = `## Page Feedback: ${diffUrl}\n\n`

  for (let i = 0; i < annotations.length; i++) {
    const a = annotations[i]!
    output += `### ${i + 1}. ${oneLine(a.element || a.elementPath)}\n`
    if (a.elementPath) {
      output += `**Location:** ${oneLine(a.elementPath)}\n`
    }
    const anchor = oneLine(a.anchor)
    if (ANCHOR_REGEX.test(anchor)) {
      output += `**Anchor:** ${anchor}\n`
    }
    if (a.selectedText) {
      output += `**Selected text:** "${oneLine(a.selectedText)}"\n`
    }
    if (a.nearbyText && !a.selectedText) {
      output += `**Context:** ${oneLine(a.nearbyText).slice(0, 100)}\n`
    }
    if (a.status && a.status !== "pending") {
      output += `**Status:** ${oneLine(a.status)}\n`
    }
    if (a.severity) {
      output += `**Severity:** ${oneLine(a.severity)}\n`
    }
    if (a.intent) {
      output += `**Intent:** ${oneLine(a.intent)}\n`
    }
    output += `**Feedback:** ${oneLine(a.comment)}\n`
    if (a.thread && a.thread.length > 0) {
      output += "\n"
      for (const msg of a.thread) {
        output += `> **${oneLine(msg.role)}:** ${oneLine(msg.content)}\n`
      }
    }
    output += "\n"
  }

  return output.trim() + "\n"
}

const route = new Hono<{ Bindings: Bindings }>()

route.get("/v/:id/annotations", async (c) => {
  const id = c.req.param("id")

  if (!id || !DIFF_ID_REGEX.test(id)) {
    return c.text("Invalid ID", 400)
  }

  const access = await checkDiffAccess(c, id)
  if (!access.allowed) {
    return c.text(`Password required. Send it in the ${PASSWORD_HEADER} header.`, 401)
  }

  // Fetch annotations from CommentRoom DO
  // x-partykit-room header required by agents SDK (partyserver) to initialize DO name
  const doId = c.env.CommentRoom.idFromName(id)
  const stub = c.env.CommentRoom.get(doId)
  const req = new Request("https://internal/api/annotations")
  req.headers.set("x-partykit-room", id)
  const resp = await stub.fetch(req)
  const annotations = (await resp.json()) as AnnotationData[]

  const origin = (c.env.PUBLIC_URL || new URL(c.req.url).origin).replace(/\/+$/, "")
  const diffUrl = `${origin}/v/${id}`
  const markdown = generateMarkdown(annotations, diffUrl)

  return c.text(markdown, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
  })
})

export { route as annotationsContextRoute }
