import { describe, expect, test } from "bun:test"
import { truncateToWidth } from "./directory-tree-view.js"

describe("truncateToWidth", () => {
  test("keeps names that fit", () => {
    expect(truncateToWidth("README.md", 20)).toBe("README.md")
    expect(truncateToWidth("README.md", 9)).toBe("README.md")
  })

  test("truncates with an ellipsis that fits the width", () => {
    const result = truncateToWidth("web-themes-responsive-markdown-preview.md", 20)
    expect(result).toBe("web-themes-responsi\u2026")
    expect(result.length).toBe(20)
  })

  test("does nothing when there is no cap", () => {
    expect(truncateToWidth("a-very-long-name.ts", Number.POSITIVE_INFINITY)).toBe("a-very-long-name.ts")
  })
})
