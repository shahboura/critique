// Full self-host smoke test against a running workerd instance.
//
//   BASE_URL=http://127.0.0.1:8787 bun scripts/verify-workerd.ts
//
// Covers upload, view, raw, patch, OG, HEAD, password, markdown, large
// uploads, delete and comments. Exits non-zero on the first failed check.
import assert from "node:assert/strict"

const base = (process.env.BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "")
const expectPub = process.env.EXPECT_PUB
const owner = `owner-${crypto.randomUUID()}`
const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAFgwJ/lYxR5QAAAABJRU5ErkJggg=="

function marker(label: string): string {
  return `${label}-${crypto.randomUUID().slice(0, 8)}`
}

function htmlDocument(title: string, body: string): string {
  return `<!doctype html><html><head><title>${title}</title><meta name="viewport" content="width=device-width"></head><body>${body}</body></html>`
}

async function upload(body: Record<string, unknown>): Promise<{ id: string; url: string }> {
  const response = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Critique-Owner-Secret": owner },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  assert.equal(response.status, 200, `upload failed: ${response.status} ${text}`)
  return JSON.parse(text) as { id: string; url: string }
}

function ok(condition: boolean, message: string): void {
  assert.ok(condition, message)
  console.log(`ok ${message}`)
}

// --- health ---
const health = await fetch(`${base}/a/health`)
ok(health.status === 200, "health")

// --- static assets ---
const widget = await fetch(`${base}/agentation-widget.js`)
ok(widget.status === 200 && (widget.headers.get("content-type") ?? "").includes("javascript"), "comments widget is served")
const font = await fetch(`${base}/jetbrains-mono-nerd.woff2`)
ok(font.status === 200 && (font.headers.get("content-type") ?? "").includes("font/woff2"), "font is served")
const licenses = await fetch(`${base}/third-party-licenses.txt`)
ok(licenses.status === 200, "third-party licenses are served")

// --- upload: html, patch, OG ---
const desktop = marker("desktop")
const patch = marker("patch")
const uploaded = await upload({
  html: htmlDocument(desktop, desktop),
  patch: `diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-${patch}\n+${patch}-updated\n`,
  ogImage: SAMPLE_PNG_BASE64,
})
ok(uploaded.id.length > 0, "upload returns an id")
if (expectPub) ok(uploaded.url.startsWith(expectPub), "uploaded URL uses PUBLIC_URL")

const view = await fetch(`${base}/v/${uploaded.id}`)
const viewBody = await view.text()
ok(view.status === 200 && viewBody.includes(desktop), "view renders the uploaded html")
ok(viewBody.includes("__CRITIQUE_CONFIG__"), "view injects the comments config")

const raw = await fetch(`${base}/raw/${uploaded.id}`)
const rawBody = await raw.text()
ok(raw.status === 200 && rawBody.includes(desktop), "raw returns the stored html")

const patchResponse = await fetch(`${base}/v/${uploaded.id}.patch`)
const patchBody = await patchResponse.text()
ok(patchResponse.status === 200 && patchBody.includes(patch), "patch endpoint returns the diff")

const og = await fetch(`${base}/og/${uploaded.id}.png`)
const ogBytes = new Uint8Array(await og.arrayBuffer())
ok(og.status === 200 && Buffer.from(ogBytes).equals(Buffer.from(SAMPLE_PNG_BASE64, "base64")), "OG image round-trips")

const patchedMarker = marker("ogpatch")
const patchedUpload = await upload({ html: htmlDocument(patchedMarker, patchedMarker) })
const patchOgResponse = await fetch(`${base}/upload/${patchedUpload.id}/og`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", "X-Critique-Owner-Secret": owner },
  body: JSON.stringify({ ogImage: SAMPLE_PNG_BASE64 }),
})
ok(patchOgResponse.status === 200, "OG image can be patched after upload")
const patchedOg = await fetch(`${base}/og/${patchedUpload.id}.png`)
ok(Buffer.from(new Uint8Array(await patchedOg.arrayBuffer())).equals(Buffer.from(SAMPLE_PNG_BASE64, "base64")), "patched OG image round-trips")

const head = await fetch(`${base}/v/${uploaded.id}`, { method: "HEAD" })
ok(head.status === 200, "HEAD works")

