---
"critique": minor
---

The self-hosted image now runs the worker on a single `workerd` process instead of the `wrangler dev` process tree. Idle container memory drops from roughly 650MB to about 50–65MB. Existing comment rooms are read in place; diffs stored in Miniflare's KV are imported once with `scripts/migrate-kv.ts`.
