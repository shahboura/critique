// SQLite-backed Durable Object implementing the KV protocol. The internal
// object ID is fixed ("kv"), so all keys share one SQLite database.
import { DurableObject } from "cloudflare:workers"
import { createKvHandler } from "./kv-protocol.js"

export class KvStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        metadata TEXT,
        expiration INTEGER
      )
    `)
    this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS kv_expiration ON kv(expiration)
      WHERE expiration IS NOT NULL
    `)
    this.handle = createKvHandler({
      get: (key) => this.get(key),
      put: (key, entry) => this.put(key, entry),
      delete: (key) => this.delete(key),
    })
  }

  get(key) {
    const rows = this.ctx.storage.sql
      .exec("SELECT value, metadata, expiration FROM kv WHERE key = ?", key)
      .toArray()
    if (rows.length === 0) return null
    const row = rows[0]
    return {
      value: row.value instanceof Uint8Array ? row.value : new Uint8Array(row.value),
      metadata: row.metadata ?? null,
      expiration: row.expiration ?? null,
    }
  }

  put(key, entry) {
    this.ctx.storage.sql.exec(
      "DELETE FROM kv WHERE expiration IS NOT NULL AND expiration <= ?",
      Date.now(),
    )
    this.ctx.storage.sql.exec(
      `INSERT INTO kv (key, value, metadata, expiration) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         metadata = excluded.metadata,
         expiration = excluded.expiration`,
      key,
      entry.value,
      entry.metadata,
      entry.expiration,
    )
  }

  delete(key) {
    this.ctx.storage.sql.exec("DELETE FROM kv WHERE key = ?", key)
  }

  async fetch(request) {
    return this.handle(request)
  }
}
