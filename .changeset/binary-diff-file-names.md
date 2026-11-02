---
"critique": patch
---

Binary diffs show their paths. The tree and summary used to read `unknown` for `Binary files a/logo.png and b/logo.png differ`, because the patch parser discarded both sides. It now resolves the pair, so the tree shows `b/logo.png` and the summary reads `a/logo.png → b/logo.png +0-0`.
