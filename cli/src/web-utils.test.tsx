import { describe, test, expect, afterEach } from "bun:test"
import childProcess from "child_process"
import fs from "fs"
import path from "path"
import { createTestRenderer } from "@opentuah/core/testing"
import { createRoot } from "@opentuah/react"
import { RGBA } from "@opentuah/core"
import type { CapturedFrame, CapturedLine, CapturedSpan } from "@opentuah/core"
import { slugifyFileName, buildAnchorMap, extractLineNumber, extractTreeFilePath, collectMarkdownFiles, captureDocument, findSectionByLabel, createSectionLookup, narrowHeaderLabel } from "./web-utils.js"
import { frameToHtml, buildHtmlDocument, StyleClassMap } from "./ansi-html.js"
import { BUILD_ID } from "./build-info.js"

describe("getSpanLines rendering", () => {
  let renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"] | null = null

  afterEach(() => {
    renderer?.destroy()
    renderer = null
  })

  test("captures box-drawing characters correctly", async () => {
    const setup = await createTestRenderer({ width: 50, height: 5 })
    renderer = setup.renderer
    const { renderOnce } = setup

    function App() {
      return (
        <box style={{ flexDirection: "column" }}>
          <text content="├── src/errors" />
          <text content="│   └── index.ts" />
          <text content="└── api" />
        </box>
      )
    }

    createRoot(renderer).render(<App />)

    for (let i = 0; i < 5; i++) {
      await renderOnce()
      await new Promise(r => setTimeout(r, 50))
    }

    const buffer = renderer.currentRenderBuffer
    const text = new TextDecoder().decode(buffer.getRealCharBytes(true))
    const lines = text.split("\n")

    // Box-drawing characters should be preserved
    expect(lines[0]).toContain("├── src/errors")
    expect(lines[1]).toContain("│   └── index.ts")
    expect(lines[2]).toContain("└── api")
  })

  test("captures simple text correctly", async () => {
    const setup = await createTestRenderer({ width: 50, height: 3 })
    renderer = setup.renderer
    const { renderOnce } = setup

    function App() {
      return <text content="src/errors/index.ts" />
    }

    createRoot(renderer).render(<App />)

    for (let i = 0; i < 5; i++) {
      await renderOnce()
      await new Promise(r => setTimeout(r, 50))
    }

    const buffer = renderer.currentRenderBuffer
    const text = new TextDecoder().decode(buffer.getRealCharBytes(true))
    
    expect(text).toContain("src/errors/index.ts")
  })

  test("renderDiffToFrame uses getSpanLines for correct character decoding", async () => {
    // Import the function we're testing
    const { renderDiffToFrame } = await import("./web-utils.js")
    
    const diffContent = `diff --git a/test.ts b/test.ts
new file mode 100644
--- /dev/null
+++ b/test.ts
@@ -0,0 +1,3 @@
+export function test() {
+  return true
+}
`

    const frame = await renderDiffToFrame(diffContent, {
      cols: 80,
      maxRows: 30,
      themeName: "github",
    })

    // Check that we get proper content
    expect(frame.cols).toBe(80)
    // Content-fitting: rows should be <= max (30) and match actual content
    expect(frame.rows).toBeLessThanOrEqual(30)
    expect(frame.lines.length).toBe(frame.rows)
    
    // Find lines with actual content (not just spaces)
    const contentLines = frame.lines
      .map((line, i) => ({ i, text: line.spans.map(s => s.text).join("") }))
      .filter(({ text }) => text.trim().length > 0)
    
    // Should have content and the frame should be appropriately sized
    expect(contentLines.length).toBeGreaterThan(0)
    // With content-fitting, frame.rows should be close to actual content lines
    // (may have some empty lines for layout/spacing)
    expect(frame.rows).toBeGreaterThanOrEqual(contentLines.length)
  })

  test("renders call-stack changes in the static file tree", async () => {
    const { renderDiffToFrame } = await import("./web-utils.js")
    const diffContent = `diff --git test.ts test.ts
--- test.ts
+++ test.ts
@@ -1 +1 @@
-export function start() { oldService() }
+export function start() { newService() }
`

    const frame = await renderDiffToFrame(diffContent, {
      cols: 80,
      maxRows: 30,
      themeName: "github",
      callDiffByFile: {
        "test.ts": [
          {
            entry: "start",
            ascii: [
              "  start()",
              "- ├─ oldService()",
              "+ └─ newService()",
            ].join("\n"),
          },
        ],
      },
    })
    const content = frame.lines
      .map((line) => line.spans.map((span) => span.text).join("").trimEnd())
      .filter(Boolean)
      .join("\n")

    expect(content).toMatchInlineSnapshot(`
      "                              └── test.ts (+1,-1)
                                          start()
                                        - ├─ oldService()
                                        + └─ newService()
       test.ts +1-1
       1 - export function start() { oldService() }
       1 + export function start() { newService() }"
    `)
  })
})

