import { describe, expect, test } from "bun:test"
import { writeWithDeadline } from "./sse.js"

const bytes = new Uint8Array([1])

describe("writeWithDeadline", () => {
  test("accepts a write that settles in time", async () => {
    let writes = 0
    const alive = await writeWithDeadline({ write: async () => { writes++ } }, bytes, 50)
    expect(alive).toBe(true)
    expect(writes).toBe(1)
  })

  test("rejects a stream that reports the write failed", async () => {
    const alive = await writeWithDeadline({
      write: async () => { throw new Error("closed") },
    }, bytes, 50)
    expect(alive).toBe(false)
  })

  test("rejects a writer that throws synchronously", async () => {
    const alive = await writeWithDeadline({
      write: () => { throw new Error("closed") },
    }, bytes, 50)
    expect(alive).toBe(false)
  })

  test("rejects a write that never settles", async () => {
    const started = Date.now()
    const alive = await writeWithDeadline({ write: () => new Promise(() => {}) }, bytes, 20)
    expect(alive).toBe(false)
    expect(Date.now() - started).toBeGreaterThanOrEqual(15)
  })

  test("handles a late rejection after the deadline", async () => {
    let reject: (error: Error) => void = () => undefined
    const pending = new Promise<never>((_, rejectPromise) => { reject = rejectPromise })
    const alive = await writeWithDeadline({ write: () => pending }, bytes, 10)
    expect(alive).toBe(false)
    reject(new Error("late failure"))
    await new Promise((resolve) => setTimeout(resolve, 1))
  })
})
