---
"critique": patch
---

Stamp the build id into generated pages (`<meta name="critique-build">`), the upload request (`X-Critique-Build`), and `/a/health`, and use it to bust the comments widget cache. A page can now say which renderer built it, so a mixed or stale version is visible instead of silent.
