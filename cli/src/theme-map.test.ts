import { describe, expect, test } from "bun:test"
import { buildColorRoleMap, buildThemeVariants, remapSpanCss } from "./theme-map.js"
import { getResolvedTheme, rgbaToHex } from "./themes.js"

describe("buildColorRoleMap", () => {
  test("maps each color to its most specific role", () => {
    const theme = getResolvedTheme("github")
    const roles = buildColorRoleMap(theme)
    expect(roles.get(rgbaToHex(theme.diffAdded).toLowerCase())).toBe("diffAdded")
    expect(roles.get(rgbaToHex(theme.diffRemoved).toLowerCase())).toBe("diffRemoved")
    expect(roles.get(rgbaToHex(theme.syntaxKeyword).toLowerCase())).toBe("syntaxKeyword")
    // Page-background colors may collide with a diff background role; either is fine
    expect(roles.has(rgbaToHex(theme.background).toLowerCase())).toBe(true)
  })
})

describe("remapSpanCss", () => {
  test("swaps foreground colors through the role table", () => {
    const from = getResolvedTheme("github")
    const to = getResolvedTheme("nord")
    const added = rgbaToHex(from.diffAdded).toLowerCase()
    const css = `.s0{color:${added}}\n.s1{color:#123456}`

    const remapped = remapSpanCss(css, from, to)

    expect(remapped).toContain(`.s0{color:${rgbaToHex(to.diffAdded)}}`)
    // Unknown colors are left alone
    expect(remapped).toContain(".s1{color:#123456}")
    // Class names never change: the body is shared across themes
    expect(remapped).toContain(".s0{")
    expect(remapped).toContain(".s1{")
  })

  test("swaps background colors and keeps attributes", () => {
    const from = getResolvedTheme("github")
    const to = getResolvedTheme("tokyonight")
    const addedBg = rgbaToHex(from.diffAddedBg).toLowerCase()
    const css = `.s7{color:${rgbaToHex(from.text)};background-color:${addedBg};font-weight:bold}`

    const remapped = remapSpanCss(css, from, to)

    expect(remapped).toContain(`background-color:${rgbaToHex(to.diffAddedBg)}`)
    expect(remapped).toContain(`color:${rgbaToHex(to.text)}`)
    expect(remapped).toContain("font-weight:bold")
  })

  test("remapping to the same theme is a round-trip", () => {
    const theme = getResolvedTheme("catppuccin")
    const css = `.s0{color:${rgbaToHex(theme.diffAdded)};background-color:${rgbaToHex(theme.diffRemovedBg)}}`
    expect(remapSpanCss(css, theme, theme)).toBe(css)
  })

})

describe("buildThemeVariants", () => {
  test("keeps the base theme CSS and remaps the others", () => {
    const base = getResolvedTheme("github")
    const baseSpanCss = `.s0{color:${rgbaToHex(base.diffAdded)}}`
    const variants = buildThemeVariants(["github", "nord"], baseSpanCss, "github")

    expect(variants).toHaveLength(2)
    expect(variants[0]!.spanCss).toBe(baseSpanCss)
    expect(variants[1]!.spanCss).toBe(
      `.s0{color:${rgbaToHex(getResolvedTheme("nord").diffAdded)}}`,
    )
    expect(variants[0]!.label).toBe("GitHub")
    expect(variants[1]!.label).toBe("Nord")
  })

  test("groups themes by background luminance", () => {
    const variants = buildThemeVariants(["github", "github-light"], "", "github")
    expect(variants.find((variant) => variant.name === "github")!.mode).toBe("dark")
    expect(variants.find((variant) => variant.name === "github-light")!.mode).toBe("light")
  })
})
