// Import Miniflare's KV data (v3/kv) into the workerd KV service.
//
// Source layout:
//   <root>/miniflare-KVNamespaceObject/<hash>.sqlite  -> _mf_entries
//   <root>/<namespace>/blobs/<blob_id>                -> raw value bytes
//
// Run with:
//   bun scripts/migrate-kv.ts --source /data/v3/kv --namespace <kv-id> \
//     --url http://127.0.0.1:8787 --secret "$MIGRATE_SECRET" [--dry-run] [--verify]
import fs from "fs"
import path from "path"
import { Database } from "bun:sqlite"

export type MiniflareKvEntry = {
  key: string
  value: Uint8Array
  metadata: string | null
  expiration: number | null
}

export function readMiniflareKv(
  root: string,
  namespace: string,
): { entries: MiniflareKvEntry[]; missingBlobs: string[] } {
  const objects = path.join(root, "miniflare-KVNamespaceObject")
  const sqliteFiles = fs
    .readdirSync(objects)
    .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
  if (sqliteFiles.length !== 1) {
    throw new Error(`expected one KV object in ${objects}, found ${sqliteFiles.length}`)
  }

  const db = new Database(path.join(objects, sqliteFiles[0]), { readonly: true })
  const rows = db
    .query("SELECT key, blob_id, expiration, metadata FROM _mf_entries ORDER BY key")
    .all() as Array<{
      key: string
      blob_id: string
      expiration: number | null
      metadata: string | null
    }>
  db.close()

  const blobs = path.join(root, namespace, "blobs")
  const entries: MiniflareKvEntry[] = []
  const missingBlobs: string[] = []
  for (const row of rows) {
    if (row.blob_id === "") {
      entries.push({
        key: row.key,
        value: new Uint8Array(),
        metadata: row.metadata,
        expiration: row.expiration,
      })
      continue
    }
    const blobPath = path.join(blobs, row.blob_id)
    if (!fs.existsSync(blobPath)) {
      missingBlobs.push(row.key)
      continue
    }
    entries.push({
      key: row.key,
      value: new Uint8Array(fs.readFileSync(blobPath)),
      metadata: row.metadata,
      expiration: row.expiration,
    })
  }
  return { entries, missingBlobs }
}

export function migrationHeaders(entry: MiniflareKvEntry, secret: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Migrate-Secret": secret,
    "X-KV-Key": entry.key,
  }
  if (entry.metadata) headers["X-KV-Metadata"] = entry.metadata
  if (entry.expiration !== null) headers["X-KV-Expiration"] = String(Math.floor(entry.expiration / 1000))
  return headers
}

async function main() {
  const argv = Bun.argv.slice(2)
  const value = (name: string) => {
    const index = argv.indexOf(`--${name}`)
    return index >= 0 ? argv[index + 1] : undefined
  }
  const source = value("source")
  const namespace = value("namespace")
  const url = value("url")?.replace(/\/$/, "")
  const secret = value("secret") ?? process.env.MIGRATE_SECRET
  const dryRun = argv.includes("--dry-run")
  const verify = argv.includes("--verify")
  const verifyAll = argv.includes("--verify-all")
  const skipExisting = argv.includes("--skip-existing")
  if (!source || !namespace || !url || !secret) {
    throw new Error("usage: migrate-kv.ts --source <v3/kv> --namespace <id> --url <base> [--secret <token>] [--dry-run] [--verify] [--verify-all] [--skip-existing]")
  }

  const { entries, missingBlobs } = readMiniflareKv(source, namespace)
  const now = Date.now()
  const nowSeconds = Math.floor(now / 1000)
  const live = entries.filter((entry) =>
    entry.expiration === null || Math.floor(entry.expiration / 1000) > nowSeconds
  )
  const bytes = live.reduce((sum, entry) => sum + entry.value.byteLength, 0)
  console.log(
    `found ${entries.length} live entries (${live.length} importable, ${entries.length - live.length} expired), ${missingBlobs.length} missing blobs, ${(bytes / 1e6).toFixed(1)} MB`,
  )
  if (missingBlobs.length > 0) console.log(`missing blobs: ${missingBlobs.join(", ")}`)
  if (dryRun) return

  let imported = 0
  let skipped = 0
  const importedEntries: MiniflareKvEntry[] = []
  for (const entry of live) {
    if (skipExisting) {
      const existing = await fetch(`${url}/__migrate/kv`, {
        headers: { "X-Migrate-Secret": secret, "X-KV-Key": entry.key },
      })
      if (existing.ok) {
        skipped++
        continue
      }
    }

    const response = await fetch(`${url}/__migrate/kv`, {
      method: "POST",
      headers: migrationHeaders(entry, secret),
      body: entry.value,
    })
    if (!response.ok) {
      throw new Error(`import failed for ${entry.key}: ${response.status} ${await response.text()}`)
    }
    importedEntries.push(entry)
    imported++
    if (imported % 100 === 0) console.log(`imported ${imported}/${live.length}`)
  }
  console.log(`imported ${imported} entries, skipped ${skipped} existing`)

  if (verify) {
    for (const entry of (verifyAll ? importedEntries : importedEntries.slice(0, 3))) {
      const response = await fetch(`${url}/__migrate/kv`, {
        headers: { "X-Migrate-Secret": secret, "X-KV-Key": entry.key },
      })
      if (!response.ok) throw new Error(`verify failed for ${entry.key}: ${response.status}`)
      const stored = new Uint8Array(await response.arrayBuffer())
      if (!Buffer.from(stored).equals(Buffer.from(entry.value))) {
        throw new Error(`verify value mismatch for ${entry.key}`)
      }
      const storedMetadata = response.headers.get("X-KV-Metadata")
      const expectedMetadata = entry.metadata ? JSON.stringify(JSON.parse(entry.metadata)) : null
      const actualMetadata = storedMetadata ? JSON.stringify(JSON.parse(storedMetadata)) : null
      if (expectedMetadata !== actualMetadata) {
        throw new Error(`verify metadata mismatch for ${entry.key}`)
      }
      console.log(`verified ${entry.key}`)
    }
  }
}

if (import.meta.main) {
  await main()
}
