# Changesets

This folder contains **pending release notes**. Each `.md` file describes one user-facing fix or feature. No tooling consumes them: releases are cut by bumping `cli/package.json` and pushing a `v<version>` tag, and the notes are folded into `cli/CHANGELOG.md` by hand.

## What to put here

- Add one descriptive kebab-case `.md` file per logical change, for example `fix-syntax-highlighting.md`.
- Use `patch` for fixes and internal/metadata changes; `minor` for new commands, flags or page features.
- Write in present tense, focused on what users see.
- Check GitHub issues first. If the change fixes one, include `Fixes #123` on its own line.

## What not to put here

- Do not add changesets for private packages or packages without a `version` field.
- Do not edit `CHANGELOG.md` directly.
- Do not run the interactive changeset CLI.
- Do not add vague entries like "misc improvements" or "update internals".
