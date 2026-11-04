import { describe, expect, test } from "bun:test"
import { MARKDOWN_CSP, markdownCsp, renderMarkdown, renderMarkdownPage, safeUrl } from "./markdown-page.js"

describe("safeUrl", () => {
  test("keeps http, https, mailto, relative and hash URLs", () => {
    expect(safeUrl("https://example.com/a?b=c")).toBe("https://example.com/a?b=c")
    expect(safeUrl("mailto:a@b.c")).toBe("mailto:a@b.c")
    expect(safeUrl("/docs/x.md")).toBe("/docs/x.md")
    expect(safeUrl("#anchor")).toBe("#anchor")
  })

  test("drops javascript and data URLs, including obfuscated schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("")
    expect(safeUrl("java\tscript:alert(1)")).toBe("")
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBe("")
    expect(safeUrl("vbscript:msgbox(1)")).toBe("")
  })
})

describe("renderMarkdown", () => {
  test("turns raw HTML into readable text instead of showing markup", () => {
    const output = renderMarkdown("<div align=\"center\"><h3>critique</h3><p>Beautiful diff viewer</p></div>")
    expect(output).not.toContain("<div")
    expect(output).not.toContain("<h3")
    expect(output).not.toContain("&lt;div")
    expect(output).not.toContain("&lt;h3")
    expect(output).toContain("critique")
    expect(output).toContain("Beautiful diff viewer")
  })

  test("nested HTML fragments are stripped completely", () => {
    // One HTML block token containing a split tag: <scr<script> resolves to a
    // bare text node, so repeat the tag strip until the string stops changing
    const output = renderMarkdown("<div><scr<script>ipt>x</div>")
    expect(output).not.toContain("<")
    expect(output).not.toContain("script")
    expect(output).toContain("ipt&gt;x")
  })

  test("raw HTML cannot execute", () => {
    const output = renderMarkdown("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>")
    expect(output).not.toContain("<script")
    expect(output).not.toContain("<img")
    expect(output).not.toContain("onerror=\"alert")
  })

  test("drops javascript link targets but keeps the text", () => {
    const output = renderMarkdown("[click](javascript:alert(1))")
    expect(output).toContain("click")
    expect(output).not.toContain("javascript:")
  })

  test("keeps normal markdown structure", () => {
    const output = renderMarkdown("# Title\n\n- one\n- two\n\n```ts\nconst x = 1\n```")
    expect(output).toContain("<h1")
    expect(output).toContain("<li>one</li>")
    expect(output).toContain("<code")
  })

  test("a quote in a link destination cannot add an attribute", () => {
    const output = renderMarkdown('[x](https://a"onmouseover="alert(1))')
    expect(output).not.toContain('onmouseover="alert')
  })

  test("keeps https links clickable", () => {
    const output = renderMarkdown("[docs](https://example.com/docs)")
    expect(output).toContain('href="https://example.com/docs"')
  })
})

describe("renderMarkdownPage", () => {
  test("includes the path, a back link and the palette", () => {
    const page = renderMarkdownPage({
      id: "abc123",
      path: "docs/a & b.md",
      content: "# Hi",
      palettes: {
        github: {
          background: "#000000",
          text: "#ffffff",
          muted: "#888888",
          link: "#00aaff",
        },
      },
      defaultTheme: "github",
    })
    expect(page).toContain("docs/a &amp; b.md")
    expect(page).toContain('href="/v/abc123"')
    expect(page).toContain("--bg: #000000")
    expect(page).toContain("<h1")
  })

  test("falls back when the palette is not hex", () => {
    const page = renderMarkdownPage({
      id: "abc",
      path: "x.md",
      content: "hi",
      palettes: {
        broken: {
          background: "red",
          text: "inherit",
          muted: "#888",
          link: "#00f",
        },
      },
      defaultTheme: "broken",
    })
    expect(page).toContain("--bg: #0d1117")
    expect(page).toContain("--fg: #e6edf3")
  })

  test("the CSP blocks scripts except the nonce-carrying theme script", () => {
    expect(MARKDOWN_CSP).toContain("default-src 'none'")
    expect(MARKDOWN_CSP).not.toContain("script-src")
    expect(markdownCsp("abc123")).toContain("script-src 'nonce-abc123'")
  })
})


describe("standalone theme following", () => {
  const github = { background: "#000000", text: "#e6edf3", muted: "#8b949e", link: "#a5d6ff" }
  const nord = { background: "#2e3440", text: "#eceff4", muted: "#8b95a7", link: "#81a1c1" }

  test("emits the palettes and reads the stored browser theme", () => {
    const page = renderMarkdownPage({
      id: "abc",
      path: "x.md",
      content: "hi",
      palettes: { github, nord },
      defaultTheme: "github",
      nonce: "test-nonce",
    })
    expect(page).toContain('html[data-md-theme="nord"]{--bg:#2e3440')
    expect(page).toContain('<script nonce="test-nonce">')
    expect(page).toContain('localStorage.getItem("critique-theme")')
  })

  test("a single palette renders without the theme script", () => {
    const page = renderMarkdownPage({
      id: "abc",
      path: "x.md",
      content: "hi",
      palettes: { nord },
      defaultTheme: "nord",
    })
    expect(page).toContain("--bg: #2e3440")
    expect(page).not.toContain("critique-theme")
    expect(page).not.toContain("data-md-theme")
  })
})
