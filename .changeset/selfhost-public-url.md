---
"critique": patch
---

Honor `PUBLIC_URL` in every absolute URL the web worker generates (upload response, og:image tags, mobile redirect, comments widget endpoint). With `PUBLIC_URL` set, a reverse-proxied deployment emits its own domain instead of the request origin; behavior without it is unchanged.
