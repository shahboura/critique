"use client";

import { DocHeader } from "../components/Documentation";

import { Footer } from "../Footer";
import { ReactNode } from "react";

type ChangeType = "added" | "fixed" | "improved" | "removed";

interface Change {
  type: ChangeType;
  text: ReactNode;
}

interface Release {
  version: string;
  date: string;
  published?: boolean;
  summary?: ReactNode;
  changes?: Change[];
}

const badgeLabels: Record<ChangeType, string> = {
  added: "Added",
  fixed: "Fixed",
  improved: "Improved",
  removed: "Removed",
};

const releases: Release[] = [
  {
    version: "3.1.2",
    date: "September 21, 2026",
    changes: [
      { type: "improved", text: "Copy and Send auto-clear now covers notes that received a server ID during the action, including notes uploaded while joining a session." },
      { type: "improved", text: "Closing an MCP session cancels its in-flight tool calls and releases the session immediately." },
      { type: "improved", text: <><code>--host</code> also points the bundled stdio tools at the bound address, so a specific interface works without <code>--http-url</code>.</> },
    ],
  },
  {
    version: "3.1.1",
    date: "September 21, 2026",
    changes: [
      { type: "added", text: <>A <code>--host</code> option and <code>AGENTATION_HOST</code> variable for the MCP server, for serving browsers on other machines.</> },
      { type: "added", text: <><code>agentation-mcp doctor</code> checks that SQLite persistence is available for the running Node.js version.</> },
      { type: "improved", text: <>Style isolation now covers inherited typography, so a host page's font, letter-spacing or text-transform never reaches the toolbar. A consumer <code>className</code> can hide the toolbar again.</> },
      { type: "improved", text: <>The exported <code>AnnotationPopupCSS</code> and animated icon components bring their styles with them when used outside the toolbar.</> },
      { type: "improved", text: "Notes inside iframes follow in-frame hash and query changes." },
      { type: "improved", text: "Copy and Send auto-clear recognises notes that received a server ID during the action." },
      { type: "improved", text: <>The MCP server answers the local browser and dev-server origins by default. <code>--host</code> and <code>AGENTATION_CORS_ORIGINS</code> open it up deliberately.</> },
    ],
  },
  {
    version: "3.1.0",
    date: "September 20, 2026",
    changes: [
      { type: "added", text: <>An optional app name and configurable <a href="/api#copy-formats" className="styled-link">Copy formats</a> for source paths, CSS classes or identifying attributes. Attribute-only selections can be saved without a comment.</> },
      { type: "added", text: <>An <a href="/api#open-in-editor" className="styled-link">Open in editor callback</a> for connecting available source locations to your editor.</> },
      { type: "added", text: <>A <a href="/api#host-overlays" className="styled-link">portalContainer prop</a> for integrating with host modals and popovers.</> },
      { type: "added", text: <>Selection inside <a href="/api#embedded-pages" className="styled-link">same-origin iframes</a>, including nested frames, scaling, scrolling and navigation, and when Agentation itself is mounted inside an iframe.</> },
      { type: "added", text: <>Opt-in <a href="/api#routing-and-shortcuts" className="styled-link">hash routing</a> keeps feedback, layout state and MCP sessions separate by route. Global keyboard shortcuts can be disabled without disabling toolbar buttons or popup Enter/Escape.</> },
      { type: "improved", text: <>Element names prefer short visible text and paths include identifying attributes like <code>data-testid</code>. Integrations that parse these strings should expect the new shapes.</> },
      { type: "improved", text: "Toolbar styles now render inside Shadow DOM. Importing Agentation no longer changes page styles or timers." },
      { type: "improved", text: "Deep selection through overlays and open shadow roots works with Cmd/Ctrl-click and drag multiselect. Legacy Cmd+Shift-click remains supported." },
      { type: "improved", text: "Accessible control names, native keyboard activation and focus return. Single-key shortcuts leave the page alone while Agentation is closed." },
      { type: "fixed", text: "Copy, Send and Clear all stay reliable during overlapping actions, and each keeps its own success or failure state." },
      { type: "fixed", text: "Annotation popups stay above the toolbar. Hover labels and toolbar positioning respect viewport edges, including after dragging." },
      { type: "fixed", text: "Picking no longer activates underlying host controls when Block page interactions is enabled." },
      { type: "fixed", text: "Callback-only Send is available, waits for asynchronous delivery and keeps feedback when delivery fails." },
      { type: "fixed", text: "A React import interop crash affecting some React 19 setups." },
      { type: "fixed", text: "Edits, deletions, layout notes and source locations survive MCP synchronization and reconnects." },
      { type: "fixed", text: "Group selection moves placed components and existing sections together, with keyboard support in the Layout palette." },
      { type: "improved", text: <>The companion <a href="/mcp" className="styled-link">MCP server</a> handles concurrent events, reconnects and cancelled watch requests more reliably. Event history is bounded, browser-origin rules are consistent, and temporary webhook failures are retried.</> },
      { type: "fixed", text: "The MCP server requires Node.js 20 or newer. Node.js 24 LTS is recommended." },
    ],
  },
  {
    version: "3.0.2",
    date: "March 24, 2026",
    changes: [
      { type: "fixed", text: "Layout mode animations no longer freeze when the toolbar pauses page animations" },
      { type: "fixed", text: "Annotation textarea, settings panel, and color swatches no longer overflow their containers" },
    ],
  },
  {
    version: "3.0.1",
    date: "March 24, 2026",
    changes: [
      { type: "fixed", text: "Fixed logo display on npm and settings panel" },
    ],
  },
  {
    version: "3.0.0",
    date: "March 24, 2026",
    summary: <>Show your agent where things go. <a href="/blog/layout-mode" className="styled-link">Layout mode</a> lets you place components, rearrange sections, and wireframe new pages. Your agent gets coordinates and dimensions instead of a paragraph of directions.</>,
    changes: [
      { type: "added", text: <>Layout mode — press <code>L</code> to drag components onto the page, rearrange existing sections, or wireframe from scratch</> },
      { type: "added", text: "Component palette with 65+ draggable types across five categories" },
      { type: "added", text: "Section detection and rearranging with snap guides, move badges, and CSS selector labels" },
      { type: "added", text: "Wireframe new page toggle with adjustable page opacity and a purpose field for context" },
      { type: "added", text: <><a href="/schema" className="styled-link">AFS 1.1</a> — annotations carry a <code>kind</code> field so agents can distinguish feedback from placement and rearrange instructions</> },
      { type: "improved", text: "Cursor styles scoped to toolbar root, no longer leak into host page" },
    ],
  },
  {
    version: "2.3.3",
    date: "March 14, 2026",
    changes: [
      { type: "improved", text: "Marker colors now use Display P3 on wide-gamut screens, with sRGB fallback" },
      { type: "fixed", text: <><code>className</code> prop can now override toolbar positioning without <code>!important</code></> },
    ],
  },
  {
    version: "2.3.2",
    date: "March 9, 2026",
    changes: [
      { type: "fixed", text: "Host page SVG icons broken by unscoped fill protection rule (e.g. Tailwind's fill-current)" },
      { type: "fixed", text: "Toolbar icon states rendering simultaneously when host CSS overrides inline opacity" },
      { type: "fixed", text: "Annotation textarea losing focus when annotating inputs inside modals and drawers (Radix, shadcn, vaul)" },
      { type: "fixed", text: "Next.js App Router internals (SegmentViewNode) shown instead of actual React component names" },
    ],
  },
  {
    version: "2.3.1",
    date: "March 9, 2026",
    changes: [
      { type: "fixed", text: "Host app keyboard shortcuts firing while typing in annotation text areas and settings inputs" },
    ],
  },
  {
    version: "2.3.0",
    date: "March 7, 2026",
    changes: [
      { type: "added", text: <>Source file detection — annotations now include the source file path and line number (e.g. <code>src/components/Button.tsx:42</code>), works with Next.js, Vite, Webpack, and Turbopack</> },
      { type: "added", text: <><code>className</code> prop for custom toolbar positioning</> },
      { type: "added", text: "\"Hide Until Restart\" setting to dismiss the toolbar per-tab" },
      { type: "improved", text: "Toolbar CSS fully isolated from host page styles" },
      { type: "improved", text: "Instant tooltips when moving between toolbar buttons" },
      { type: "improved", text: <><code>sideEffects: false</code> for better tree-shaking</> },
      { type: "fixed", text: "Dev mode detection for non-standard environments" },
      { type: "fixed", text: "Send button pointer events not registering" },
      { type: "fixed", text: "Toolbar portal events triggering host app click-outside handlers" },
      { type: "fixed", text: "Resolved and dismissed annotations reappearing after sync" },
    ],
  },
  {
    version: "2.2.1",
    date: "February 11, 2026",
    changes: [
      { type: "fixed", text: "An issue where the toolbar button would occasionally become unresponsive to clicks and drags" },
    ],
  },
  {
    version: "2.2.0",
    date: "February 6, 2026",
    changes: [
      { type: "improved", text: "Animation pause now freezes all page animations — CSS, JavaScript timers, requestAnimationFrame, Web Animations API, and videos — and resumes exactly where they left off" },
    ],
  },
  {
    version: "2.1.1",
    date: "February 5, 2026",
    changes: [
      { type: "fixed", text: "Unstyled \"Learn more\" link in MCP Connection settings when no endpoint is configured" },
    ],
  },
  {
    version: "2.1.0",
    date: "February 5, 2026",
    changes: [
      { type: "added", text: <><a href="/mcp#hands-free-mode" className="styled-link">Hands-free mode</a> — <code>watch_annotations</code> tool blocks until new annotations appear, then returns a batch for the agent to process in a loop</> },
      { type: "added", text: <>Keyboard shortcut <code>Cmd+Shift+F</code> / <code>Ctrl+Shift+F</code> to toggle feedback mode</> },
      { type: "added", text: "Resolved annotations now animate out of the browser UI in real time via Server-Sent Events" },
      { type: "fixed", text: "Production builds no longer health-check localhost:4747 on every page load" },
      { type: "fixed", text: "MCP tools no longer hang indefinitely if the SSE connection drops" },
      { type: "removed", text: <><code>wait_for_action</code> MCP tool — unused and superseded by <code>watch_annotations</code></> },
    ],
  },
  {
    version: "2.0.0",
    date: "February 5, 2026",
    summary: "The shift from \"annotate, copy, paste\" to \"annotate and collaborate.\" Agents now see your annotations directly. This update adds MCP server integration, webhooks, React component detection, Shadow DOM support, and much more.",
    changes: [
      { type: "added", text: <><a href="/mcp" className="styled-link">MCP server</a> for direct agent integration — agents can fetch, acknowledge, resolve, and dismiss annotations</> },
      { type: "added", text: "HTTP API and Server-Sent Events for real-time updates" },
      { type: "added", text: <>Per-page <a href="/mcp#sessions" className="styled-link">sessions</a> with rich annotation metadata (timestamps, status, resolver info)</> },
      { type: "added", text: "Status transitions: pending → acknowledged → resolved/dismissed, all timestamped" },
      { type: "added", text: <><a href="/schema" className="styled-link">Annotation Format Schema</a> with intent and severity fields for prioritization</> },
      { type: "added", text: "JSON Schema and TypeScript definitions for the annotation format" },
      { type: "added", text: <><a href="/webhooks" className="styled-link">Webhooks</a> to subscribe to annotation events with structured JSON payloads</> },
      { type: "added", text: <><a href="/features#react-detection" className="styled-link">React component detection</a> — shows full component hierarchy on hover, not just DOM elements</> },
      { type: "added", text: <>Shadow DOM support — annotate elements inside modals, web components, and design systems that use shadow DOM</> },
      { type: "added", text: "Toolbar position persists in localStorage — drag it once, it stays where you put it" },
      { type: "added", text: <>Cmd+Shift+Click multi-element selection — hold <code>⌘</code>+<code>⇧</code> and click elements to select multiple individually, release to annotate the group</> },
      { type: "improved", text: "Component detection adapts to output detail level (Compact, Standard, Detailed, Forensic)" },
      { type: "improved", text: "Cursor styles in settings panel — I-beam for text inputs, pointer for clickable items" },
      { type: "improved", text: "Individual element highlights on hover — cmd+shift multi-select annotations show each element separately, not one combined box" },
      { type: "fixed", text: "Fixed/sticky element positioning — annotations on fixed navs and sticky headers now position correctly regardless of scroll" },
      { type: "improved", text: "\"Block page interactions\" now enabled by default — prevents accidental clicks while annotating (can be toggled off in settings)" },
      { type: "fixed", text: "SVG icons broken by host page fill styles — now uses attribute selectors to avoid conflicts" },
      { type: "fixed", text: "Query params and hash fragments now preserved in copied feedback URL" },
    ],
  },
  {
    version: "1.3.2",
    date: "January 24, 2026",
    changes: [
      { type: "fixed", text: "Blurry tooltip text on marker hover (counter-scaled to offset parent transform)" },
      { type: "improved", text: "Unified quote text styling between marker tooltip and annotation popup" },
      { type: "improved", text: "Tooltip font and padding consistency" },
    ],
  },
  {
    version: "1.3.1",
    date: "January 23, 2026",
    changes: [
      { type: "added", text: "Custom tooltips with arrows on toolbar buttons" },
      { type: "added", text: "Subtle stroke around marker dots for better visibility" },
      { type: "improved", text: "Help icon design and tooltip styling" },
    ],
  },
  {
    version: "1.3.0",
    date: "January 23, 2026",
    changes: [
      { type: "added", text: "Collapsible computed styles section in annotation popup — click the chevron to view CSS properties for the selected element" },
      { type: "improved", text: "Toolbar polish and visual refinements" },
    ],
  },
  {
    version: "1.2.0",
    date: "January 22, 2026",
    changes: [
      { type: "added", text: <><a href="/api" className="styled-link">Programmatic API</a>: <code>onAnnotationAdd</code>, <code>onAnnotationDelete</code>, <code>onAnnotationUpdate</code>, <code>onAnnotationsClear</code>, <code>onCopy</code> callbacks</> },
      { type: "added", text: <><code>copyToClipboard</code> prop to control clipboard behavior</> },
    ],
  },
  {
    version: "1.1.1",
    date: "January 22, 2026",
    changes: [
      { type: "added", text: "Claude Code skill for automatic setup (npx skills add benjitaylor/agentation)" },
      { type: "fixed", text: "React key prop warning in color picker" },
    ],
  },
  {
    version: "1.1.0",
    date: "January 21, 2026",
    changes: [
      { type: "improved", text: "Package exports now have proper TypeScript type conditions" },
      { type: "removed", text: "Deprecated AgentationCSS export alias (use Agentation instead)" },
    ],
  },
  {
    version: "1.0.0",
    date: "January 21, 2026",
    summary: "First stable release. Click elements to annotate them, select text, drag to multi-select. Multiple output detail levels, keyboard shortcuts, customizable marker colors, and localStorage persistence.",
  },
];

export default function ChangelogPage() {
  return (
    <>
      <article className="article">
        <DocHeader title="Changelog" description="Release history" />

        {releases.map((release) => (
          <section key={release.version} className="release-entry" id={`v${release.version}`}>
            <div className="release-heading">
              <h2>{release.published === false ? release.version : (
                <a href={`https://www.npmjs.com/package/agentation/v/${release.version}`} target="_blank" rel="noopener noreferrer">{release.version}</a>
              )}</h2>
              <span>{release.date}</span>
            </div>
            {release.summary && <p>{release.summary}</p>}
            {release.changes && (
              <div className="release-changes">
                {(["added", "improved", "fixed", "removed"] as ChangeType[]).map((type) => {
                  const items = release.changes!.filter((change) => change.type === type);
                  return items.length ? (
                    <div key={type}>
                      <h3 className="release-change-heading">{badgeLabels[type]}</h3>
                      <ul>{items.map((change, index) => <li key={index}>{change.text}</li>)}</ul>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </section>
        ))}
      </article>

      <Footer />
    </>
  );
}
