---
'critique': minor
---

Add direct GitHub pull request URLs as diff sources. For example:

```bash
critique https://github.com/remorses/sigillo/pull/19 --web "Sigillo PR #19"
```

The CLI downloads the PR diff through the GitHub API and renders it with the existing terminal, web, PDF, or image output. No local checkout is required. Private PRs work with `GH_TOKEN`, `GITHUB_TOKEN`, or a signed-in `gh` CLI.
