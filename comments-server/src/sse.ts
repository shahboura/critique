// SSE writes must not hang forever on a stream whose client is gone. The
// Durable Object never sees an abort for a proxied stream, and a write to a
// dead writer can stay pending, so callers need a deadline to reap it.

type ByteWriter = { write(chunk: Uint8Array): Promise<unknown> }

/** Resolves false when the write does not settle before the deadline. */
export function writeWithDeadline(
  writer: ByteWriter,
  bytes: Uint8Array,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    let write: Promise<unknown>
    try {
      write = writer.write(bytes)
    } catch {
      clearTimeout(timer)
      resolve(false)
      return
    }
    Promise.resolve(write).then(
      () => {
        clearTimeout(timer)
        resolve(true)
      },
      () => {
        clearTimeout(timer)
        resolve(false)
      },
    )
  })
}
