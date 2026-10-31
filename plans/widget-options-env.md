# Plan: widget options from env (revised after independent review)

Status: revised. Awaiting approval before implementation.

## 1. Goal

Self-hosted deployments control the comments widget's host-level flags from
`docker-compose` env vars, parsed once in the worker, injected flat into
`__CRITIQUE_CONFIG__`, forwarded as props. Disabled controls are not rendered,
so the toolbar has no empty slot.

Non-goals: layout mode, frame tracking and shared-session auto-clear stay
hardcoded (reasons below). No string props, no per-page overrides, no layout
persistence.

## 2. Scope: three vars, not six

Reviewers ranked the six proposed flags and four had no acceptance criterion
and no plausible user. Three survive:

| Env var | Prop | Default | Off means |
|---|---|---|---|
| `CRITIQUE_WIDGET_FREEZE` | `showFreezeButton` | `on` | pause button absent; `P` unbound |
| `CRITIQUE_WIDGET_WEBHOOKS` | `enableWebhooks` (new fork prop) | `on` | `fireWebhook` returns before any fetch; `canSend` false; webhook section hidden; MCP stays |
| `CRITIQUE_WIDGET_KEYBOARD` | `enableKeyboardShortcuts` | `on` | all document shortcuts off (⌘⇧F included) — documented, or hoist the modifier shortcut if review prefers |

Hardcoded, with a comment at the call site:

- `enableLayoutMode: false` — worker drops `kind: placement|rearrange`, so on = data loss.
- `enableFrameTracking: false` — diff pages have no same-origin frames.
- `autoClearSharedAnnotations: false` — shared pages are multi-reviewer; on = deleting other people's notes.

## 3. Propagation (proven pattern)

```
compose environment: CRITIQUE_WIDGET_FREEZE: ${CRITIQUE_WIDGET_FREEZE:-}
  → docker-entrypoint.sh: allowlist check → wrangler dev --var "CRITIQUE_WIDGET_FREEZE:off"
  → worker.tsx: boolVar(c.env.CRITIQUE_WIDGET_FREEZE, true)
  → __CRITIQUE_CONFIG__ flat keys (showFreezeButton, enableWebhooks, enableKeyboardShortcuts)
  → agentation-widget.tsx: props with `??` fallbacks
```

`--var` → `c.env` for an undeclared var is already proven by the image smoke
test (`docker-entrypoint.sh:32`, `worker.tsx:151`,
`.github/workflows/docker.yml:84-93`). Flat keys, not a nested `widget`
object: the old bundle reads `showFreezeButton` today, so flat keeps cached
pages and rollbacks working; a nested key would silently drop it.

The entrypoint allowlists each value (`on|off|true|false|1|0`, empty = unset)
and exits non-zero otherwise: a typo must not fail open on a security switch.

## 4. Code changes

1. `cli/src/widget-options.ts` (new, no worker imports): `boolVar()` and
   `readWidgetOptions(env)`; pure, unit-testable.
2. `cli/src/worker.tsx`: extend `Bindings` (line 44); replace
   `showFreezeButton: true` (line ~897) with the three derived keys; keep
   `userId` out (already removed).
3. `cli/src/agentation-widget.tsx`: read the keys with explicit fallbacks —
   `freeze ?? true`, `webhooks ?? true`, `keyboard ?? true`; keep the other
   three hardcoded `false` with comments.
4. `packages/agentation/src/components/page-toolbar-css/index.tsx`:
   - new `enableWebhooks = true` prop; `fireWebhook` returns `false` before
     resolving `targetUrl` when disabled;
   - `hasWebhookTarget` includes `enableWebhooks`, so `canSend` is false and
     the Send control never renders/fails;
   - keep the Send wrapper as is: `width:0; margin-left:-6px` already cancels
     the 6px flex gap exactly (review math), so conditionally rendering it
     would only make width flips jump.
5. `packages/agentation/src/components/page-toolbar-css/settings-panel/index.tsx`:
   accept `enableWebhooks`; hide only the webhook block, keep the MCP section
   and the nav row (MCP status is unrelated to webhooks).
6. `docker-entrypoint.sh`: validate + pass the three vars.
7. `docker-compose.yml`: **active** pass-throughs `${VAR:-}` (not comments).
8. `SELF-HOSTING.md`: env table with defaults and the 24h cache caveat.
9. `.changeset/widget-options-env.md`: patch note.

## 5. Tests

- `cli/src/widget-options.test.ts`: on/off/true/false/1/0, empty, garbage,
  missing; all-off mapping; flat serialized config shape.
- `packages/agentation/.../index.test.tsx`: `enableWebhooks={false}` + saved
  URL + `webhooksEnabled:false` → no Send control, `fetch` never called,
  `onSubmit`-only send still ends "sent"; keyboard-off semantics.
- `settings-panel/index.test.tsx`: webhook block hidden, MCP visible.
- `bun run build` (cli), `test:agentation`, `e2e`.
- Manual: built image with all three off; verify page config, bar width via
  Playwright bounding boxes (not screenshots), no webhook POST with a saved
  localStorage URL (route intercept), and `?v=mobile` uses the same config.

## 6. Risks

- Cached HTML (`public, max-age=86400`) delays a flag flip up to 24h; it is a
  policy switch, not a DLP boundary — a reviewer can still POST from devtools.
- Fork drift: `enableWebhooks` is a fork patch; re-apply on agentation upgrades.
- `KEYBOARD=off` also disables ⌘⇧F and Esc unless the modifier block is hoisted.

## 7. Acceptance criteria

1. No vars set: serialized config equals today's values (freeze on; layout,
   frame tracking, shared clear off; keyboard, webhooks on) and the toolbar is
   unchanged.
2. `FREEZE=off`: no pause control, no leftover gap (bar width shrinks by the
   control's width + gap, measured).
3. `WEBHOOKS=off`: webhook block absent, MCP block present, zero webhook POSTs
   with a saved URL and a manual send attempt, no Send control.
4. `KEYBOARD=off`: documented behaviour holds; popup Enter/Esc still work.
5. `bun test src/widget-options.test.ts`, `bun run build`, `test:agentation`,
   `e2e` all pass.
