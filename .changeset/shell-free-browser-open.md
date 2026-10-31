---
"critique": patch
---

`--open` no longer builds a shell command from the diff URL or PDF path: the browser is launched with an argument array, and Windows uses PowerShell instead of `cmd /c start`. Nothing changes for normal links; a URL or filename containing shell metacharacters can no longer execute a command.
