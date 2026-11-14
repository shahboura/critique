---
"critique": patch
---

Comment streams that stop accepting writes are now closed within about 40 seconds instead of lingering forever; idle streams receive a comment ping every 30 seconds. Memory no longer grows with every diff page view.
