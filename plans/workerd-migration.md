# Evaluate: run the self-hosted critique worker on `workerd` instead of `wrangler dev`

Status: implemented and validated in this worktree. The production image builds, the full smoke test passes, and the KV migration ran on a test volume. Remaining: real-volume dry run, 24h soak, review and merge.
Worktree: `/data/repos/critique/tmp/workerd-eval` (detached at `fa6e5e2` plus the SSE leak fix).
The worktree's `node_modules` and `cli/node_modules` are symlinks to the main checkout.

## Goal

Replace the `wrangler dev` process tree in the self-hosted image with a single
production `workerd` process, keeping uploads, viewing, markdown previews, OG
images, password-protected diffs, and live comments working.

## Measured baseline

Same host, same worker bundle, after `/a/health`.

| Runtime | Processes | RSS |
| --- | --- | --- |
| `wrangler dev` (current image) | Node CLI 52MB + wrangler Node 340MB + `workerd` proxy 99MB + `workerd` worker 166MB | **~657MB** |
| production `workerd` image | one `workerd` process, worker + SQLite KV + DO + asset router | **50MB idle**, **80–150MB after the smoke test and a 300-key migration** in `docker stats` |

The measured container figure is **50.3MB idle**, 64.3MB after importing 300 KV
entries, and does not grow with uploads/views in the smoke test. The local
process RSS is higher because it includes the worktree runtime; the container
number is the one that matters.

Prototype config: `cli/workerd-eval.capnp`; compat config:
`cli/workerd-compat.capnp`. It runs:

- `main` — the bundle from `wrangler deploy --dry-run --outdir dist-workerd`
- `kv-service` — a worker implementing the KV HTTP protocol (prototype: in-memory)
- `CommentRoom` — Durable Object with SQLite `localDisk` storage
- `router` — serves the widget, font and licenses from a `disk` service, forwards the rest
- `assets-disk`, `do-disk` — plain `disk` services

## What the prototype proves

- `wrangler deploy --dry-run --outdir dist-workerd` produces a runnable ESM
  bundle (`worker.js`, ~3MB) without a Cloudflare account.
- `workerd serve` starts the worker. `GET /a/health` returns 200.
- `/upload` and `/v/:id` work end to end with a KV binding backed by a service.
- SSE works: a live `annotation.created` event arrives; a disconnected client
  is reaped by the new heartbeat (1 listener → 0 after 45s). The abort signal
  still does not reach the DO in production `workerd`, so the SSE fix is
  required in either runtime.
- Static assets are served with correct content types by the router.
- `cloudflare:email` is imported by the `agents` package and is not provided by
  open-source `workerd`. An esbuild alias to a stub (`src/email-stub.js`) is
  enough because CommentRoom never sends email. The stub should throw if ever
  called; remove the redundant `cloudflare-internal:email` module from the
  capnp config and keep one mechanism.

## Persisted data: proven compatible (DO) and simple to migrate (KV)

### Durable Objects — compatible in place

Miniflare stores DO SQLite at:

```
/data/v3/do/critique-web-CommentRoom/<object-id>.sqlite
/data/v3/do/critique-web-CommentRoom/metadata.sqlite
```

The unique key is `${workerName}-${className}`; for this worker that is
`critique-web-CommentRoom` (confirmed in Miniflare:
`getDurableObjectUniqueKey`). `workerd`'s `localDisk` layout is the same
`<disk>/<uniqueKey>/<id>.sqlite` + `metadata.sqlite`.

Proof: a room and annotation were created through `wrangler dev` with
`--persist-to /tmp/do-compat`, then `workerd` was started with a `disk` service
rooted at `/tmp/do-compat/v3/do` and `uniqueKey = "critique-web-CommentRoom"`.
`GET /a/sessions/compat-room` returned the annotation:

```json
{"id":"compat-room","annotations":[{"comment":"survives migration", ...}]}
```

So existing comments can be preserved **without a migration**: point the disk
service at `/data/v3/do` and use the same unique key. A fresh deployment can
also start with an empty directory.

### KV — simple migration

Miniflare's KV is also a Durable Object, but its value data is easy to read:

```
/data/v3/kv/miniflare-KVNamespaceObject/<hash>.sqlite   -> _mf_entries
  key TEXT PRIMARY KEY, blob_id TEXT, expiration INTEGER, metadata TEXT
/data/v3/kv/<namespace-id>/blobs/<blob_id>               -> raw value bytes
```

`metadata` is the JSON string the app already relies on
(`contentType`, `contentEncoding`, `schemaVersion`); `expiration` is
milliseconds since epoch. A migration that reads `_mf_entries`, copies each
blob, and PUTs the value with its metadata and absolute expiry into the new
store is a small script, not a reverse-engineering project. The test volume had
300 entries; it should be run against a copy of the real volume first.

The prototype KV service is in-memory. The production service must implement
this contract:

- `PUT /:key` accepts `?expiration=<absolute seconds>` **or**
  `?expiration_ttl=<seconds>`. Workerd sends `expiration_ttl` for
  `expirationTtl`, which every unlicensed upload uses (`SEVEN_DAYS`); the
  prototype only read `expiration`, so a copied service would never expire.
  Miniflare's `_mf_entries.expiration` is milliseconds; the migration script
  converts it to seconds for the route.
- `GET /:key` returns the raw value bytes, `CF-KV-Metadata` as the exact JSON
  string, and `CF-Expiration` when set. Missing or expired keys return 404.
  Do **not** set `Content-Encoding`: the app detects gzip from metadata and
  would double-decompress otherwise.