// Helper to create a mock CapturedSpan (transparent fg/bg → no inline styles)
function mockSpan(text: string): CapturedSpan {
  return {
    text,
    fg: RGBA.fromValues(0, 0, 0, 0),
    bg: RGBA.fromValues(0, 0, 0, 0),
    attributes: 0,
    width: text.length,
  }
}

// Helper to create a mock CapturedLine from text
function mockLine(text: string): CapturedLine {
  return { spans: [mockSpan(text)] }
}

// Frame -> document, the way the CLI does it (frameToHtml + buildHtmlDocument)
function htmlDocument(
  frame: CapturedFrame,
  options: Omit<Parameters<typeof buildHtmlDocument>[0], "content" | "spanCss" | "cols"> = {},
) {
  const { html, spanCss } = frameToHtml(frame, options)
  return buildHtmlDocument({ ...options, content: html, spanCss, cols: frame.cols })
}

// Helper to build a minimal CapturedFrame from text lines
function mockFrame(lines: string[], cols = 80): CapturedFrame {
  return {
    cols,
    rows: lines.length,
    cursor: [0, 0],
    lines: lines.map(mockLine),
  }
}

describe("slugifyFileName", () => {
  test("converts path separators to hyphens", () => {
    expect(slugifyFileName("src/components/foo-bar.tsx")).toBe("src-components-foo-bar-tsx")
  })

  test("lowercases and strips leading/trailing hyphens", () => {
    expect(slugifyFileName("  README.md  ")).toBe("readme-md")
  })

  test("collapses consecutive special characters", () => {
    expect(slugifyFileName("src///foo...bar")).toBe("src-foo-bar")
  })

  test("handles single-segment filenames", () => {
    expect(slugifyFileName("Makefile")).toBe("makefile")
  })
})

describe("buildAnchorMap", () => {
  test("maps section line positions to anchor IDs", () => {
    const anchors = buildAnchorMap([
      { lineIndex: 3, fileName: "src/foo.ts" },
      { lineIndex: 12, fileName: "src/bar.ts" },
    ])

    expect(anchors.size).toBe(2)
    expect(anchors.get(3)).toEqual({ id: "src-foo-ts", label: "src/foo.ts" })
    expect(anchors.get(12)).toEqual({ id: "src-bar-ts", label: "src/bar.ts" })
  })

  test("deduplicates IDs for same-named files", () => {
    const anchors = buildAnchorMap([
      { lineIndex: 4, fileName: "index.ts" },
      { lineIndex: 20, fileName: "index.ts" },
    ])

    expect(anchors.size).toBe(2)
    expect(anchors.get(4)!.id).toBe("index-ts")
    expect(anchors.get(20)!.id).toBe("index-ts-2")
  })

  test("returns empty map for empty input", () => {
    const anchors = buildAnchorMap([])
    expect(anchors.size).toBe(0)
  })

  test("uses fallback id when slugify removes all chars", () => {
    const anchors = buildAnchorMap([
      { lineIndex: 1, fileName: "---" },
      { lineIndex: 2, fileName: "***" },
    ])

    expect(anchors.size).toBe(2)
    expect(anchors.get(1)!.id).toBe("file")
    expect(anchors.get(2)!.id).toBe("file-2")
  })

  test("ignores invalid or duplicate line indexes", () => {
    const anchors = buildAnchorMap([
      { lineIndex: -1, fileName: "bad.ts" },
      { lineIndex: Number.NaN, fileName: "nan.ts" },
      { lineIndex: 7, fileName: "first.ts" },
      { lineIndex: 7, fileName: "second.ts" },
    ])

    expect(anchors.size).toBe(1)
    expect(anchors.get(7)).toEqual({ id: "first-ts", label: "first.ts" })
  })
})

