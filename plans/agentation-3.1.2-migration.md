# Plan v2: agentation fork — duplicate fix, 3.1.2 migration, versioning

Status: v3 — **implemented** on branch `feat/agentation-v3` (HEAD `3064a69`).
The vendored-workspace path superseded the fork/dist plan in §6 D5; outcome and
remaining gaps are in §11. Supersedes v1. Related: `plans/agentation-migration.md`.

## 0. Fact corrections from review (v1 was wrong)

| v1 claim | Reality |
|---|---|
| `@scope` + `appendChild` monkey-patch lives in `cli/src/agentation-widget.tsx` | Not present. The file only has content-visibility, theme seeding, position reset, visualViewport. `docs/commenting-system.md:53,116` is stale. |
| Preview e2e validates the widget | `cli/src/agentation-api.preview.e2e.test.ts` is server-only HTTP; it never loads the widget and has zero password/protected-diff cases. |
| One id-mint site in 3.1.2 | Five feedback mints in 3.1.2 (`:1662`, `:1721`, `:2061`, `:2529`, `:2564`), all copied into the annotation by `addAnnotation` (`:2646`). Patch the choke point, not a mint site. Design placement/rearrange ids are separate and excluded by disabling layout mode. Verified against tag `v3.1.2` (annotated tag `2a218662`, commit `7982d83a`); reference copy in `cli/tmp/agentation-main` is local-only and not committed. |
| 3.1.2 ships no LICENSE | The npm tarball includes `LICENSE` (PolyForm Shield 1.0.0, © 2026 Benji Taylor). The legal question is whether republishing a modified fork competes, not whether attribution exists. |
| `visualViewport` fix works | No-op: the component portals to `document.body` (`index.tsx:5312`), so `#critique-agentation` stays empty. |
| `bun run build` builds the widget | `cli` build is `tsc` only; the widget builds via root `build:comments-widget`, invoked by `worker:deploy`. |
| Size gate | v1 gate (150 KB gzip) allowed a >2x regression. Gate must be relative to the measured baseline and ship with a command. |
| Plain Docker builds serve `?v=dev` | Fixed in `6203ca7`. `worker.tsx:905` falls back to the package version: `?v=${BUILD_ID === "dev" ? pkgVersion : BUILD_ID}`. The Dockerfile also rejects non-token build args. |
| `cli` is 0.4.1 and a tag can be rebuilt | 0.4.2 is released (`v0.4.2`, commit `7bb4cbd`). Tags are immutable: the workflow refuses to republish an existing version and records the built commit. Protect `v*` tags with a repository ruleset. |

## 1. Root cause (verified)

ID race between widget and worker:

1. Widget mints `id = Date.now().toString()` and appends optimistically.
2. `cli/src/agentation-api.ts:98-101` rewrites the id to `${sessionId}_${uuid}`.
3. `comments-server/src/comment-room.ts:138` emits `annotation.created` before returning; SSE usually beats the POST response.
4. Widget dedupes by id (`:1205-1215`), sees a different id, appends a second copy; the POST remap then maps the first copy to the same id.
5. `generateOutput()` prints both. Reload self-heals.

Fix has two halves:
- **Client**: mint the final id at the choke point when a session exists
  (`${currentSessionId}_${crypto.randomUUID()}`). The server preserves a prefixed
  client id, so SSE and local agree and no remap is needed.
- **Upload normalization**: notes created before a session exists must be
  prefixed at upload time; otherwise the init/join sync path duplicates them
  (fork `:1133-1141`, join `:1000-1047`, reconnect `:1293-1348`).
- **Server idempotency**: with stable ids, a repeated POST must not 500.
  `INSERT ... ON CONFLICT(id) DO NOTHING`, then `loadAnnotation(id)` and return
  that row. Emit `annotation.created` and append to in-memory state **only** on
  a real insert (`comment-room.ts:129-138` currently does both unconditionally).

## 2. Workstreams

