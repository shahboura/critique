#!/usr/bin/env node
// Smoke test for a self-hosted critique worker (see Dockerfile / docker-compose.yml).
//
// Usage:
//   CRITIQUE_URL=https://diff.example.com EXPECT_PUB=https://diff.example.com \
//     node scripts/selfhost-smoke.mjs
//
// EXPECT_PUB is optional. When set (matching the container's PUBLIC_URL), every
// generated URL must use it. Without it, URLs must use the request origin.
// In both modes nothing may leak "critique.work". Exits 0 when all checks pass.
// Note: EXPECT_PUB only changes the assertions when the public origin differs
// from CRITIQUE_URL.

const BASE = (process.env.CRITIQUE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "")
const EXPECT_PUB = process.env.EXPECT_PUB ? process.env.EXPECT_PUB.replace(/\/+$/, "") : null
const ORIGIN = EXPECT_PUB || BASE

let fails = 0
const ok = (name, cond) => {
  console.log((cond ? "OK   " : "FAIL ") + name)
  if (!cond) fails++
}
const usesOrigin = (label, value) =>
  ok(`${label} -> ${ORIGIN}`, typeof value === "string" && value.startsWith(ORIGIN + "/") && !value.includes("critique.work"))

let r = await fetch(BASE + "/", { redirect: "manual" })
ok("GET / responds", r.status === 200 || r.status === 302)

const up = await (await fetch(BASE + "/upload", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    html: '<html><head><title>smoke</title><meta name="viewport" content="w"></head><body><p>hi</p></body></html>',
    patch: "diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n-a\n+b\n",
    ogImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  }),
})).json()
usesOrigin("upload url", up.url)
usesOrigin("ogImageUrl", up.ogImageUrl)
const id = up.id

r = await fetch(`${BASE}/og/${id}.png`)
ok("og image served", r.status === 200 && (r.headers.get("content-type") || "").includes("image/png"))

r = await fetch(`${BASE}/v/${id}`)
const html = await r.text()
ok("view page 200", r.status === 200)
ok(`og:image -> ${ORIGIN}`, html.includes(`content="${ORIGIN}/og/${id}.png"`))
ok(`comments endpoint -> ${ORIGIN}`, html.includes(`"endpoint":"${ORIGIN}/a"`))
ok("comments widget script present", html.includes("agentation-widget.js?v="))
ok("no critique.work in view page", !html.includes("critique.work"))

r = await fetch(`${BASE}/v/${id}`, {
  headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
  redirect: "manual",
})
ok("mobile redirect", r.status === 302 && r.headers.get("location") === `${ORIGIN}/v/${id}?v=mobile`)

r = await fetch(`${BASE}/v/${id}.patch`)
ok("patch endpoint", r.status === 200 && (await r.text()).startsWith("diff --git"))

r = await fetch(BASE + "/agentation-widget.js")
const widgetBytes = r.status === 200 ? (await r.arrayBuffer()).byteLength : 0
ok("static comments widget", r.status === 200 && widgetBytes > 300000)

const ann = await (await fetch(`${BASE}/a/sessions/${id}/annotations`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ comment: "smoke note", element: "p", elementPath: "body > p" }),
})).json()
ok("comments store (Durable Object)", typeof ann.id === "string" && ann.id.startsWith(id + "_"))

const ctx = await (await fetch(`${BASE}/v/${id}/annotations`)).text()
ok(`annotations context -> ${ORIGIN}`, ctx.includes(`${ORIGIN}/v/${id}`) && ctx.includes("smoke note"))

const up2 = await (await fetch(BASE + "/upload", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ html: "<html><head><title>p</title></head><body>s</body></html>", password: "smoke-pw" }),
})).json()
r = await fetch(`${BASE}/v/${up2.id}`, { redirect: "manual" })
ok("password-protected page locked", r.status === 401)
r = await fetch(`${BASE}/v/${up2.id}/unlock`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "password=smoke-pw",
  redirect: "manual",
})
ok("password unlock", r.status === 303)
const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ")
r = await fetch(`${BASE}/v/${up2.id}`, { headers: { cookie }, redirect: "manual" })
ok("unlocked view", r.status === 200)

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