describe("ansi-html renderLine callback", () => {
  test("renderLine wraps matching lines with custom HTML", () => {
    const frame = mockFrame(["file header", "code line", "another line"])

    const { html } = frameToHtml(frame, {
      renderLine: (defaultHtml, _line, lineIndex) => {
        if (lineIndex === 0) {
          return defaultHtml.replace(
            '<div class="line">',
            '<div id="my-section" class="line file-section">',
          )
        }
        return defaultHtml
      },
    })

    expect(html).toContain('id="my-section"')
    expect(html).toContain('class="line file-section"')
    // Other lines unchanged
    expect(html).toContain('<div class="line"><span>code line</span></div>')
  })

  test("without renderLine, output is default divs", () => {
    const frame = mockFrame(["hello"])
    const { html } = frameToHtml(frame)
    expect(html).toBe('<div class="line"><span>hello</span></div>')
  })
})

describe("extractLineNumber", () => {
  // Helper to create a line with multiple spans (like opentui renders diff lines)
  function spanLine(...texts: string[]): CapturedLine {
    return { spans: texts.map(t => mockSpan(t)) }
  }

  test("unified view: single line number", () => {
    // " " "26" "   " "content..."
    const line = spanLine(" ", "26", "   ", "const x = 1")
    expect(extractLineNumber(line)).toBe("26")
  })

  test("split view: returns right-side (new-file) line number", () => {
    // " " "29" " - " "old code" "   " "30" " + " "new code"
    const line = spanLine(" ", "29", " - ", "old code", "   ", "30", " + ", "new code")
    expect(extractLineNumber(line)).toBe("30")
  })

  test("split view: same line numbers on both sides (context line)", () => {
    // " " "26" "   " "unchanged" "   " "26" "   " "unchanged"
    const line = spanLine(" ", "26", "   ", "unchanged", "   ", "26", "   ", "unchanged")
    expect(extractLineNumber(line)).toBe("26")
  })

  test("file header line: returns null", () => {
    // "cli/package.json" " +1-1"
    const line = spanLine("cli/package.json", " +1-1")
    expect(extractLineNumber(line)).toBe(null)
  })

  test("hunk marker: returns null", () => {
    // "@@ -26,7 +26,7 @@"
    const line = spanLine("@@ -26,7 +26,7 @@")
    expect(extractLineNumber(line)).toBe(null)
  })

  test("empty line: returns null", () => {
    const line = spanLine("   ", "   ", "   ")
    expect(extractLineNumber(line)).toBe(null)
  })

  test("no spans: returns null", () => {
    const line: CapturedLine = { spans: [] }
    expect(extractLineNumber(line)).toBe(null)
  })

  test("deleted-only row: falls back to left (old) number", () => {
    // Only left number present, right side is empty
    // " " "42" " - " "deleted line" "                    "
    const line = spanLine(" ", "42", " - ", "deleted line", "                    ")
    expect(extractLineNumber(line)).toBe("42")
  })
})

describe("extractTreeFilePath", () => {
  test("matches tree file rows with change stats", () => {
    expect(extractTreeFilePath("│   ├── index.ts (+5,-2)")).toBe("index.ts")
    expect(extractTreeFilePath("└── README.md (-15)")).toBe("README.md")
    expect(extractTreeFilePath("│   └── utils.ts (+30)")).toBe("utils.ts")
  })

  test("does not match directory rows", () => {
    expect(extractTreeFilePath("└── src")).toBe(null)
    expect(extractTreeFilePath("│   ├── components")).toBe(null)
  })
})

  test("matches a row whose counts were clipped away", () => {
    // A 48-col capture clips long rows; a short name can lose its "(+N,-M)"
    expect(extractTreeFilePath(" README.md")).toBe("README.md")
    expect(extractTreeFilePath("     └── worker.tsx")).toBe("worker.tsx")
    // Directories have no extension, so they are not treated as file labels
    expect(extractTreeFilePath(" cli")).toBeNull()
  })

