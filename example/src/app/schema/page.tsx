"use client";

import { DocHeader, DocNote, ReferenceTable } from "../components/Documentation";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";
import annotationSchema from "../../../public/schema/annotation.v1.1.json";
import { SchemaDiagram } from "../components/SchemaDiagram";

export default function SchemaPage() {
  return (
    <>
      <article className="article">
        <DocHeader title="Annotation Format Schema" badge="v1.1" description="A portable format for structured UI feedback" />

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            The Annotation Format Schema (AFS) is an open format created and used by Agentation for capturing UI feedback
            in a way that AI coding agents can reliably parse and act on. Think
            of it like <strong>smart Figma comments for your running app</strong> &mdash; persistent
            annotations attached to specific elements, with threads, status tracking,
            resolution workflows, and structured metadata that agents can actually understand.
          </p>
          <p>
            This spec defines the annotation object shape. Tools can emit annotations
            in this format, and agents can consume them regardless of how they were created.
          </p>

          <SchemaDiagram />
        </section>

        <section>
          <h2 id="what-this-unlocks">What This Unlocks</h2>
          <p>
            A structured schema isn&apos;t just about clean data &mdash; it enables entirely new workflows:
          </p>
          <ul>
            <li><strong>Two-way communication</strong> &mdash; Agents can reply to annotations, asking &ldquo;Should this be 24px or 16px?&rdquo; and get responses in the same thread</li>
            <li><strong>Status tracking</strong> &mdash; See what&apos;s pending, acknowledged, resolved, or dismissed at a glance</li>
            <li><strong>Cross-page queries</strong> &mdash; &ldquo;What annotations do I have?&rdquo; works across your entire site</li>
            <li><strong>Bulk operations</strong> &mdash; &ldquo;Clear all annotations&rdquo; or &ldquo;Show me blocking issues only&rdquo;</li>
            <li><strong>Persistent history</strong> &mdash; Feedback survives page refreshes and browser sessions</li>
          </ul>
          <p>
            Without a schema, feedback is fire-and-forget. With one, it becomes a conversation.
          </p>
        </section>

        <section>
          <h2 id="design-goals">Design Goals</h2>
          <ul>
            <li><strong>Agent-readable</strong> &mdash; Structured data that LLMs can parse without guessing</li>
            <li><strong>Framework-agnostic</strong> &mdash; Works with any UI, though React gets extra context</li>
            <li><strong>Tool-agnostic</strong> &mdash; Any tool can emit, any agent can consume</li>
            <li><strong>Human-authored</strong> &mdash; Designed for feedback from humans (or automated reviewers)</li>
            <li><strong>Minimal core</strong> &mdash; Few required fields, many optional for richer context</li>
          </ul>
        </section>

        <section>
          <h2 id="annotation-object">Annotation Object</h2>
          <p>
            An annotation represents a single piece of feedback attached to a UI element.
          </p>
          <DocNote>
            <strong>Note:</strong> The server may add metadata fields (<code>sessionId</code>, <code>createdAt</code>, <code>updatedAt</code>)
            when syncing annotations.
          </DocNote>

          <h3>Required Fields</h3>
          <CodeBlock
            language="typescript"
            code={`{
  id: string;           // Unique identifier (e.g. "ann_abc123")
  comment: string;      // Human feedback ("Button is misaligned")
  elementPath: string;  // CSS selector path ("body > main > button.cta")
  timestamp: number;    // Unix timestamp (ms)
  x: number;            // % of viewport width (0-100)
  y: number;            // px from document top (or viewport if isFixed)
  element: string;      // Tag name ("button", "div", "input")
}`}
          />

          <h3>Recommended Fields</h3>
          <CodeBlock
            language="typescript"
            code={`{
  url: string;          // Page URL where annotation was created
  boundingBox: {        // Element position at annotation time
    x: number;
    y: number;
    width: number;
    height: number;
  };
}`}
          />

          <h3>Optional Context Fields</h3>
          <CodeBlock
            language="typescript"
            code={`{
  // React-specific (when available)
  reactComponents: string;  // Component tree ("App > Dashboard > Button")

  // Element details
  cssClasses: string;       // Class list ("btn btn-primary disabled")
  computedStyles: string;   // Key CSS properties
  accessibility: string;    // ARIA attributes, role
  nearbyText: string;       // Visible text in/around element
  selectedText: string;     // Text highlighted by user

  // Feedback classification
  intent: "fix" | "change" | "question" | "approve";
  severity: "blocking" | "important" | "suggestion";

  // Annotation kind (defaults to "feedback")
  kind: "feedback" | "placement" | "rearrange";

  // Layout mode: placement data
  placement: {
    componentType: string;  // e.g. "Hero", "Card", "Navigation"
    width: number;          // px
    height: number;         // px
    scrollY: number;        // scroll position when placed
    text?: string;          // optional label text
  };

  // Layout mode: rearrange data
  rearrange: {
    selector: string;       // CSS selector of the section
    label: string;          // human-readable label
    tagName: string;        // HTML tag name
    originalRect: { x: number; y: number; width: number; height: number };
    currentRect: { x: number; y: number; width: number; height: number };
  };
}`}
          />

          <h3>Lifecycle Fields</h3>
          <CodeBlock
            language="typescript"
            code={`{
  status: "pending" | "acknowledged" | "resolved" | "dismissed";
  resolvedAt: string;       // ISO timestamp
  resolvedBy: "human" | "agent";
  thread: ThreadMessage[];  // Back-and-forth conversation
}`}
          />

          <h3>Browser Component Fields</h3>
          <DocNote>
            These optional fields are set by the Agentation browser component for UI rendering:
          </DocNote>
          <CodeBlock
            language="typescript"
            code={`{
  isFixed: boolean;         // Element has fixed/sticky positioning
  isMultiSelect: boolean;   // Created via drag selection
  fullPath: string;         // Full DOM path (vs shorter elementPath)
  nearbyElements: string;   // Info about nearby DOM elements
}`}
          />
        </section>

        <section>
          <h2 id="typescript-definition">Full TypeScript Definition</h2>
          <CodeBlock
            language="typescript"
            copyable
            code={`type Annotation = {
  // Required
  id: string;
  comment: string;
  elementPath: string;
  timestamp: number;
  x: number;            // % of viewport width (0-100)
  y: number;            // px from document top (or viewport if isFixed)
  element: string;      // Tag name ("button", "div")

  // Recommended
  url?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Optional context
  reactComponents?: string;
  cssClasses?: string;
  sourceFile?: string;
  attributes?: Record<string, string>;
  computedStyles?: string;
  accessibility?: string;
  nearbyText?: string;
  selectedText?: string;

  // Browser component fields
  isFixed?: boolean;       // Element has fixed/sticky positioning
  isMultiSelect?: boolean; // Created via drag selection
  fullPath?: string;       // Full DOM path
  nearbyElements?: string; // Info about nearby elements

  // Feedback classification
  intent?: "fix" | "change" | "question" | "approve";
  severity?: "blocking" | "important" | "suggestion";

  // Annotation kind
  kind?: "feedback" | "placement" | "rearrange";

  // Layout mode data
  placement?: {
    componentType: string;
    width: number;
    height: number;
    scrollY: number;
    text?: string;
  };
  rearrange?: {
    selector: string;
    label: string;
    tagName: string;
    originalRect: { x: number; y: number; width: number; height: number };
    currentRect: { x: number; y: number; width: number; height: number };
  };

  // Lifecycle
  status?: "pending" | "acknowledged" | "resolved" | "dismissed";
  resolvedAt?: string;
  resolvedBy?: "human" | "agent";
  thread?: ThreadMessage[];
};

type ThreadMessage = {
  id: string;
  role: "human" | "agent";
  content: string;
  timestamp: number;
};`}
          />
        </section>

        <section>
          <h2 id="browser-metadata">Browser metadata</h2>
          <p>The browser component can add optional identifying attributes, a source-file reference and same-origin frame context. These fields travel with annotations through callbacks and MCP storage; they do not change the required AFS fields.</p>
          <CodeBlock language="typescript" code={`// Optional fields emitted by the React component
sourceFile?: string; // path:line:column when available
attributes?: Record<string, string>;
frame?: {
  path: Array<{ index: number; id?: string; url: string }>;
  x: number; // % of child viewport width
  y: number; // child document px, or child viewport px if fixed
  fixed: boolean;
  boundingBox: { x: number; y: number; width: number; height: number };
};`} />
          <p>Frame paths describe the nesting from the top document to the selected element’s document. Frame geometry is kept in child coordinates so a saved single-element marker can follow scrolling without changing its identity.</p>
        </section>

        <section>
          <h2 id="event-envelope">Event Envelope</h2>
          <p>
            For real-time streaming, annotations are wrapped in an event envelope:
          </p>
          <CodeBlock
            language="typescript"
            copyable
            code={`type AgentationEvent = {
  type: "annotation.created" | "annotation.updated" | "annotation.deleted"
      | "session.created" | "session.updated" | "session.closed"
      | "thread.message" | "action.requested";
  timestamp: string;     // ISO 8601
  sessionId: string;
  sequence: number;      // Monotonic for ordering/replay
  payload: Annotation | Session | ThreadMessage | ActionRequest;
};`}
          />
          <DocNote>
            The <code>sequence</code> number enables clients to detect missed events and request replay.
            See <a href="/mcp">MCP</a> for SSE streaming details.
          </DocNote>
        </section>

        <section>
          <h2 id="json-schema">JSON Schema</h2>
          <p>
            For validation in any language:
          </p>
          <CodeBlock
            language="json"
            copyable
            code={JSON.stringify(annotationSchema, null, 2)}
          />
        </section>

        <section>
          <h2 id="example">Example Annotation</h2>
          <CodeBlock
            language="json"
            code={`{
  "id": "ann_k8x2m",
  "comment": "Button is cut off on mobile viewport",
  "elementPath": "body > main > .hero-section > button.cta",
  "timestamp": 1705694400000,
  "x": 45.5,
  "y": 480,
  "element": "button",
  "url": "http://localhost:3000/landing",
  "boundingBox": { "x": 120, "y": 480, "width": 200, "height": 48 },
  "reactComponents": "App > LandingPage > HeroSection > CTAButton",
  "cssClasses": "cta btn-primary",
  "nearbyText": "Get Started Free",
  "intent": "fix",
  "severity": "blocking",
  "status": "pending"
}`}
          />
        </section>

        <section>
          <h2 id="layout-mode-example">Layout Mode Example</h2>
          <p>
            Layout mode annotations use the <code>kind</code> field to distinguish from regular feedback:
          </p>
          <CodeBlock
            language="json"
            code={`{
  "id": "ann_d3s1gn",
  "comment": "Place a Hero component here",
  "elementPath": "body",
  "timestamp": 1709510400000,
  "x": 50,
  "y": 200,
  "element": "body",
  "kind": "placement",
  "placement": {
    "componentType": "Hero",
    "width": 800,
    "height": 400,
    "scrollY": 0,
    "text": "Hero"
  },
  "status": "pending"
}`}
          />
        </section>

        <section>
          <h2 id="markdown-output">Markdown Output Format</h2>
          <p>
            For pasting into chat-based agents, annotations can be serialized as markdown:
          </p>
          <CodeBlock
            language="markdown"
            code={`## Annotation #1
**Element:** button.cta
**Path:** body > main > .hero-section > button.cta
**React:** App > LandingPage > HeroSection > CTAButton
**Position:** 120px, 480px (200×48px)
**Feedback:** Button is cut off on mobile viewport
**Severity:** blocking`}
          />
          <DocNote>
            See <a href="/output">Output Formats</a> for detail level options (Compact → Forensic).
          </DocNote>
        </section>

        <section>
          <h2 id="implementations">Implementations</h2>
          <p>
            Tools that emit or consume this format:
          </p>
          <ReferenceTable label="Implementations">
            <thead><tr><th scope="col">Project</th><th scope="col">Description</th></tr></thead>
            <tbody>
              <tr>
                <td>
                  Agentation (React)
                </td>
                <td>
                  Click-to-annotate toolbar for React apps
                </td>
              </tr>
              <tr>
                <td>
                  Agentation MCP Server
                </td>
                <td>
                  Exposes annotations to Claude Code and other MCP clients
                </td>
              </tr>
            </tbody>
          </ReferenceTable>
        </section>

        <section>
          <h2 id="building">Building an Implementation</h2>
          <p>
            To emit Agentation Format annotations from your tool:
          </p>
          <ol>
            <li>Capture the required fields: <code>id</code>, <code>comment</code>, <code>elementPath</code>, <code>timestamp</code>, <code>x</code>, <code>y</code>, <code>element</code></li>
            <li>Add recommended fields for better agent accuracy: <code>url</code>, <code>boundingBox</code></li>
            <li>For React apps, traverse the fiber tree to get <code>reactComponents</code></li>
            <li>Output as JSON for MCP/API consumption, or markdown for chat pasting</li>
          </ol>
          <p>
            See the <a href="https://github.com/benjitaylor/agentation">Agentation source</a> for
            reference implementations of element detection and React component traversal.
          </p>
        </section>

        <section>
          <h2 id="why">Why This Format?</h2>
          <p>
            Existing agent protocols (MCP, A2A, ACP) standardize tools and messaging, but
            they don&apos;t define a UI feedback grammar. They rely on whatever structured
            context you feed them.
          </p>
          <p>
            This format fills that gap: a portable wire format specifically for &quot;human points at UI,
            agent needs to find and fix the code.&quot; We hope it&apos;s useful to others building similar tools.
          </p>
        </section>

        <section>
          <h2 id="versioning">Versioning</h2>
          <p>
            Current version: <code>v1.1</code>
          </p>
          <DocNote>
            Schema URL: <a href="https://agentation.com/schema/annotation.v1.1.json">annotation.v1.1.json</a>
          </DocNote>
        </section>

      </article>

      <Footer />
    </>
  );
}