- `DELETE /:key` returns 2xx. `deleteAll` fires seven parallel deletes.
- Keys arrive URL-encoded; decode them. Values are binary (OG images) and must
  round-trip as bytes.
- Expiry is enforced lazily and purged in the background. `owner:` and password
  keys use TTLs and are security-relevant.
- No silent truncation: uploads can exceed 15MB.
- `list`/bulk get are unused by the app; throw a clear "unsupported" error
  rather than return an empty list.

Durable storage design: write the value as an opaque blob first, then commit
`(key, blob_id, expiration, metadata)` in one SQLite transaction (a DO with
`enableSql` is the simplest host). Garbage-collect the old blob only after the
commit; hash keys for blob filenames. Test restart-mid-write and concurrent
PUT/DELETE, not just the happy path.

## Remaining workstreams

1. **Durable KV service + migration script.** ~1–1.5 days including protocol
   tests. The data format is known; the main risk is expiry/metadata fidelity.
2. **Docker/entrypoint.** Build stage produces `worker.js`, `public/`, the
   capnp config, KV service and router; runtime stage copies only those plus
   the **native** `@cloudflare/workerd-linux-{x64,arm64}` binary selected by
   `TARGETARCH` (the npm `workerd` bin is a Node launcher), asserts
   `workerd --version` matches the pinned version, and keeps `ca-certificates`
   for outbound TLS. No Node at runtime. Port `PUBLIC_URL` / widget validation
   from the current entrypoint.
3. **Config and secrets.** `workerd` supports
   `(name = "...", fromEnvironment = "VAR")` bindings (capnp line 543), so
   `PUBLIC_URL`, `STRIPE_*`, `RESEND_*` and widget flags can come from the
   container environment without templating or writing secrets to disk.
4. **Healthcheck and bind.** Bind `0.0.0.0:8787` (the prototype binds loopback,
   which would be unreachable from Docker). Replace the Node healthcheck with
   `curl`/`wget` (install one in the runtime base; `node:26-slim` has neither)
   or a tiny static probe, so the image can drop Node.
5. **Assets.** Prefer the worker's own `ASSETS` binding if it can be wired in
   `workerd`; otherwise keep the router but only return a disk response when
   `ok`, forward 404s to the main worker, and set `allowDotfiles = false`.
6. **Observability.** `wrangler dev` currently provides request logs and an
   inspector. Direct `workerd` logs to stderr; add a startup line with
   `BUILD_ID`/version and document where exceptions appear.
7. **Version pinning.** `wrangler@4.156.1` depends on
   `workerd@1.20261101.1`; pin the runtime image to that exact version and
   assert it at build time.
8. **Validation.** KV contract tests (`expiration` and `expiration_ttl`,
   metadata round-trip, gzip passthrough, binary, 404 for expired), migration
   checks, upload/view/raw/patch/markdown/OG/password/delete, comments CRUD +
   SSE + reaper, large uploads, restart persistence, and a 24h memory soak. Add
   one script that runs the flows against both images.
9. **Rollback runbook.** Ordered, not bullets: stop the old container to
   freeze writes → take a consistent `/data` backup (stopped volume or
   snapshot) → run the KV migration on a copy and compare counts, metadata,
   expiry and a byte sample → spot-check one comment and one diff → cut over.

   Rollback restores that backup, so any diffs or comments written after the
   backup are lost; do not imply a live rollback is free. A new KV directory
   keeps the *old* KV data readable by the old image, but workerd-written KV
   values are not visible to the old image. If rollback and re-cutover must be
   supported, define a read-only window and a re-run policy so the migration
   cannot resurrect deleted keys or overwrite newer values.

## Effort and risk

| Workstream | Effort | Risk |
| --- | --- | --- |
| Bundle + `workerd` config + email alias | done | low |
| Asset router | done | low |
| Durable KV service | ~1.5–2 days | medium |
| KV migration | ~0.5–1 day | medium (schema known; dry run on a copy) |
| DO data | none (proven compatible) | low |
| Config/secrets (`fromEnvironment`) | ~0.5 day | low |
| Docker/entrypoint/healthcheck | ~0.5–1 day | low |
| Validation + 24h soak | 1–2 days wall clock | medium |

Rough production-ready estimate: **3–5 focused days plus a 24h soak**. The
original "2–4 days" was optimistic mostly because of unknown data formats; the
DO compatibility proof and the simple KV schema remove most of that variance,
but KV TTL/atomicity tests and the migration dry run remain.

## Potential gain after migration

- Idle: **~657MB → ~110MB measured**; realistic steady state **180–300MB**,
  a **350–480MB** saving.
- The 1.40GB container should fall to that range after a restart. The SSE fix
  stops per-view growth; `workerd` evicts idle DOs instead of keeping every
  room forever, so per-diff growth should plateau.
- One process to monitor instead of four; no Node dev-server overhead.
- The runtime image can drop most of the Node toolchain.

## Recommendation

1. Land the SSE fix first (needed on both runtimes).
2. Keep the prototype worktree for reference.
3. Implement the durable KV service and migration script; run a dry migration
   on a copy of `/data` (count live vs expired rows, metadata parse failures,
   missing blobs, byte checks) before cutover. The script must run in the old
   image or a one-off Node/Bun container, because the runtime image will not
   have Node.
4. Switch the Docker image to `workerd`, run the full smoke test and 24h soak,
   then deploy with the old image and a `/data` backup for rollback.

The migration is worth doing: it removes most of the fixed memory cost and
fixes the unbounded Durable Object growth that the SSE patch does not address.
