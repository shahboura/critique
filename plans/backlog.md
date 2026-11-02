# Backlog

Open work after the 0.6.2 release (2026-11-02). Priorities: **P1** blocks something
or risks shipping a broken artifact, **P2** guards against regressions, **P3** is
routine upkeep. Delete an entry when it lands.

## P1 — Port the ACP client to `@agentclientprotocol/sdk` 2.x

The `review` command still speaks the 0.13 protocol; upstream is at 2.4.0 (PR #12
proposes 2.1.0). CI caught it the moment the CLI typecheck step existed:

```
src/review/acp-client.ts(6,3): error TS2724: '"@agentclientprotocol/sdk"' has no
  exported member named 'ClientSideConnection'. Did you mean 'ClientConnection'?
```

`ClientConnection` is type-only in v2, and `initialize`, `unstable_listSessions`
and `loadSession` no longer exist, so this is a port, not a rename: connection
construction moves to the v2 factory and the session calls need re-mapping.

- Where: `cli/src/review/acp-client.ts`, plus the `SessionNotification` consumers
  (`session-context.ts`, `stream-display.tsx`, `acp-stream-display.ts`, `types.ts`).
- Done when: `bun run --cwd cli build` is clean, the `review` tests pass, and a real
  `critique review` against opencode and claude streams output end to end.
- Then: merge or recreate PR #12.

## P2 — Run the PTY pager tests in CI

`cli/src/stdin-pager.test.ts` (11 cases, ~19s) is the only end-to-end check of
`--stdin` paging, and CI never runs it — which is why the `diff` 9 snapshot drift
shipped silently in 0.6.1 and had to be caught by hand.

- Where: `.github/workflows/test.yml`, `agentation` job, next to the CLI typecheck.
- Done when: the step runs `bun test src/stdin-pager.test.ts` and the workflow is
  green on `main`. Watch for flakiness in the binary-diff case, which waits 5s for
  the pager to settle.

## P3 — Decide what to do with typescript 7 (PR #10)

Blocked upstream, not by us: TS 7 is the native compiler and ships no JS compiler
API, so tsup's declaration build cannot run.

```
rollup-plugin-dts requires the TypeScript compiler API. The installed
typescript@7.0.2 does not provide it, and the `@typescript/typescript6`
fallback is not installed.
```

Installing the fallback only moves the failure to
`_typescript2.default.parseJsonConfigFileContent is not a function`.

- Done when: PR #10 is closed with that reason (dependabot re-proposes on the next
  major, and the error message will show whether the toolchain caught up), or a
  working dts path exists.

## P3 — Remaining major bumps

Deliberately held back; each needs its own verification. Nothing here is urgent —
0.6.x runs on the versions below without known advisories.

- CLI: `js-yaml` 4 → 5, `marked` 17 → 18, `preact` 10 → 11, `stripe` 20 → 23,
  `@cloudflare/workers-types` 4 → 5, `@takumi-rs/core` + `helpers` 0.65 → 2.x.
- Vendored widget (`packages/agentation`, a git subtree — expect conflicts on
  `git subtree pull`): `react`/`react-dom` 18 → 19 with matching `@types/react`,
  `jsdom` 25 → 30, `postcss-modules` 6 → 9, `@vitejs/plugin-react` 4 → 6,
  `@types/node` 20 → 26.
- Excluded by design: `@opentuah/core` and `@opentuah/react` are pinned to the fork
  build and only move after publishing from the `opentuah` branch.

## P3 — Dependabot alerts still show 6 open

`vitest` ×2, `sharp` ×3, `esbuild` ×1 remained open roughly an hour after `299eb5c`
landed the fixed versions, even though the dependency graph already reported
`vitest ^5.0.5`, `esbuild ^0.28.2`, `sharp 0.35.5`.

Worth one look before dismissing: the graph only sees manifests (~63 packages vs
~770 in `bun.lock`), so alerts here are approximate by construction.

- Done when: alerts are auto-closed by GitHub's rescan, or dismissed in
  Security → Dependabot with a note that the fix is in `299eb5c`.

## P3 — Ship the Docker prune fix with the next tag

`f0e0618` fixed the `Dockerfile` prune list (`diff@*` and two dead version pins).
The `container` workflow builds on every push to `main` but only pushes to ghcr on
`v*` tags, so the image still carries the patch parser until the next release.
