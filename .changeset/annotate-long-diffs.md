---
"critique": patch
---

Annotations are available on long diffs again. The comments widget was skipped for any diff whose HTML was over 1MB, so big diffs lost the annotate button entirely. The widget now mounts its UI in a shadow root, so the style recalculation cost that motivated the size gate no longer applies.
