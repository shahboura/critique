import { describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { Database } from "bun:sqlite"
import { readMiniflareKv, migrationHeaders } from "./migrate-kv.js"

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "critique-kv-"))
  const namespace = "ns-id"
  const objects = path.join(root, "miniflare-KVNamespaceObject")
  const blobs = path.join(root, namespace, "blobs")
  fs.mkdirSync(objects, { recursive: true })
  fs.mkdirSync(blobs, { recursive: true })

  const db = new Database(path.join(objects, "object.sqlite"))
  db.run("CREATE TABLE _mf_entries (key TEXT PRIMARY KEY, blob_id TEXT NOT NULL, expiration INTEGER, metadata TEXT)")
  db.run("INSERT INTO _mf_entries VALUES (?, ?, ?, ?)", [
    "diff-id",
    "blob-1",
    1_800_000_000_000,
    "{\"contentType\":\"text/html\",\"contentEncoding\":\"gzip\"}",
  ])
  db.run("INSERT INTO _mf_entries VALUES (?, ?, ?, ?)", ["old", "blob-old", 1_600_000_000_000, null])
  db.run("INSERT INTO _mf_entries VALUES (?, ?, ?, ?)", ["missing", "blob-missing", null, null])
  db.close()

  fs.writeFileSync(path.join(blobs, "blob-1"), new Uint8Array([1, 2, 3]))
  fs.writeFileSync(path.join(blobs, "blob-old"), new Uint8Array([4]))
  return { root, namespace }
}

describe("readMiniflareKv", () => {
  test("reads entries, metadata, expiry and blobs", () => {
    const { root, namespace } = fixture()
    const { entries, missingBlobs } = readMiniflareKv(root, namespace)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      key: "diff-id",
      value: new Uint8Array([1, 2, 3]),
      metadata: "{\"contentType\":\"text/html\",\"contentEncoding\":\"gzip\"}",
      expiration: 1_800_000_000_000,
    })
    expect(entries[1].metadata).toBeNull()
    expect(missingBlobs).toEqual(["missing"])
  })

  test("migration headers convert ms to seconds and omit permanent expiry", () => {
    const headers = migrationHeaders({
      key: "diff-id",
      value: new Uint8Array(),
      metadata: null,
      expiration: 1_800_000_000_000,
    }, "secret")
    expect(headers["X-KV-Expiration"]).toBe("1800000000")

    const permanent = migrationHeaders({
      key: "permanent",
      value: new Uint8Array(),
      metadata: null,
      expiration: null,
    }, "secret")
    expect(permanent["X-KV-Expiration"]).toBeUndefined()
    expect(permanent["X-KV-Metadata"]).toBeUndefined()
  })
})
