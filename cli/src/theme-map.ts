// Remaps captured span CSS from one theme to another.
//
// The capture only knows final hex colors: `ansi-html.ts` bakes one CSS class
// per unique (fg, bg, attributes) combo. To offer every theme from a single
// render we recover the semantic role behind each color (the theme JSON keys)
// and swap in the same role from the target theme. Re-rendering per theme would
// be exact but multiplies render time and upload size.

import { getResolvedTheme, rgbaToHex, type ResolvedTheme } from "./themes.js"
import type { ThemeVariant } from "./ansi-html.js"

/**
 * Roles ordered most-specific first. When several roles share a color in the
 * source theme, the first one wins, so diff and syntax colors keep their intent
 * instead of collapsing into `text`.
 */
const ROLE_PRIORITY: (keyof ResolvedTheme)[] = [
  "diffAdded",
  "diffRemoved",
  "diffAddedBg",
  "diffRemovedBg",
  "diffContextBg",
  "diffAddedLineNumberBg",
  "diffRemovedLineNumberBg",
  "diffLineNumber",
  "syntaxKeyword",
  "syntaxString",
  "syntaxComment",
  "syntaxNumber",
  "syntaxFunction",
  "syntaxType",
  "syntaxVariable",
  "syntaxOperator",
  "syntaxPunctuation",
  "markdownHeading",
  "markdownLink",
  "markdownLinkText",
  "markdownCode",
  "markdownBlockQuote",
  "markdownEmph",
  "markdownStrong",
  "markdownHorizontalRule",
  "markdownListItem",
  "markdownListEnumeration",
  "markdownImage",
  "markdownImageText",
  "markdownCodeBlock",
  "markdownText",
  "success",
  "error",
  "warning",
  "info",
  "primary",
  "conceal",
  "textMuted",
  "text",
  "backgroundPanel",
  "background",
]

/** hex color -> role, for the colors this theme actually uses */
export function buildColorRoleMap(theme: ResolvedTheme): Map<string, keyof ResolvedTheme> {
  const roles = new Map<string, keyof ResolvedTheme>()
  for (const role of ROLE_PRIORITY) {
    const color = rgbaToHex(theme[role]).toLowerCase()
    // Keep the most specific role that produced this color
    if (!roles.has(color)) roles.set(color, role)
  }
  return roles
}

/**
 * Rewrite `color:` and `background-color:` declarations from `from` to `to`.
 * Colors with no matching role pass through unchanged.
 */
export function remapSpanCss(css: string, from: ResolvedTheme, to: ResolvedTheme): string {
  const roles = buildColorRoleMap(from)
  return css.replace(/(color|background-color):(#[0-9a-f]{6})/gi, (match, property: string, value: string) => {
    const role = roles.get(value.toLowerCase())
    if (!role) return match
    return `${property}:${rgbaToHex(to[role])}`
  })
}


/** Light or dark, from the background luminance */
export function themeMode(theme: ResolvedTheme): "light" | "dark" {
  const hex = rgbaToHex(theme.background).replace("#", "")
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "light" : "dark"
}

const LABEL_OVERRIDES: Record<string, string> = {
  github: "GitHub",
  "github-light": "GitHub Light",
  opencode: "OpenCode",
  "opencode-light": "OpenCode Light",
  tokyonight: "Tokyo Night",
  "one-dark": "One Dark",
}

/** "catppuccin-frappe" -> "Catppuccin Frappe" */
export function themeLabel(name: string): string {
  return LABEL_OVERRIDES[name] ?? name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Build the picker variants from a single captured body: the base theme keeps
 * its own CSS, every other theme gets the same rules with colors remapped.
 */
export function buildThemeVariants(
  themeNames: string[],
  baseSpanCss: string,
  baseThemeName: string,
): ThemeVariant[] {
  const base = getResolvedTheme(baseThemeName)
  return themeNames.map((name) => {
    const theme = name === baseThemeName ? base : getResolvedTheme(name)
    return {
      name,
      label: themeLabel(name),
      background: rgbaToHex(theme.background),
      text: rgbaToHex(theme.text),
      muted: rgbaToHex(theme.textMuted),
      link: rgbaToHex(theme.markdownLink),
      added: rgbaToHex(theme.diffAdded),
      removed: rgbaToHex(theme.diffRemoved),
      spanCss: name === baseThemeName ? baseSpanCss : remapSpanCss(baseSpanCss, base, theme),
      mode: themeMode(theme),
    }
  })
}
