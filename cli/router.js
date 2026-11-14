// Serves the three static files the diff pages reference, then forwards
// everything else to the worker. workerd's disk service returns
// application/octet-stream, so set the types here.
const TYPES = {
  "/agentation-widget.js": "text/javascript; charset=utf-8",
  "/jetbrains-mono-nerd.woff2": "font/woff2",
  "/third-party-licenses.txt": "text/plain; charset=utf-8",
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    const type = TYPES[path]
    if (!type) return env.MAIN.fetch(request)

    const response = await env.ASSETS.fetch(request)
    if (!response.ok) return env.MAIN.fetch(request)
    const headers = new Headers(response.headers)
    headers.set("Content-Type", type)
    headers.set("Cache-Control", "public, max-age=604800")
    return new Response(response.body, { status: response.status, headers })
  },
}
