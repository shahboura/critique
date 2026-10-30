#!/usr/bin/env bun
// Report whether a newer upstream agentation release is available.
//
// The widget is a git subtree of benjitaylor/agentation `package/`. This check
// exits 1 when a newer vX.Y.Z tag exists, so the scheduled workflow turns into
// a notification instead of silently drifting.
//
// Invariant: the base of packages/agentation/package.json (`3.1.2-fork.1` ->
// `3.1.2`) is the last upstream tag that was pulled. Raising the base without
// pulling would silence this check.

import { execFileSync } from "node:child_process"
import pkg from "../packages/agentation/package.json"

const UPSTREAM = "https://github.com/benjitaylor/agentation.git"

export function parseVersion(version: string): [number, number, number] {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/)
  if (!match) throw new Error(`Cannot parse version: ${version}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(a: string, b: string): number {
  const [a1, a2, a3] = parseVersion(a)
  const [b1, b2, b3] = parseVersion(b)
  return a1 - b1 || a2 - b2 || a3 - b3
}

export function baseVersion(version: string): string {
  return version.replace(/-fork(?:\.\d+)?$/, "")
}

function main(): void {
  const current = baseVersion(pkg.version)

  let tags: string[]
  try {
    const output = execFileSync("git", ["ls-remote", "--tags", UPSTREAM, "refs/tags/v*"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    })
    tags = output
      .split("\n")
      .map((line) => line.match(/refs\/tags\/(v\d+\.\d+\.\d+)$/)?.[1])
      .filter((tag): tag is string => Boolean(tag))
  } catch (error) {
    console.error(`Could not read upstream tags: ${(error as Error).message}`)
    process.exit(2)
  }

  const latest = tags.sort(compareVersions).at(-1)?.replace(/^v/, "")
  if (!latest) {
    console.error("No upstream vX.Y.Z tags found")
    process.exit(2)
  }

  if (compareVersions(latest, current) <= 0) {
    console.log(`Up to date: local base ${current}, upstream ${latest}`)
    process.exit(0)
  }

  console.log(`Upstream ${latest} is newer than local base ${current}.`)
  console.log(
    `Pull with: git subtree pull --prefix packages/agentation ${UPSTREAM} v${latest}`,
  )
  process.exit(1)
}

if (import.meta.main) main()
