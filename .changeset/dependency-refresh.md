---
"critique": patch
---

Dependency refresh across the CLI, the comments server and the vendored comments widget: vitest 5, esbuild 0.28, sharp 0.35, plus range updates for the rest. This clears the six open Dependabot advisories, all of which were in development tooling. The widget build moves to tsup 9, and CI now runs `tsc` on the CLI so a dependency whose types change cannot ship an uncompilable binary.
