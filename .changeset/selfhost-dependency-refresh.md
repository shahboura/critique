---
"critique": patch
---

Refresh the self-host image dependencies to pick up upstream security patches (wrangler 4.151.3, hono 4.13.13, js-yaml 4.3.2, fast-uri, undici and others), drop the unused npm bundle and dead packages left behind by the trim step, and install CA certificates so workerd can start on `node:26-slim`.