describe("data-anchor in rendered HTML", () => {
  test("injects data-anchor with file and line number", () => {
    // Simulate a frame with a file header line and diff lines
    const frame: CapturedFrame = {
      cols: 80,
      rows: 3,
      cursor: [0, 0],
      lines: [
        // File header line (first non-empty span is not numeric)
        { spans: [mockSpan("src/foo.ts +1-0")] },
        // Diff line: " " "10" "   " "const x = 1"
        { spans: [mockSpan(" "), mockSpan("10"), mockSpan("   "), mockSpan("const x = 1")] },
        // Another diff line
        { spans: [mockSpan(" "), mockSpan("11"), mockSpan("   "), mockSpan("return true")] },
      ],
    }

    // Use renderLine to inject data-anchor, mimicking captureToHtml logic
    const sectionPositions = [{ lineIndex: 0, fileName: "src/foo.ts" }]
    let currentFile: string | null = null
    let sectionPtr = 0
    const sorted = [...sectionPositions].sort((a, b) => a.lineIndex - b.lineIndex)

    const { html } = frameToHtml(frame, {
      renderLine: (defaultHtml, line, lineIndex) => {
        while (sectionPtr < sorted.length && lineIndex >= sorted[sectionPtr]!.lineIndex) {
          currentFile = sorted[sectionPtr]!.fileName
          sectionPtr++
        }
        if (currentFile && lineIndex > 0) {
          const lineNum = extractLineNumber(line)
          if (lineNum) {
            return defaultHtml.replace(
              '<div class="line">',
              `<div class="line" data-anchor="${currentFile}:${lineNum}">`,
            )
          }
        }
        return defaultHtml
      },
    })

    expect(html).toContain('data-anchor="src/foo.ts:10"')
    expect(html).toContain('data-anchor="src/foo.ts:11"')
    // File header line should not have data-anchor
    expect(html).not.toContain('data-anchor="src/foo.ts:src')
  })

  test("escapes special characters in anchor value", () => {
    const frame: CapturedFrame = {
      cols: 80,
      rows: 2,
      cursor: [0, 0],
      lines: [
        { spans: [mockSpan('file "name".ts +1-0')] },
        { spans: [mockSpan(" "), mockSpan("5"), mockSpan("   "), mockSpan("code")] },
      ],
    }

    let currentFile: string | null = 'src/"quoted".ts'
    const { html } = frameToHtml(frame, {
      renderLine: (defaultHtml, line, lineIndex) => {
        if (lineIndex > 0 && currentFile) {
          const lineNum = extractLineNumber(line)
          if (lineNum) {
            const anchorValue = `${currentFile}:${lineNum}`
            const safeAnchor = anchorValue
              .replace(/&/g, "&amp;")
              .replace(/"/g, "&quot;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
            return defaultHtml.replace(
              '<div class="line">',
              `<div class="line" data-anchor="${safeAnchor}">`,
            )
          }
        }
        return defaultHtml
      },
    })

    // Quotes should be escaped in the attribute
    expect(html).toContain('data-anchor="src/&quot;quoted&quot;.ts:5"')
  })
})

describe("tree links in rendered HTML", () => {
  test("adds href links to tree file rows without ids", () => {
    const frame: CapturedFrame = {
      cols: 80,
      rows: 3,
      cursor: [0, 0],
      lines: [
        { spans: [mockSpan("└── src")] },
        { spans: [mockSpan("    └── "), mockSpan("foo.ts"), mockSpan(" (+2,-1)")] },
        { spans: [mockSpan("src/foo.ts")] },
      ],
    }

    let treeLinkPtr = 0
    const treeAnchorOrder = ["src-foo-ts"]

    const { html } = frameToHtml(frame, {
      renderLine: (defaultHtml, line, lineIndex) => {
        let out = defaultHtml

        if (lineIndex < 2 && treeLinkPtr < treeAnchorOrder.length) {
          const treePath = extractTreeFilePath(line.spans.map((span) => span.text).join(""))
          if (treePath) {
            const targetAnchor = treeAnchorOrder[treeLinkPtr]
            treeLinkPtr++
            out = out.replace(
              `>${treePath}</span>`,
              `><a href="#${targetAnchor}" class="tree-file-link">${treePath}</a></span>`,
            )
          }
        }

        if (lineIndex === 2) {
          out = out.replace('<div class="line">', '<div id="src-foo-ts" class="line file-section">')
        }

        return out
      },
    })

    const htmlLines = html.split("\n")
    expect(htmlLines[1]).toContain('href="#src-foo-ts"')
    expect(htmlLines[1]).toContain('class="tree-file-link"')
    expect(htmlLines[1]).not.toContain('id="src-foo-ts"')
    expect(htmlLines[2]).toContain('id="src-foo-ts"')
  })
})

describe("ansi-html document", () => {
  test("extraCss is injected into document style block", () => {
    const frame = mockFrame(["test"])
    const doc = htmlDocument(frame, { extraCss: ".custom{color:red;}" })
    expect(doc).toContain(".custom{color:red;}")
    // Should appear before the last </style> (main CSS block, not font-face)
    const styleEnd = doc.lastIndexOf("</style>")
    const cssPos = doc.indexOf(".custom{color:red;}")
    expect(cssPos).toBeLessThan(styleEnd)
  })

  test("extraJs is injected as separate script block", () => {
    const frame = mockFrame(["test"])
    const doc = htmlDocument(frame, { extraJs: "console.log('hi')" })
    expect(doc).toContain("<script>\nconsole.log('hi')\n</script>")
  })

  test("scroll-to-top button is rendered with its styles and script", () => {
    const frame = mockFrame(["test"])
    const doc = htmlDocument(frame)
    expect(doc).toContain('id="to-top"')
    expect(doc).toContain('aria-label="Scroll to top"')
    expect(doc).toContain("#to-top.visible")
    expect(doc).toContain("#to-top:focus-visible")
    expect(doc).toContain("getElementById('to-top')")
    // Before #content so keyboard users reach it without tabbing through every
    // file link, and outside #content because that gets inverted in light mode
    expect(doc.indexOf('id="to-top"')).toBeLessThan(doc.indexOf('id="content"'))
  })

  test("pages identify the build that rendered them", () => {
    const frame = mockFrame(["test"])
    const doc = htmlDocument(frame)
    expect(doc).toContain(`<meta name="critique-build" content="${BUILD_ID}">`)
  })

  test("scroll-to-top surfaces derive from the page colors", () => {
    const frame = mockFrame(["test"])
    const doc = htmlDocument(frame, { backgroundColor: "#0d1117", textColor: "#e6edf3" })
    expect(doc).toContain("--bg: #0d1117")
    expect(doc).toContain("--fg: #e6edf3")
    expect(doc).toContain("--to-top-fg: var(--fg)")
    expect(doc).toContain("--to-top-page-bg: var(--bg)")
    expect(doc).toContain("color-mix(in srgb, var(--to-top-fg) 10%")
  })

  test("autoTheme overrides scroll-to-top colors for light mode", () => {
    const frame = mockFrame(["test"])
    const doc = htmlDocument(frame, {
      backgroundColor: "#0d1117",
      textColor: "#e6edf3",
      autoTheme: true,
    })
    // Base colors first, light override after, so the cascade flips them
    const base = doc.indexOf("--to-top-fg: var(--fg)")
    const light = doc.indexOf("--to-top-fg: #1a1a1a")
    expect(base).toBeGreaterThan(-1)
    expect(light).toBeGreaterThan(base)
  })

  test("non-hex colors fall back instead of producing an empty page", () => {
    const frame = mockFrame(["test"])
    const doc = htmlDocument(frame, { backgroundColor: "rgb(1,2,3)", textColor: "var(--x)" })
    expect(doc).toContain("--bg: #ffffff")
    expect(doc).toContain("--fg: #1a1a1a")
  })

  test("mobile redirect preserves hash fragment", () => {
    const frame = mockFrame(["test"])
    const doc = htmlDocument(frame)
    expect(doc).toContain("+ window.location.hash")
  })
})

// A frame with a real foreground color, so its spans get a style class.
function coloredFrame(text: string, rgb: [number, number, number]): CapturedFrame {
  return {
    cols: 80,
    rows: 1,
    cursor: [0, 0],
    lines: [{
      spans: [{
        text,
        fg: RGBA.fromValues(rgb[0], rgb[1], rgb[2], 255),
        bg: RGBA.fromValues(0, 0, 0, 0),
        attributes: 0,
        width: text.length,
      }],
    }],
  }
}

const nordTheme = {
  name: "nord",
  label: "Nord",
  background: "#2e3440",
  text: "#d8dee9",
  muted: "#8b95a7",
  link: "#88c0d0",
  added: "#a3be8c",
  removed: "#bf616a",
  spanCss: ".s0{color:#d8dee9}\n.s1{color:#88c0d0}",
  mode: "dark" as const,
}

const latteTheme = {
  name: "catppuccin-latte",
  label: "Catppuccin Latte",
  background: "#eff1f5",
  text: "#4c4f69",
  muted: "#6c6f85",
  link: "#1e66f5",
  added: "#40a02b",
  removed: "#d20f39",
  spanCss: ".s0{color:#4c4f69}\n.s1{color:#1e66f5}",
  mode: "light" as const,
}

describe("ansi-html themes", () => {
  test("emits one scoped block per theme and a grouped picker", () => {
    const doc = buildHtmlDocument({
      content: '<div class="line">x</div>',
      spanCss: ".s0{color:#d8dee9}",
      cols: 80,
      themes: [nordTheme, latteTheme],
      lightTheme: "catppuccin-latte",
    })
    expect(doc).toContain('html[data-theme="nord"]{--bg:#2e3440;--fg:#d8dee9')
    expect(doc).toContain('html[data-theme="nord"] .s1{color:#88c0d0}')
    expect(doc).toContain('html[data-theme="catppuccin-latte"] .s1{color:#1e66f5}')
    expect(doc).toContain('<optgroup label="Dark">')
    expect(doc).toContain('<optgroup label="Light">')
    expect(doc).toContain('id="theme-select"')
    // Chrome-less select with our own chevron, so the control matches the page
    expect(doc).toContain('class="theme-chevron"')
    expect(doc).toContain("appearance: none")
    // The native dropdown follows the page's dark/light scheme
    expect(doc).toContain("color-scheme: dark")
    // Themes replace the invert filter: real light themes instead of a hue rotation
    expect(doc).not.toContain("invert(1)")
  })

  test("the pre-paint script runs before any stylesheet", () => {
    const doc = buildHtmlDocument({
      content: "x",
      spanCss: "",
      cols: 80,
      themes: [nordTheme, latteTheme],
      lightTheme: "catppuccin-latte",
    })
    const script = doc.indexOf("critique-theme")
    expect(script).toBeGreaterThan(-1)
    expect(script).toBeLessThan(doc.indexOf("<style>"))
  })

  test("the picker shows the theme actually rendered", () => {
    const doc = buildHtmlDocument({
      content: "x",
      spanCss: "",
      cols: 80,
      themes: [nordTheme, latteTheme],
      baseTheme: "catppuccin-latte",
      lightTheme: "catppuccin-latte",
    })
    expect(doc).toContain('var base = "catppuccin-latte"')
    expect(doc).toContain("select.value = current || base")
  })

  test("a page without themes keeps the single fixed palette", () => {
    const doc = htmlDocument(mockFrame(["test"]))
    expect(doc).not.toContain("theme-select")
    expect(doc).not.toContain("data-theme=")
  })
})

describe("ansi-html responsive bodies", () => {
  test("two bodies swap on narrow screens and drop the redirect", () => {
    const doc = buildHtmlDocument({
      content: "desktop-body",
      mobileContent: "mobile-body",
      mobileCols: 50,
      spanCss: "",
      cols: 230,
    })
    expect(doc).toContain('id="content-m"')
    expect(doc).toContain("desktop-body")
    expect(doc).toContain("mobile-body")
    expect(doc).toContain("@media screen and (max-width: 899px)")
    // The narrow body is already in the page, so no user-agent redirect
    expect(doc).not.toContain("window.location.replace")
  })

  test("one body keeps the legacy mobile redirect", () => {
    const doc = buildHtmlDocument({ content: "x", spanCss: "", cols: 230 })
    expect(doc).toContain("window.location.replace")
    expect(doc).not.toContain('id="content-m"')
  })

  test("the summary header renders in a sticky bar", () => {
    const doc = buildHtmlDocument({
      content: "x",
      spanCss: "",
      cols: 80,
      headerHtml: '<span class="add">+3</span>',
    })
    expect(doc).toContain('<header id="bar">')
    expect(doc).toContain('<div class="summary">')
    expect(doc).toContain("position: sticky")
  })
})

describe("shared class map", () => {
  test("two captures share class names and one CSS block", () => {
    const classMap = new StyleClassMap()
    const desktop = frameToHtml(coloredFrame("same", [255, 0, 0]), { classMap })
    const narrow = frameToHtml(coloredFrame("same", [255, 0, 0]), { classMap })
    const other = frameToHtml(coloredFrame("different", [0, 255, 0]), { classMap })

    expect(desktop.html).toContain('class="s0"')
    expect(narrow.html).toContain('class="s0"')
    expect(other.html).toContain('class="s1"')
    // The shared map returns the union, so one style block styles both bodies
    expect(other.spanCss).toContain(".s0{color:#ff0000")
    expect(other.spanCss).toContain(".s1{color:#00ff00")
  })
})

describe("collectMarkdownFiles", () => {
  test("reads from the repo root even when the CLI runs in a subdirectory", () => {
    // Tests run with cwd = cli/; README.md only exists at the repo root
    const result = collectMarkdownFiles(["README.md"])
    expect(Object.keys(result.files)).toEqual(["README.md"])
    expect(result.files["README.md"]!.length).toBeGreaterThan(100)
    expect(result.fromHead).toEqual([])
    expect(result.skipped).toEqual([])
  })

  test("accepts a/ and b/ diff prefixes", () => {
    expect(Object.keys(collectMarkdownFiles(["b/README.md"]).files)).toEqual(["README.md"])
    expect(Object.keys(collectMarkdownFiles(["a/README.md"]).files)).toEqual(["README.md"])
  })

  test("ignores non-markdown paths", () => {
    const result = collectMarkdownFiles(["cli/package.json"])
    expect(result.files).toEqual({})
    expect(result.skipped).toEqual([])
  })

  test("reports files it cannot read", () => {
    const result = collectMarkdownFiles(["docs/does-not-exist.md"])
    expect(result.files).toEqual({})
    expect(result.skipped).toEqual(["docs/does-not-exist.md"])
  })

  test("refuses paths that escape the repository", () => {
    // A PR diff is attacker-controlled: a path like ../notes.md must never read
    // a local file and upload it
    const root = childProcess.execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim()
    const outside = path.join(root, "..", `critique-probe-${Date.now()}.md`)
    fs.writeFileSync(outside, "secret")
    try {
      const result = collectMarkdownFiles([`../${path.basename(outside)}`])
      expect(result.files).toEqual({})
      expect(result.skipped).toHaveLength(1)
    } finally {
      fs.rmSync(outside, { force: true })
    }
  })

  test("refuses symlinks that point outside the repository", () => {
    const root = childProcess.execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim()
    const outside = path.join(root, "..", `critique-probe-${Date.now()}.md`)
    const link = path.join(root, "cli", `symlink-probe-${Date.now()}.md`)
    fs.writeFileSync(outside, "secret")
    fs.symlinkSync(outside, link)
    try {
      const result = collectMarkdownFiles([path.relative(root, link)])
      expect(result.files).toEqual({})
      expect(result.skipped).toHaveLength(1)
    } finally {
      fs.rmSync(link, { force: true })
      fs.rmSync(outside, { force: true })
    }
  })

  test("empty input returns empty results", () => {
    expect(collectMarkdownFiles([])).toEqual({ files: {}, skipped: [], fromHead: [] })
  })
})

describe("captureDocument", () => {
  test("builds one page with the summary, themes, markdown links and narrow body", async () => {
    const diff = [
      "diff --git a/README.md b/README.md",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1 +1 @@",
      "-old line",
      "+new line",
    ].join("\n")

    const result = await captureDocument(diff, {
      cols: 80,
      maxRows: 400,
      mobile: { cols: 48, maxRows: 800 },
      themeName: "github",
      themeNames: ["github", "github-light"],
      showSummary: true,
      collectMarkdown: true,
      stabilizeMs: 800,
    })

    expect(result.document).toContain("<span>1 file</span>")
    expect(result.document).toContain('class="add">+1')
    expect(result.document).toContain('class="del">−1')
    expect(result.document).toContain('html[data-theme="github-light"]')
    expect(result.document).toContain('id="content-m"')
    // Narrow body makes the file header the preview trigger; desktop stays inline
    expect(result.document).toContain('id="m-b-readme-md"')
    expect(result.document).toContain("data-md-preview")
    // Narrow tree rows jump to their section; the file header carries the preview link
    const mobileBody = result.document.slice(result.document.indexOf('id="content-m"'))
    expect(mobileBody).toContain('href="#m-b-readme-md" class="tree-file-link"')
    expect(mobileBody).not.toContain("md-preview-line")
    expect(mobileBody.match(/data-md-preview/g)?.length ?? 0).toBe(1)
    expect(mobileBody).toContain("Preview README.md")
    // One changed markdown file is stored for the preview endpoint
    expect(Object.keys(result.markdown)).toEqual(["README.md"])
  }, 20000)
})


describe("createSectionLookup", () => {
  const entries = [
    { displayName: "index.ts", anchorId: "a-index-1", fullPath: "src/a/index.ts" },
    { displayName: "index.ts", anchorId: "a-index-2", fullPath: "src/b/index.ts" },
    { displayName: "README.md", anchorId: "a-readme", fullPath: "README.md" },
  ]

  test("hands duplicate basenames out in order", () => {
    const lookup = createSectionLookup(entries)
    expect(lookup("index.ts")?.fullPath).toBe("src/a/index.ts")
    expect(lookup("index.ts")?.fullPath).toBe("src/b/index.ts")
    // More rows than files fall back to the last one instead of undefined
    expect(lookup("index.ts")?.fullPath).toBe("src/b/index.ts")
    expect(lookup("README.md")?.fullPath).toBe("README.md")
  })

  test("still resolves a clipped label by unique prefix", () => {
    const lookup = createSectionLookup(entries)
    expect(lookup("REA\u2026")?.fullPath).toBe("README.md")
  })
})

describe("findSectionByLabel", () => {
  const entries = [
    { displayName: "README.md", anchorId: "m-readme-md", fullPath: "README.md" },
    { displayName: "web-themes-responsive-markdown-preview.md", anchorId: "m-changeset-md", fullPath: ".changeset/web-themes-responsive-markdown-preview.md" },
    { displayName: "web-themes-other.md", anchorId: "m-other", fullPath: "docs/web-themes-other.md" },
  ]

  test("matches the exact display name", () => {
    expect(findSectionByLabel("README.md", entries)?.fullPath).toBe("README.md")
  })

  test("matches a label truncated with an ellipsis", () => {
    expect(findSectionByLabel("web-themes-responsive-markdown-pre\u2026", entries)?.fullPath)
      .toBe(".changeset/web-themes-responsive-markdown-preview.md")
  })

  test("returns undefined when nothing matches or the prefix is ambiguous", () => {
    expect(findSectionByLabel("missing.md", entries)).toBeUndefined()
    expect(findSectionByLabel("web\u2026", entries)).toBeUndefined()
  })
})

describe("narrowHeaderLabel", () => {
  test("leaves room for the counts and the inline preview link", () => {
    const label = narrowHeaderLabel(".changeset/web-themes-responsive-markdown-preview.md", 48, 5, 0)
    expect(label.endsWith("\u2026")).toBe(true)
    expect(label.length + " +5-0".length + " preview".length).toBeLessThanOrEqual(48)
  })

  test("keeps short names untouched", () => {
    expect(narrowHeaderLabel("README.md", 48, 34, 4)).toBe("README.md")
  })
})
