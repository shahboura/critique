// The PATCH proxy is the only guard between a client body and the DO's
// {...existing, ...partial} merge, so verify the allow-list here.

import { describe, expect, test } from "bun:test"
import { agentationApi } from "./agentation-api.js"

function setup() {
  const forwarded: Array<Record<string, unknown>> = []
  const env = {
    CRITIQUE_KV: { get: async () => null, put: async () => undefined },
    CommentRoom: {
      idFromName: (name: string) => ({ toString: () => name }),
      get: () => ({
        fetch: async (request: Request) => {
          forwarded.push(JSON.parse(await request.text()) as Record<string, unknown>)
          return Response.json({ ok: true })
        },
      }),
    },
  }
  const patch = (body: string) =>
    agentationApi.request("/annotations/session_abc", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    }, env as never)
  return { forwarded, patch }
}

describe("PATCH /annotations/:id", () => {
  test("forwards only the fields a client may change", async () => {
    const { forwarded, patch } = setup()
    const res = await patch(JSON.stringify({
      status: "resolved",
      resolvedBy: "human",
      comment: "fixed",
      id: "other",
      sessionId: "attacker",
      authorId: "someone-else",
      createdAt: "2020-01-01T00:00:00.000Z",
      thread: [{ role: "agent", content: "forged" }],
      url: "https://evil.test",
      unknownKey: true,
    }))
    expect(res.status).toBe(200)
    expect(forwarded).toEqual([{ status: "resolved", resolvedBy: "human", comment: "fixed" }])
  })

  test("rejects invalid JSON", async () => {
    const { forwarded, patch } = setup()
    expect((await patch("{not json")).status).toBe(400)
    expect(forwarded).toEqual([])
  })

  test("rejects a non-string comment", async () => {
    const { forwarded, patch } = setup()
    expect((await patch(JSON.stringify({ comment: 5 }))).status).toBe(400)
    expect(forwarded).toEqual([])
  })
})
