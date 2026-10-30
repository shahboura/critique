// Test server: serves the fixture and the built widget, and proxies /a/* to the
// local wrangler worker so the page and the API share one origin (cookies, SSE).
import { join } from "node:path"

const root = import.meta.dir
const page = Bun.file(join(root, "fixture.html"))
const widget = Bun.file(join(root, "..", "cli", "public", "agentation-widget.js"))

Bun.serve({
  port: 4173,
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } })
    }
    if (url.pathname === "/agentation-widget.js") {
      return new Response(widget, { headers: { "content-type": "text/javascript; charset=utf-8" } })
    }
    if (url.pathname.startsWith("/a/") || url.pathname === "/a") {
      const target = `http://127.0.0.1:8787${url.pathname}${url.search}`
      const headers = new Headers(request.headers)
      headers.delete("host")
      headers.delete("connection")
      headers.delete("transfer-encoding")
      const upstream = await fetch(target, {
        method: request.method,
        headers,
        signal: request.signal,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      })
      return new Response(upstream.body, { status: upstream.status, headers: upstream.headers })
    }
    // Any other path serves the fixture, so each test gets a unique pathname and
    // therefore an isolated localStorage key.
    return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } })
  },
})

console.log("e2e server listening on http://127.0.0.1:4173")
