import { expect, test } from "bun:test"
import { baseVersion, compareVersions, parseVersion } from "./check-agentation-upstream"

test("orders versions numerically", () => {
  expect(compareVersions("v3.10.0", "v3.9.0")).toBeGreaterThan(0)
  expect(compareVersions("v3.1.2", "v3.1.1")).toBeGreaterThan(0)
  expect(compareVersions("v3.1.2", "v3.1.2")).toBe(0)
})

test("parses tags and fork versions", () => {
  expect(parseVersion("v3.1.2")).toEqual([3, 1, 2])
  expect(baseVersion("3.1.2-fork.4")).toBe("3.1.2")
  expect(baseVersion("3.1.2")).toBe("3.1.2")
  expect(() => parseVersion("nightly")).toThrow()
})