| ID | Workstream | Gate | Can start |
|---|---|---|---|
| A | Duplicate fix on current 2.5.5 line | none (bug) | now |
| B | Migration to upstream 3.1.2 | license + publish decision | after A ships |
| C | Server security hardening (pre-existing issues) | none | in parallel |
| D | Versioning + release mechanics | decided (D5: dist branch + SHA pin) | before first publish |

## 3. Workstream A — duplicate fix (small, ship first)

1. Fork commit: prefixed id at `addAnnotation` (single choke point in 2.5.5),
   plus a shared `normalizeAnnotationId(id, sessionId)` used by every
   `syncAnnotation` call site (init merge, join, reconnect, create).
2. Server commit: idempotent create in `comment-room.ts`: `INSERT ... ON
   CONFLICT(id) DO NOTHING`, read back the row, return it, and skip both the
   in-memory append and the `emitSSE` call when no row was inserted. Plus
   `agentation-api.ts` keeps the prefixed client id (already does).
3. Tests:
   - fork unit: each entry point (click, text selection, multi-select single,
     multi-select multi, drag multi-select, area) yields a prefixed id;
   - pre-session note: create → session opens → upload → exactly one annotation;
   - server unit: same id POSTed twice returns the original row, one row in GET;
   - e2e: POST `id: ${sessionId}_${uuid}` returns the identical id.
4. Publish/consume per workstream D: build `dist-v2.5.6-fork.1` from the
   `critique` branch **before** 0.4.3 (workstream A needs its own artifact path;
   the registry package cannot be replaced).
5. Acceptance: two tabs create/edit/delete → one marker each, badge count equals
   server rows, copy lists each note once, reload keeps the same count.

Rollback: revert the pin to 2.5.5 and redeploy.

## 4. Workstream B — migration to 3.1.2

Preconditions (blockers):
1. License decision recorded (see D).
2. Publish path chosen (see D).
3. A widget-level verification harness exists. The current e2e cannot cover the
   widget; options: a Playwright/jsdom smoke test that mounts the built bundle,
   or an explicit manual matrix signed off per release. Decide before starting.

Patch stack on tag `v3.1.2`, one commit each:
1. id choke point + upload normalization + tests.
2. `findAnchor` + `anchor` capture. 3.1.2 has five feedback mint sites behind
   six UI entry points; wire only the entry points that can hit a diff line
   (click, text selection, multi-select, area) and say so in the acceptance
   criteria.
3. SSE `annotation.created`/`annotation.deleted` implemented **through**
   `mergeSessionFeedback`/`applySessionFeedback` and
   `saveAnnotationsWithSyncMarker`, not raw `setAnnotations([...prev, x])`.
   `mergeSessionFeedback` already protects notes created while a request is in
   flight; do not bypass it.
4. Disable layout mode / design placements for the critique build (no prop gate
   exists; add one) so `kind: placement|rearrange` cannot be produced while
   `comments-server` drops those fields. Otherwise they round-trip as plain
   feedback notes with wrong markers after reload.
5. Freeze button: drop it (upstream has no prop) and unbind `P`; keep
   `showFreezeButton` only if small diffs need it — note the widget is only
   injected for `< 1 MB` HTML (`worker.tsx:893`), so the 185K-node concern does
   not apply to the pages that would show it.

UX fixes to land in the same release (from UI/UX lens):
- Copy must never mutate: hide `autoClearAfterCopy` (default off, but reachable)
  or scope clears to the current author. A read action must not delete other
  reviewers' annotations.
- Copy feedback: announce success/failure (`role="status"`), do not show the
  success morph when the clipboard write failed.
- `generateOutput()` prints `**Anchor:**` and drops `Location` when an anchor
  exists, so copied text and `/annotations` agree.
- Retarget or drop the visualViewport counter-transform: apply it to the portal
  host (`[data-agentation-portal]`) or remove it.
- Clearance CSS: `body:has([data-agentation-portal])` instead of
  `body:has(#critique-agentation)`; hide `#to-top` while the settings panel is
  open.
- Marker hit area >= 28-32px, marker text contrast >= 4.5:1, safe-area insets
  for launcher/clearance.
