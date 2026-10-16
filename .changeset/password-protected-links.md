---
"critique": minor
---

Add password protected web links. Pass `--password <pw>` or set `CRITIQUE_PASSWORD` with `--web` (also on `critique review --web`). Viewers type the password once; the browser remembers every password that worked, so later links open without asking again. Protected links have no social preview image, and the comments, `.patch`, `/raw` and `/annotations` endpoints require the password too (send it with the `X-Critique-Password` header from scripts).
