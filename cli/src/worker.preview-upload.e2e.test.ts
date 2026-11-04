// End-to-end preview worker smoke test for upload/read/delete endpoints.
// Validates HTML + mobile upload, OG image round-trip, and owner-secret deletion.

import { describe, expect, test } from "bun:test"
import crypto from "crypto"

const BASE_URL = process.env.CRITIQUE_PREVIEW_URL || "https://preview.critique.work"
const OWNER_SECRET_HEADER = "X-Critique-Owner-Secret"
const SAMPLE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAFgwJ/lYxR5QAAAABJRU5ErkJggg=="

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex")
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function getString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key]
  if (typeof value !== "string") {
    throw new Error(`${label}.${key} must be a string`)
  }
  return value
}

describe("preview worker upload and reads", () => {
  test("uploads HTML+OG and serves desktop/mobile/raw/og correctly", async () => {
    const ownerSecret = `preview-owner-${randomHex(8)}`
    const desktopMarker = `desktop-${randomHex(6)}`
    const mobileMarker = `mobile-${randomHex(6)}`
    const patchMarker = `patch-${randomHex(6)}`
    const inputOgBytes = Buffer.from(SAMPLE_PNG_BASE64, "base64")

    let uploadedId: string | null = null

    try {
      const uploadResponse = await fetch(`${BASE_URL}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [OWNER_SECRET_HEADER]: ownerSecret,
        },
        body: JSON.stringify({
          html: `<html><head><title>${desktopMarker}</title></head><body>${desktopMarker}</body></html>`,
          htmlMobile: `<html><head><title>${mobileMarker}</title></head><body>${mobileMarker}</body></html>`,
          ogImage: SAMPLE_PNG_BASE64,
          patch: `diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-${patchMarker}\n+${patchMarker}-updated\n`,
        }),
      })

      expect(uploadResponse.status).toBe(200)
      const uploadJson = asRecord(await uploadResponse.json(), "upload")
      const id = getString(uploadJson, "id", "upload")
      uploadedId = id

      const rawResponse = await fetch(`${BASE_URL}/raw/${id}`, {
        headers: { "Accept-Encoding": "identity" },
      })
      expect(rawResponse.status).toBe(200)
      const rawHtml = await rawResponse.text()
      expect(rawHtml).toContain(desktopMarker)
      expect(rawHtml).toContain(`/og/${id}.png`)

      const desktopViewResponse = await fetch(`${BASE_URL}/v/${id}?v=desktop`, {
        headers: { "Accept-Encoding": "identity" },
      })
      expect(desktopViewResponse.status).toBe(200)
      const desktopHtml = await desktopViewResponse.text()
      expect(desktopHtml).toContain(desktopMarker)

      const mobileViewResponse = await fetch(`${BASE_URL}/v/${id}?v=mobile`, {
        headers: { "Accept-Encoding": "identity" },
      })
      expect(mobileViewResponse.status).toBe(200)
      const mobileHtml = await mobileViewResponse.text()
      expect(mobileHtml).toContain(mobileMarker)

      const ogResponse = await fetch(`${BASE_URL}/og/${id}.png`, {
        headers: { "Accept-Encoding": "identity" },
      })
      expect(ogResponse.status).toBe(200)
      expect(ogResponse.headers.get("Content-Type")).toBe("image/png")
      const servedOgBytes = Buffer.from(await ogResponse.arrayBuffer())
      expect(servedOgBytes).toEqual(inputOgBytes)

      const patchResponse = await fetch(`${BASE_URL}/v/${id}.patch`, {
        headers: { "Accept-Encoding": "identity" },
      })
      expect(patchResponse.status).toBe(200)
      expect(patchResponse.headers.get("Content-Type")).toContain("text/plain")
      const patchText = await patchResponse.text()
      expect(patchText).toContain(patchMarker)
      expect(patchText).toContain(`${patchMarker}-updated`)

      const deleteResponse = await fetch(`${BASE_URL}/v/${id}`, {
        method: "DELETE",
        headers: {
          [OWNER_SECRET_HEADER]: ownerSecret,
        },
      })
      expect(deleteResponse.status).toBe(200)
      uploadedId = null

      const deletedRawResponse = await fetch(`${BASE_URL}/raw/${id}`)
      expect(deletedRawResponse.status).toBe(404)
    } finally {
      if (uploadedId) {
        await fetch(`${BASE_URL}/v/${uploadedId}`, {
          method: "DELETE",
          headers: {
            [OWNER_SECRET_HEADER]: ownerSecret,
          },
        }).catch(() => undefined)
      }
    }
  }, 120_000)
})

describe("markdown previews", () => {
  test("markdown-only upload renders, serves, and deletes", async () => {
    const ownerSecret = `md-owner-${randomHex(8)}`
    const path = "docs/preview.md"
    const content = "# Hello\n\nBody with [link](https://example.com) and [bad](javascript:alert(1))\n\n```ts\nconst x = 1\n```\n"
    let uploadedId: string | null = null

    try {
      const uploadResponse = await fetch(`${BASE_URL}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [OWNER_SECRET_HEADER]: ownerSecret },
        body: JSON.stringify({
          markdown: { [path]: content },
          palettes: {
            github: { background: "#000000", text: "#ffffff", muted: "#888888", link: "#00aaff" },
            nord: { background: "#2e3440", text: "#eceff4", muted: "#8b95a7", link: "#81a1c1" },
          },
          defaultTheme: "github",
        }),
      })
      expect(uploadResponse.status).toBe(200)
      const uploadJson = asRecord(await uploadResponse.json(), "upload")
      const id = getString(uploadJson, "id", "upload")
      uploadedId = id

      // Markdown-only ids serve the first file at /v/:id
      const pageResponse = await fetch(`${BASE_URL}/v/${id}`)
      expect(pageResponse.status).toBe(200)
      const pageHtml = await pageResponse.text()
      expect(pageHtml).toContain("<h1")
      expect(pageHtml).toContain("Hello")
      expect(pageHtml).not.toContain("javascript:")
      // Standalone pages follow the reader's stored theme
      expect(pageHtml).toContain('html[data-md-theme="nord"]')
      expect(pageHtml).toContain("critique-theme")

      const mdResponse = await fetch(`${BASE_URL}/v/${id}/md?path=${encodeURIComponent(path)}`)
      expect(mdResponse.status).toBe(200)
      expect(await mdResponse.text()).toContain("Hello")

      // The diff page passes its theme by name; the worker resolves the palette
      const themedResponse = await fetch(`${BASE_URL}/v/${id}/md?path=${encodeURIComponent(path)}&theme=nord`)
      expect(themedResponse.status).toBe(200)
      expect(await themedResponse.text()).toContain("--bg: #2e3440")

      // Only stored paths are reachable
      const missingResponse = await fetch(`${BASE_URL}/v/${id}/md?path=../secret.md`)
      expect(missingResponse.status).toBe(404)

      // HEAD matches GET so unfurlers and uptime checks work
      const headResponse = await fetch(`${BASE_URL}/v/${id}`, { method: "HEAD" })
      expect(headResponse.status).toBe(200)

      const deleteResponse = await fetch(`${BASE_URL}/v/${id}`, {
        method: "DELETE",
        headers: { [OWNER_SECRET_HEADER]: ownerSecret },
      })
      expect(deleteResponse.status).toBe(200)
      uploadedId = null
    } finally {
      if (uploadedId) {
        await fetch(`${BASE_URL}/v/${uploadedId}`, {
          method: "DELETE",
          headers: { [OWNER_SECRET_HEADER]: ownerSecret },
        }).catch(() => {})
      }
    }
  })

  test("markdown pages are password gated", async () => {
    const ownerSecret = `md-pw-owner-${randomHex(8)}`
    const password = `pw-${randomHex(6)}`
    const path = "docs/locked.md"
    const content = "# Locked\n\nsecret body\n"

    const uploadResponse = await fetch(`${BASE_URL}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [OWNER_SECRET_HEADER]: ownerSecret },
      body: JSON.stringify({ markdown: { [path]: content }, password }),
    })
    expect(uploadResponse.status).toBe(200)
    const uploadJson = asRecord(await uploadResponse.json(), "upload")
    const id = getString(uploadJson, "id", "upload")

    try {
      const lockedResponse = await fetch(`${BASE_URL}/v/${id}/md?path=${encodeURIComponent(path)}`)
      const lockedHtml = await lockedResponse.text()
      expect(lockedHtml).toContain("Password")
      expect(lockedHtml).not.toContain("secret body")
      expect(lockedResponse.headers.get("cache-control")).toContain("no-store")

      const unlockedResponse = await fetch(`${BASE_URL}/v/${id}/md?path=${encodeURIComponent(path)}`, {
        headers: { "X-Critique-Password": password },
      })
      expect(unlockedResponse.status).toBe(200)
      expect(await unlockedResponse.text()).toContain("secret body")
      expect(unlockedResponse.headers.get("cache-control")).toContain("no-store")
      expect(unlockedResponse.headers.get("content-security-policy")).toContain("script-src 'nonce-")
      expect(unlockedResponse.headers.get("referrer-policy")).toBe("no-referrer")
    } finally {
      await fetch(`${BASE_URL}/v/${id}`, {
        method: "DELETE",
        headers: { [OWNER_SECRET_HEADER]: ownerSecret },
      }).catch(() => {})
    }
  })
})