- Clamp toolbar width to `min(337px, 100vw - 40px)`; verify at 320px.
- Shortcuts: disable global shortcuts or whitelist `H`/`C`; never leave `X`
  (clear all) or `L` (layout) bound on a diff page.

Verification:
- `bun run build` in `cli/` (tsc).
- `bun run build:comments-widget` (root) and record bundle size.
- `bun run worker:deploy` (preview) then `bun run test:agentation-preview`.
- Widget-level check per precondition 3.
- Manual matrix: create/edit/delete; two tabs; copy; reload; mobile Safari
  pinch/drag; large diff (>1 MB) skips widget; password-protected diff;
  keyboard-only pass.
- Size gate: current 321 KB raw / 65 KB gzip. Budget: `<= 1.25x` gzip growth
  unless Shadow DOM removes the `@scope`-class workaround, in which case
  document the trade in the PR.

Rollback: revert the pin, rebuild widget, redeploy; keep `latest` on the
previous fork release until preview passes.

## 5. Workstream C — server hardening (pre-existing, parallel)

1. `authorId` assigned server-side only (`agentation-api.ts:104` currently lets
   the client value win). Ignore the client field.
2. Thread `role` whitelisted to `human` for unauthenticated callers.
3. Validate `anchor` (`^[^\s:]+:\d+(-\d+)?$`) and strip CR/LF/control chars from
   every free-text field interpolated into agent markdown
   (`cli/src/routes/annotations-context.tsx`), or fence untrusted content.
4. Escape `title` in `injectOgTags` (`worker.tsx:436-455`).
5. Authz e2e: password-protected diff returns 401 for GET/PATCH/DELETE/thread
   and `/a/sessions/:id` without the password (currently zero coverage).
6. Decide annotation ownership for PATCH/DELETE. Note: the committed e2e
   **asserts the permissive behavior** — user B PATCHes and deletes user A's
   annotation and expects 200 (`cli/src/agentation-api.preview.e2e.test.ts:277-286`,
   `:329-335`). If ownership is restricted, rewrite those cases in the same
   change; if cross-user edits are intended (shared review), record that and
   close finding #8 as accepted behavior.
7. Validate session ids against `DIFF_ID_REGEX` and rate-limit `POST /a/sessions`
   (currently unbounded DO creation).
8. `Dockerfile:34`: `bun install --ignore-scripts --frozen-lockfile`.

## 6. Workstream D — versioning if we fork

Two layers, git and package.

### D0. This repo's version line

- Current: `cli/package.json` **0.4.2**, tag `v0.4.2` (commit `7bb4cbd`),
  HEAD `a9e5588` on `origin/main`. Upstream `remorses/critique` and npm
  `critique` are at 0.4.0, so this fork has diverged.
- Independent semver line; never reuse an upstream version for different code.
  Workstream A (duplicate fix) -> **0.4.3**; workstream B (migration) -> **0.5.0**.
- Tag must equal `cli/package.json`. A published version is **immutable**: the
  workflow refuses to rebuild a tag that already has assets. Bump, never move a
  tag, and protect `v*` with a repository ruleset.
- No npm publish: npm `critique` belongs to a third party. Releases are GitHub
  assets `critique-<version>.tgz` + sha256, with the built commit in the body.
- `.changeset/*.md` files are release notes for the next release commit;
  nothing consumes them. `cli/CHANGELOG.md` is updated in the release commit
  (see `7bb4cbd`).
- Release notes record the agentation base, e.g. "agentation: 3.1.2-fork.1".
- The widget is not built by the release workflow (`agentation-widget.js` is
  gitignored and built by `build:comments-widget` at deploy), so the CLI tarball
  version does not encode the widget version. Record it in the release notes.

### D1. Fork source (git)

- `main` = pristine upstream mirror; never commit to it.
- `critique-3` = patch commits rebased on upstream tags.
- Release tags: `v<upstream>-fork.<n>` (e.g. `v3.1.2-fork.1`).
- `FORK.md` in the fork: upstream base tag, patch list, rebase command, and the
  reason each patch exists (upstream PR link or "declined").
