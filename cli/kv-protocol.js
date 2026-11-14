// Implements the HTTP protocol that workerd's `kvNamespace` binding speaks.
// Storage is injected so the protocol can be unit-tested without workerd.
//
// store.get(key) -> { value: Uint8Array, metadata: string | null, expiration: number | null } | null
// store.put(key, entry)
// store.delete(key)
const MAX_KEY_BYTES = 512
const MAX_VALUE_BYTES = 25 * 1024 * 1024

function decodeKey(pathname) {
  const raw = pathname.slice(1)
  if (raw === "") return ""
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

function expirationFrom(url, nowMs) {
  const ttl = url.searchParams.get("expiration_ttl")
  if (ttl !== null) {
    const seconds = Number.parseInt(ttl, 10)
    return Number.isFinite(seconds) && seconds > 0 ? nowMs + seconds * 1000 : null
  }
  const absolute = url.searchParams.get("expiration")
  if (absolute !== null) {
    const seconds = Number.parseInt(absolute, 10)
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null
  }
  return undefined
}

export function createKvHandler(store, now = () => Date.now()) {
  return async function handle(request) {
    const { pathname } = new URL(request.url)

    // The app does not use list or bulk get. Fail loudly instead of returning
    // an empty result if a future caller starts relying on them.
    if ((pathname === "/" && request.method === "GET") || pathname === "/bulk/get") {
      return new Response("Unsupported KV operation", { status: 501 })
    }

    const key = decodeKey(pathname)
    if (key === null) return new Response("Invalid key", { status: 400 })

    if (request.method === "PUT") {
      if (key === "" || key === "." || key === "..") {
        return new Response("Invalid key", { status: 400 })
      }
      if (new TextEncoder().encode(key).byteLength > MAX_KEY_BYTES) {
        return new Response("Key too long", { status: 414 })
      }

      const expiration = expirationFrom(new URL(request.url), now())
      if (expiration === null) return new Response("Invalid expiration", { status: 400 })

      const declared = Number(request.headers.get("content-length"))
      if (Number.isFinite(declared) && declared > MAX_VALUE_BYTES) {
        return new Response("Value too large", { status: 413 })
      }
      const value = new Uint8Array(await request.arrayBuffer())
      if (value.byteLength > MAX_VALUE_BYTES) {
        return new Response("Value too large", { status: 413 })
      }

      store.put(key, {
        value,
        metadata: request.headers.get("CF-KV-Metadata"),
        expiration: expiration ?? null,
      })
      return new Response()
    }

    if (request.method === "DELETE") {
      store.delete(key)
      return new Response()
    }

    if (request.method === "GET") {
      if (key === "") return new Response("Invalid key", { status: 400 })
      const entry = store.get(key)
      if (!entry) return new Response("Not Found", { status: 404 })
      if (entry.expiration !== null && entry.expiration <= now()) {
        store.delete(key)
        return new Response("Not Found", { status: 404 })
      }

      const headers = new Headers()
      if (entry.metadata !== null) headers.set("CF-KV-Metadata", entry.metadata)
      if (entry.expiration !== null) {
        headers.set("CF-Expiration", String(Math.floor(entry.expiration / 1000)))
      }
      return new Response(entry.value, { headers })
    }

    return new Response("Method Not Allowed", { status: 405 })
  }
}
