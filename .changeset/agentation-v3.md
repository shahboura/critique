---
"critique": minor
---

Move the comments widget to a vendored upstream agentation v3.1.2, with the fork patches applied in-tree.

- Fix duplicate annotations: a note could appear twice in the toolbar and in copied feedback because the server assigns the annotation id while the widget still held a temporary one. The client now mints the final id up front and the server treats a repeated create as the same annotation.
- Keep anchored feedback: annotations on diff lines still capture `file:line` for the agent.
- Keep live multi-user sync: annotations created or deleted by other reviewers appear and disappear without a reload.
- Shadow DOM styling: the widget no longer restyles the diff page, and the old `@scope` workaround is gone.
- Harden the comment API: server-assigned author, human-only thread roles unless the diff owner asks otherwise, sanitized markdown for agent context, and idempotent creates.