// --- password ---
const protectedMarker = marker("protected")
const protectedUpload = await upload({
  html: htmlDocument(protectedMarker, protectedMarker),
  password: "secret",
})
ok(protectedUpload.id.startsWith("p"), "password upload uses a protected id")
const locked = await fetch(`${base}/v/${protectedUpload.id}`)
const lockedBody = await locked.text()
ok((locked.status === 401 || locked.status === 200) && !lockedBody.includes(protectedMarker), "password page is locked without the password")
const unlocked = await fetch(`${base}/v/${protectedUpload.id}`, { headers: { "X-Critique-Password": "secret" } })
const unlockedBody = await unlocked.text()
ok(unlocked.status === 200 && unlockedBody.includes(protectedMarker), "password header unlocks the page")
const wrong = await fetch(`${base}/v/${protectedUpload.id}`, { headers: { "X-Critique-Password": "wrong" } })
ok(!(await wrong.text()).includes(protectedMarker), "wrong password stays locked")

const unlock = await fetch(`${base}/v/${protectedUpload.id}/unlock`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "password=secret",
  redirect: "manual",
})
const unlockCookie = (unlock.headers.get("set-cookie") ?? "").match(/cw_pw=([^;]+)/)?.[1]
ok(unlock.status === 303 && Boolean(unlockCookie), "unlock form sets the password cookie")
const cookieView = await fetch(`${base}/v/${protectedUpload.id}`, {
  headers: { Cookie: `cw_pw=${unlockCookie}` },
})
ok((await cookieView.text()).includes(protectedMarker), "password cookie unlocks the page")

// --- markdown-only ---
const markdownMarker = marker("markdown")
const markdownUpload = await upload({
  markdown: { "README.md": `# ${markdownMarker}` },
  palettes: { github: { background: "#ffffff", text: "#111111", muted: "#666666", link: "#0969da" } },
  defaultTheme: "github",
})
const markdownPage = await fetch(`${base}/v/${markdownUpload.id}`)
ok(markdownPage.status === 200 && (await markdownPage.text()).includes(markdownMarker), "markdown-only page renders")
const markdownFile = await fetch(`${base}/v/${markdownUpload.id}/md?path=README.md`)
ok(markdownFile.status === 200 && (await markdownFile.text()).includes(markdownMarker), "markdown file endpoint renders")

// --- large upload ---
const largeMarker = marker("large")
const largeHtml = htmlDocument(largeMarker, largeMarker + "x".repeat(5 * 1024 * 1024))
const largeUpload = await upload({ html: largeHtml })
const largeView = await fetch(`${base}/v/${largeUpload.id}`)
const largeBody = await largeView.text()
ok(largeView.status === 200 && largeBody.includes(largeMarker) && largeBody.length > 5 * 1024 * 1024, "large upload renders")

// --- comments ---
const sessionResponse = await fetch(`${base}/a/sessions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: uploaded.url }),
})
ok(sessionResponse.status === 200, "comment session is created")
const annotationMarker = marker("annotation")
const annotationResponse = await fetch(`${base}/a/sessions/${uploaded.id}/annotations`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ comment: annotationMarker, elementPath: "body", x: 1, y: 1 }),
})
ok(annotationResponse.status === 201, "annotation is created")
const session = await fetch(`${base}/a/sessions/${uploaded.id}`)
ok((await session.text()).includes(annotationMarker), "session returns the annotation")

const sse = await fetch(`${base}/a/sessions/${uploaded.id}/events`)
ok(sse.status === 200, "SSE endpoint connects")
const reader = sse.body!.getReader()
const decoder = new TextDecoder()
let sseText = decoder.decode((await reader.read()).value)
ok(sseText.includes("event: connected"), "SSE sends the connected event")
const liveMarker = marker("live")
await fetch(`${base}/a/sessions/${uploaded.id}/annotations`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ comment: liveMarker, elementPath: "body", x: 1, y: 1 }),
})
let sawLive = false
const deadline = Date.now() + 5000
while (Date.now() < deadline && !sawLive) {
  const next = await Promise.race([
    reader.read(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
  ])
  if (!next || next.done) break
  sseText += decoder.decode(next.value)
  sawLive = sseText.includes("event: annotation.created") && sseText.includes(liveMarker)
}
ok(sawLive, "SSE receives a live annotation")
await reader.cancel()

// --- delete ---
const deleted = await fetch(`${base}/v/${uploaded.id}`, {
  method: "DELETE",
  headers: { "X-Critique-Owner-Secret": owner },
})
ok(deleted.status === 200, "owner can delete the diff")
const afterDelete = await fetch(`${base}/v/${uploaded.id}`)
ok(afterDelete.status === 404, "deleted diff is gone")

console.log("all workerd smoke checks passed")
