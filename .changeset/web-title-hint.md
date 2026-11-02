---
"critique": patch
---

`critique web "<title>"` explains itself instead of leaking git's error. The deprecated subcommand reads its first argument as a git ref, so a title failed with `fatal: ambiguous argument 'my title'`. It now says the argument must be a ref and shows `critique web --title "<title>"` and `critique --web "<title>"`. Valid refs and ranges behave exactly as before.
