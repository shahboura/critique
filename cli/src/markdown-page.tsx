// Worker-side markdown preview page.
// Renders stored markdown with `marked`, but raw HTML tokens are escaped and
// unsafe URL schemes are dropped: diff content comes from arbitrary repos.
// The route also sends MARKDOWN_CSP, so even a missed vector has no script.

import { Marked } from "marked"

export interface MarkdownPalette {
  background: string
  text: string
  muted: string
  link: string
}

export const DEFAULT_MARKDOWN_PALETTE: MarkdownPalette = {
  background: "#0d1117",
  text: "#e6edf3",
  muted: "#8b949e",
  link: "#58a6ff",
}

/** No scripts except the theme pick-up script, which must carry the nonce */
export const MARKDOWN_CSP =
  "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

/** CSP for a rendered page: the nonce unlocks only our inline theme script */
export function markdownCsp(nonce?: string): string {
  return nonce ? `${MARKDOWN_CSP}; script-src 'nonce-${nonce}'` : MARKDOWN_CSP
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function cssColor(value: string | undefined, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value) ? value : fallback
}

/**
 * Allow http(s), mailto and relative URLs. Anything with another scheme
 * (javascript:, data:, vbscript:, …) returns an empty string.
 */
export function safeUrl(href: string): string {
  const trimmed = href.trim()
  if (trimmed === "") return ""
  // Browsers strip control characters before parsing a scheme, so do the same
  const schemeTest = trimmed.replace(/[\u0000-\u0020]/g, "")
  // Protocol-relative URLs load from another host; not needed in a repo preview
  if (schemeTest.startsWith("//")) return ""
  if (/^[a-z][a-z0-9+.-]*:/i.test(schemeTest)) {
    return /^(https?:|mailto:)/i.test(schemeTest) ? trimmed : ""
  }
  return trimmed
}

/**
 * Raw HTML blocks are common in READMEs (`<div align="center">…`). Showing the
 * tags is noise, dropping the block loses the content, so keep the text.
 */
function htmlToText(html: string): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre)>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
  return escapeHtml(text)
}

const marked = new Marked({ gfm: true })

marked.use({
  walkTokens(token) {
    // Raw HTML never reaches the output; its text survives
    if (token.type === "html") {
      token.text = htmlToText(token.text)
    }
    // Escape after filter: a quote in the destination must not break the attribute
    if (token.type === "link") {
      token.href = escapeHtml(safeUrl(token.href))
    }
    if (token.type === "image") {
      token.href = escapeHtml(safeUrl(token.href))
    }
  },
})

/** Markdown -> sanitized HTML body */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string
}

/** Full page for one markdown file */
export function renderMarkdownPage(options: {
  id: string
  path: string
  content: string
  /** All themes, so the page can follow the reader's stored choice */
  palettes?: Record<string, MarkdownPalette>
  /** Theme used when nothing is stored, e.g. the CLI's --theme */
  defaultTheme?: string
  /** Show the "back to diff" link; false for markdown-only uploads */
  backLink?: boolean
  /** Nonce for the inline theme script (required when `palettes` is set) */
  nonce?: string
}): string {
  const paletteEntries = Object.entries(options.palettes ?? {})
  const hasTheme = (name?: string): name is string =>
    Boolean(name && options.palettes && Object.prototype.hasOwnProperty.call(options.palettes, name))
  const defaultTheme = hasTheme(options.defaultTheme) ? options.defaultTheme : paletteEntries[0]?.[0]
  const defaultPalette = defaultTheme ? options.palettes?.[defaultTheme] : undefined

  const background = cssColor(defaultPalette?.background, DEFAULT_MARKDOWN_PALETTE.background)
  const text = cssColor(defaultPalette?.text, DEFAULT_MARKDOWN_PALETTE.text)
  const muted = cssColor(defaultPalette?.muted, DEFAULT_MARKDOWN_PALETTE.muted)
  const link = cssColor(defaultPalette?.link, DEFAULT_MARKDOWN_PALETTE.link)
  const path = escapeHtml(options.path)

  // A page opened from a diff link carries exact colors and needs no script.
  // A standalone page follows the reader's stored theme, like the diff page does.
  const themeNames = paletteEntries.map(([name]) => name)
  const themeBlocks = paletteEntries.length > 1
    ? paletteEntries
      .map(([name, colors]) => `  html[data-md-theme="${escapeHtml(name)}"]{--bg:${cssColor(colors.background, background)};--fg:${cssColor(colors.text, text)};--muted:${cssColor(colors.muted, muted)};--link:${cssColor(colors.link, link)}}`)
      .join("\n")
    : ""
  const themeScript = paletteEntries.length > 1
    ? `<script${options.nonce ? ` nonce="${escapeHtml(options.nonce)}"` : ""}>
(function () {
  var names = ${JSON.stringify(themeNames).replace(/</g, "\\u003c")};
  var saved = null;
  try { saved = localStorage.getItem("critique-theme") } catch (e) {}
  if (!saved || names.indexOf(saved) === -1) {
    var prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    saved = prefersLight && names.indexOf("github-light") >= 0 ? "github-light" : null;
  }
  if (saved) document.documentElement.setAttribute("data-md-theme", saved);
})();
</script>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
${themeScript}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${path}</title>
<style>
  :root {
    --bg: ${background};
    --fg: ${text};
    --muted: ${muted};
    --link: ${link};
    --code: color-mix(in srgb, var(--fg) 10%, var(--bg));
  }
  *, ::before, ::after { box-sizing: border-box; }
  html { scroll-padding-top: 56px; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-text-size-adjust: 100%;
    overflow-wrap: break-word;
  }
  .md-bar {
    position: sticky;
    top: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 16px;
    background: var(--bg);
    border-bottom: 1px solid color-mix(in srgb, var(--fg) 18%, var(--bg));
    color: var(--muted);
    font-size: 13px;
  }
  .md-bar a { color: var(--fg); text-decoration: none; }
  .md-bar a:hover { text-decoration: underline; }
  .md-bar .path { overflow-wrap: anywhere; }
  .md-page { max-width: 68ch; margin: 0 auto; padding: 24px 16px 64px; }
  .md-page a { overflow-wrap: anywhere; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.6em 0 0.6em; }
  h1:first-child, h2:first-child { margin-top: 0; }
  a { color: var(--link); }
  code {
    background: var(--code);
    padding: 0.15em 0.35em;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9em;
  }
  pre { background: var(--code); padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote {
    margin: 1em 0;
    padding: 0.2em 1em;
    border-left: 3px solid var(--muted);
    color: var(--muted);
  }
  table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
  th, td { border: 1px solid color-mix(in srgb, var(--fg) 22%, var(--bg)); padding: 6px 10px; }
  img { max-width: 100%; height: auto; }
  hr { border: 0; border-top: 1px solid color-mix(in srgb, var(--fg) 20%, var(--bg)); }
${themeBlocks}
</style>
</head>
<body>
${options.backLink === false ? "" : `<div class="md-bar"><a href="/v/${options.id}">&larr; Diff</a><span aria-hidden="true">&middot;</span><span class="path">${path}</span></div>`}
<main class="md-page">
${renderMarkdown(options.content)}
</main>
</body>
</html>`
}
