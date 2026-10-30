/** Coalesce a group's selections until the real menu exit completes. No guessed
 * animation duration, and a quick reopen keeps the latest selection pending. */
function createMenuCommitQueue() {
  const pending = new Map<object, () => void>();
  return {
    defer(owner: object, commit: () => void) {
      pending.set(owner, commit);
    },
    finish() {
      const commits = [...pending.values()];
      pending.clear();
      for (const commit of commits) commit();
    },
    clear() {
      pending.clear();
    },
  };
}

export { createMenuCommitQueue };