- Upgrade cadence: monthly check; rebase per upstream release.

### D2. Package version (if published)

- Every build we publish is `<upstream>-fork.<n>` (e.g. `3.1.2-fork.1`). Never
  publish a bare upstream version under the fork scope: our build is never
  byte-identical to upstream, and a bare version makes provenance ambiguous.
- Rebuilds of the same base (a second fork patch): increment `<n>`.
- `npm publish` defaults to `latest` even for a prerelease, and a prerelease
  sorts below the base version. Mandatory commands:
  - candidates: `npm publish --tag next`
  - promotion: `npm dist-tag add @scope/agentation@3.1.2-fork.<n> latest`
- Semver caveat: `3.1.2-fork.1` sorts **below** `3.1.2`, and caret ranges skip
  prereleases. `^3.1.2-fork.1` does match `3.1.3` — another reason to pin exact
  versions in `cli/package.json` (already the repo's rule for `@opentuah`).
- Publish from CI with `--provenance`; 2FA on the scope; record who owns
  `latest`. Nothing in this repo publishes to npm today, so this is a manual
  decision, not an existing pipeline.

### D3. Package version (if not published)

The upstream repo is a **monorepo**: root `package.json` is private and has no
`main`/`exports`; the real package is in `package/`. Bun and npm cannot install
a package from a git subdirectory, so `github:<owner>/agentation#<sha>` alone
does **not** work. Also: bun only runs lifecycle scripts for git dependencies
that are explicitly trusted, and `Dockerfile:34` passes `--ignore-scripts`, so a
`prepare` script is not a reliable build hook.

Options, in order of preference:

1. **Dist branch in the fork** (viable without npm): keep `main` as the upstream
   mirror and `critique-3` as the patch branch, then produce a third branch
   `dist` whose **root** contains `package.json`, `dist/`, `LICENSE`, `README`.
   Pin `github:<owner>/agentation#<40-char-sha-of-dist-branch>`; commit
   `bun.lock`; add `--frozen-lockfile` to `Dockerfile:34`. The SHA must be
   immutable and every release rebuilds the `dist` branch.
2. **Vendored workspace** (`packages/agentation` + `workspace:*`): atomic
   commits, no publish, CI builds it. Cost: ~6 MB of source + license file
   in-repo and one extra build step before `build:comments-widget`.
3. **Restructure the fork** so the package sits at the repo root. Simplest for
   consumers, but it breaks straightforward rebases against the upstream
   monorepo, so only if the fork will never track upstream again.

In all cases: commit `bun.lock` with integrity, and record the upstream base in
`FORK.md` (tag + commit SHA, e.g. `v3.1.2` / `7982d83a`).

### D4. Coupling to critique releases

- The page loads `/agentation-widget.js?v=<id>` (`worker.tsx:905`). CI stamps
  `BUILD_ID` with the built commit (`release.yml`, `docker.yml:77`); a plain
  `docker build` keeps `dev`, and the URL then falls back to the package
  version, so it still changes when `cli/package.json` is bumped. A widget-only
  swap without a version bump would not bust the cache — include the widget base
  in the release notes and bump when the widget changes.
- The release tarball does **not** contain the widget (CI never runs
  `build:comments-widget`), but `cli/package.json` `files` includes `public`,
  and `files` overrides `.gitignore` — so a local `bun pm pack` from a worktree
  with a built widget can ship an unversioned, possibly stale bundle. Either
  build the widget in the release workflow (deterministic) or exclude
  `public/agentation-widget.js` explicitly from the tarball.
- Critique releases stay tag-driven: bump `cli/package.json`, tag matching
  version, `git push --follow-tags`; nothing goes to npm.
- Add a changeset for the user-facing fix in workstream A.

### D5. Artifact decision (superseded by vendoring)

> Superseded: the widget is now vendored at `packages/agentation` and consumed
> as `workspace:*`. No fork repo, `dist` branch, npm scope, or SHA pin is used.
> The text below is kept as the decision record.

Inputs: the `@critique.work` npm scope is controlled by `xmorse`, not us, so
registry publishing is out. `shahboura/critique` is our own account
(`shahboura` has 30 repos; **no agentation fork exists yet** — `shahboura/agentation`
returns 404). The current agentation fork in use is `remorses/agentation`,
branch `critique`, version 2.5.5. The new fork repo is **proposed**, not
existing: it will be `shahboura/agentation` if forked with the GitHub default
name. It will be public, so CI and self-hosters can install the git dependency
without a token.

Decision (**conditional on D6**): create a fork under `shahboura` (default name
`shahboura/agentation`) and consume its `dist` branch by SHA. Base the fork on
`remorses/agentation` (see D5a) to preserve the existing patch history.

```
shahboura/agentation
├─ main        mirror of benjitaylor/agentation (fetch only, never commit)
├─ critique    2.5.5 + duplicate fix
│              tags: v2.5.6-fork.1
├─ critique-3  patch commits on tag v3.1.2 (commit 7982d83a)
│              tags: v3.1.2-fork.1, v3.1.2-fork.2, ...
└─ dist        orphan branch; repository root IS the package
               package.json (name kept: @critique.work/agentation,
                             version <fork version>, files: ["dist"])
               dist/  LICENSE  README.md
               tags: dist-v2.5.6-fork.1, dist-v3.1.2-fork.1, ...
```

Workstream A consumes `dist-v2.5.6-fork.1`; workstream B consumes
`dist-v3.1.2-fork.1`. The registry package cannot be replaced, so both need the
dist artifact before their critique release.

Consumption in this repo:

```json
"@critique.work/agentation": "github:shahboura/agentation#<40-char-dist-sha>"
```

Rules:

- The pin is the **dist commit SHA**, never a branch name.
- Keep the package name `@critique.work/agentation` in the fork to avoid touching
  every import; the name is a private identifier on a git dependency, not a
  claim on the npm scope. `FORK.md` states this explicitly.
- `bun.lock` is committed; `Dockerfile:34` must add `--frozen-lockfile`.
- Every release updates `dist`, tags it `dist-v<version>`, and records both the
  source SHA and the dist SHA in `FORK.md` and the critique release notes.
- Provenance chain: critique commit -> lockfile SHA -> dist commit -> source
  tag `v<upstream>-fork.<n>` -> upstream base `v3.1.2` / `7982d83a`.

### D5a. Fork base (superseded)

> Superseded by the vendored workspace; kept for history.

| Base | Repo becomes | Pros | Cons |
|---|---|---|---|
| `remorses/agentation` | `shahboura/agentation` (GitHub default name) | keeps the exact `critique` branch history behind 2.5.5, including the patch commits we still need | `main` in that fork is stale (Feb 2026); must reset it from `benjitaylor` and add `benjitaylor` as `upstream` |
| `benjitaylor/agentation` | `shahboura/agentation` | clean upstream `main`, no inherited branches | the 2.5.5 patch commits must be re-applied by hand before a 2.5.6 fix |

Recommended: fork `remorses/agentation`, then `git remote add upstream
https://github.com/benjitaylor/agentation.git` and force-reset `main` to
`upstream/main`. The `critique` branch stays as-is and `critique-3` starts from
tag `v3.1.2`.

### D6. License and attribution (public fork)

- The fork is a public redistribution of a PolyForm Shield 1.0.0 work. Keep
  `LICENSE` at the root of `dist` and the fork repo; state the modifications in
  `FORK.md` ("modified fork of agentation, patches listed below").
- Critique bundles the code into `cli/public/agentation-widget.js`, which today
  carries no notice. Add attribution in one of two ways:
  1. a banner prepended by `cli/scripts/build-widget.ts`, or
  2. a `cli/public/third-party-licenses.txt` served alongside the widget and
     referenced from the repo README.
- The unresolved legal question is scope, not attribution: whether bundling the
  fork in critique.work counts as competing use under the license. Record the
  answer before making the fork public.
- Changesets in this repo are **release notes only** (nothing reads them yet per
  AGENTS.md); the fork's own release note lives in `FORK.md`.

## 7. Knowledge graph

- `graphify 0.9.93`, `graph.json` schema_version 1, refreshed at `3064a69`:
  7,575 nodes / 9,596 edges / 1,497 communities.
- `graphify-out/` is gitignored. Graph covers code only; this plan file and
  `cli/tmp` are not nodes.
- Refresh with `graphify update .` after code changes.

## 8. Decisions required

1. **License**: the vendored code lives in this public repo; `packages/agentation/LICENSE`
   ships and the widget carries a notice plus `cli/public/third-party-licenses.txt`.
   The open question is scope: does bundling it in critique.work count as
   competing use under PolyForm Shield? Record the answer.
2. **Publish path — superseded**: vendored workspace (`packages/agentation` +
   `workspace:*`). No fork, dist branch, npm publish, or SHA pin.
3. **Layout mode**: disable it in the critique build (recommended) or persist
   `kind`/`placement`/`rearrange` server-side.
4. **Freeze button**: drop (recommended) or keep with the small patch.
5. **Widget verification**: browser smoke test or signed manual matrix.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Upstream 3.1.2 merge model differs from the fork's raw append | patch through `mergeSessionFeedback`; test created-before-response |
| Larger bundle (2.2x) hurts diff page load | relative size gate; widget skipped > 1 MB; measure on preview |
| Shadow DOM changes z-index/focus/portal behavior | widget-level check + manual matrix before removing workarounds |
| Fork drifts again | small patch stack, monthly rebase, `FORK.md` |
| Server drops 3.1.2 fields | disable layout mode; round-trip field test |
| Unattributed/unauthorized annotation writes | workstream C |

## 10. Findings vs current implementation (verified 2026-10-30, HEAD `a9e5588`)

Every finding the plan depends on was re-checked against the current code. None
of the correctness or security findings are implemented yet; the release and
build-id findings were implemented by the `0.4.2` work that landed mid-review.

| # | Finding | Evidence (current) | Status |
|---|---|---|---|
| 1 | Annotation id is rewritten server-side, racing the SSE `created` event | `cli/src/agentation-api.ts:97-99`, `comment-room.ts:138`, fork `addAnnotation` | CONFIRMED, open |
| 2 | Create is not idempotent (blind INSERT + unconditional append + emit) | `comment-room.ts:129-138` | CONFIRMED, open |
| 3 | Client-supplied `authorId` overrides the cookie identity | `agentation-api.ts:104` | CONFIRMED, open |
| 4 | Thread `role` is proxied verbatim and trusted by the DO | `agentation-api.ts:166-177`, `comment-room.ts:183-194` | CONFIRMED, open |
| 5 | `anchor` / free text interpolated raw into agent markdown | `routes/annotations-context.tsx:51-69` | CONFIRMED, open |
| 6 | `og:title` interpolated unescaped into HTML attributes | `worker.tsx:436-455` | CONFIRMED, open |
| 7 | No password/protected-diff authz coverage | `agentation-api.preview.e2e.test.ts` (0 matches) | CONFIRMED, open |
| 8 | PATCH/DELETE authorize on id alone (no ownership) | `comment-room.ts:142-181` | CONFIRMED, open; e2e asserts cross-user writes (see §5.6) |
| 9 | `POST /a/sessions` mints arbitrary DO names, no rate limit | `agentation-api.ts:70-79` | CONFIRMED, open |
| 10 | Docker install is not lockfile-frozen | `Dockerfile:34` | CONFIRMED, open |
| 11 | A **local** `bun pm pack` can ship an arbitrary/stale widget (`files` includes `public`, which overrides `.gitignore`); CI packs a fresh checkout with no widget | `.github/workflows/release.yml:85-88`, `cli/package.json:9-13`, `.gitignore:46` | CONFIRMED, open (release mechanics) |
| 12 | `@scope` monkey-patch is not in the widget (docs claim it is) | `cli/src/agentation-widget.tsx` | CONFIRMED, docs stale |
| 13 | Preview e2e is server-only, cannot validate the widget | test file header | CONFIRMED |
| 14 | visualViewport fix targets an empty container (portal goes to body) | fork `index.tsx:5312`; upstream `use-feedback-portal.ts` | CONFIRMED |
| 15 | Widget skipped for HTML >= 1 MB | `worker.tsx:893` | CONFIRMED |
| 16 | 3.1.2 feedback ids funnel through `addAnnotation`; design ids do not | 3.1.2 `index.tsx:1662,1721,2061,2529,2564` -> `:2646` | CONFIRMED |
| 17 | 3.1.2 has merge-aware sync (`mergeSessionFeedback`, `serverIds`) | `utils/merge-session-feedback.ts` | CONFIRMED |
| 18 | Server field whitelist drops `kind`/`placement`/`frame`/`attributes` etc. | `comment-room.ts:96-127` | CONFIRMED, open |
| 19 | PolyForm LICENSE ships in the npm tarball | `cli/tmp/up-agentation/package/LICENSE` | CONFIRMED |
| 20 | Upstream declined multi-user SSE | PR #116, closed 2026-09-22 | CONFIRMED |
| 21 | Current fork patch set (5 patches) | `remorses/agentation` `critique` branch | CONFIRMED |
| 22 | Knowledge graph is stale | graph `56f3771b` vs HEAD `a9e5588` | STALE, refresh needed |
| 23 | Plan said `cli` 0.4.1 / rebuildable tags | `cli/package.json` 0.4.2; `v0.4.2` immutable | STALE, corrected in D0 |
| 24 | Plan said plain Docker builds serve `?v=dev` | `worker.tsx:905` falls back to package version | STALE, corrected in D4 |
| 25 | Build-id stamping is hardened (token-only, `git rev-parse HEAD`) | `Dockerfile:44-48`, `release.yml` | NEW, reflected in D4 |
| 26 | Published versions are immutable in the workflow; `v*` ruleset is still a repo setting | `AGENTS.md`, `SELF-HOSTING.md:138`, `release.yml` | NEW: workflow ✓, ruleset TODO |

Open items 1-9 are workstream A/C scope. Items 10-11 are release mechanics (D).
Items 12-21 are inputs to workstream B. Items 22-26 are documentation/release
facts already folded into this plan.

## 11. Outcome (implemented on `feat/agentation-v3`)

Commits:

| Commit | What |
|---|---|
| `f6f7591` | vendored upstream v3.1.2 as `packages/agentation` (subtree + prune) |
| `76b2bf8` | id fix, anchor, SSE, server hardening, CSS, docs, changeset |
| `3064a69` | review-gate fixes + `0.5.0` release commit |

Verification at `3064a69`:

- `packages/agentation`: 295/295 tests pass (27 files, serial).
- `cli/src/agentation-api.test.ts`: 3/3.
- Preview e2e against local `wrangler dev`: 1/1, 42 assertions (real DO + workerd SQLite).
- Builds: package, minified widget (451 KB raw / 113 KB gzip), comments-server, CLI `tsc`; Docker build passed.
- Knowledge graph refreshed: 7,575 nodes / 9,596 edges.

Known gaps:

1. Freehand drawing is disabled: upstream v3.1.2 retains the state but removed the
   stroke handlers; enabling the button would ship a dead control. Port the 2.5.5
   drawing implementation before re-enabling.
2. Preview/production deploy needs `CLOUDFLARE_API_TOKEN`; browser matrix not run.
3. `authorId` is cookie-derived, not an identity; agent thread role needs the
   machine-wide owner secret; a predictable id can be pre-claimed.
4. Live region inside Shadow DOM is unverified in Safari; `#to-top` can be
   obscured while settings are open; v3 frame tracking walks the document behind
   the 1 MB gate.
5. `v0.5.0` is not tagged and nothing is pushed.
