"use client";

import { DocHeader, DocNote, ReferenceItem, ReferenceList, ReferenceTable } from "../components/Documentation";

import { ReleaseGuides } from "../components/ReleaseGuides";
import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";

export default function APIPage() {
  return (
    <>
      <article className="article">
        <DocHeader title="API" description="Programmatic access for developers" />

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            Agentation exposes callbacks that let you integrate annotations into
            your own workflows — send to a backend, pipe to terminal, trigger
            automations, or build custom AI integrations.
          </p>
          <ul>
            <li>Sync annotations to a database or backend service</li>
            <li>Build analytics dashboards tracking feedback patterns</li>
            <li>Create custom AI integrations (MCP servers, agent tools)</li>
          </ul>
        </section>

        <section>
          <h2 id="props">Props</h2>
          <ReferenceList>
            <ReferenceItem name="onAnnotationAdd" type="(annotation: Annotation) =&gt; void">
              Called when an annotation is created
            </ReferenceItem>
            <ReferenceItem name="onAnnotationDelete" type="(annotation: Annotation) =&gt; void">
              Called when an annotation is deleted
            </ReferenceItem>
            <ReferenceItem name="onAnnotationUpdate" type="(annotation: Annotation) =&gt; void">
              Called when an annotation comment is edited
            </ReferenceItem>
            <ReferenceItem name="onAnnotationsClear" type="(annotations: Annotation[]) =&gt; void">
              Called when all annotations are cleared
            </ReferenceItem>
            <ReferenceItem name="onCopy" type="(output: string) =&gt; void">
              Receives the formatted output after a Copy attempt, even if clipboard access fails.
            </ReferenceItem>
            <ReferenceItem name="onSubmit" type="(output: string, annotations: Annotation[]) =&gt; void">
              Receives structured markdown and annotations when Send is clicked. Async callbacks are awaited; failures preserve feedback.
            </ReferenceItem>
            <ReferenceItem name="copyToClipboard" type="boolean" defaultValue="true">
              Set to false to prevent writing to clipboard (if handling via onCopy)
            </ReferenceItem>
            <ReferenceItem name="endpoint" type="string">
              MCP server URL for syncing annotations
            </ReferenceItem>
            <ReferenceItem name="sessionId" type="string">
              Pre-existing session ID to use
            </ReferenceItem>
            <ReferenceItem name="onSessionCreated" type="(sessionId: string) =&gt; void">
              Called when a new session is created
            </ReferenceItem>
            <ReferenceItem name="webhookUrl" type="string">
              Webhook URL to receive annotation events
            </ReferenceItem>
            <ReferenceItem name="className" type="string">
              Apply custom positioning and z-index to the toolbar host.
            </ReferenceItem>
            <ReferenceItem name="useHashLocation" type="boolean" defaultValue="false">
              Keep separate feedback, layout state and sessions for hash-based routes.
            </ReferenceItem>
            <ReferenceItem name="appName" type="string">
              Identify the app in copied and submitted feedback.
            </ReferenceItem>
            <ReferenceItem name="enableKeyboardShortcuts" type="boolean" defaultValue="true">
              Enable global shortcuts. Popup Enter/Escape and keyboard activation of buttons remain available.
            </ReferenceItem>
            <ReferenceItem name="identifyingAttributes" type="readonly string[]">
              Replace the default list of identifying attributes captured from selected elements.
            </ReferenceItem>
            <ReferenceItem name="copyFormat" type={'"markdown" | "source" | "classes" | { attribute: string }'} defaultValue="&quot;markdown&quot;">
              Choose full feedback, source paths, classes or an attribute value. Changes Copy only.
            </ReferenceItem>
            <ReferenceItem name="onOpenSource" type="(sourceFile: string) =&gt; void">
              Show Open in editor when a source location is available. Your callback chooses the editor integration.
            </ReferenceItem>
            <ReferenceItem name="portalContainer" type="HTMLElement | ShadowRoot | null" defaultValue="document.body">
              Keep the toolbar and popup inside a host overlay’s focus boundary.
            </ReferenceItem>
          </ReferenceList>
        </section>

        <section>
          <h2 id="basic-usage">Basic usage</h2>
          <p>
            Receive annotation data directly in your code:
          </p>
          <CodeBlock
            code={`import { Agentation, Annotation } from "agentation";

function App() {
  const handleAnnotation = (annotation: Annotation) => {
    console.log(annotation.element, annotation.comment);
  };

  return (
    <>
      <YourApp />
      <Agentation onAnnotationAdd={handleAnnotation} />
    </>
  );
}`}
          />
        </section>

        <ReleaseGuides />

        <section>
          <h2 id="annotation-type">Annotation type</h2>
          <p>
            The <code>Annotation</code> object passed to callbacks. See <a href="/schema">Agentation Format</a> for the full schema.
          </p>
          <CodeBlock
            code={`type Annotation = {
  // Required
  id: string;              // Unique identifier
  comment: string;         // User's annotation text
  elementPath: string;     // CSS selector path
  timestamp: number;       // Unix timestamp (ms)
  x: number;               // % of viewport width (0-100)
  y: number;               // px from document top
  element: string;         // Tag name ("button", "div")

  // Recommended
  url?: string;            // Page URL
  boundingBox?: {          // Element dimensions
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Context (varies by output format)
  reactComponents?: string;   // Component tree
  cssClasses?: string;
  sourceFile?: string;        // path:line:column when available
  attributes?: Record<string, string>; // Captured identifying attributes
  computedStyles?: string;
  accessibility?: string;
  nearbyText?: string;
  selectedText?: string;      // If text was selected

  // Browser component fields
  isFixed?: boolean;       // Fixed-position element
  isMultiSelect?: boolean; // Created via drag selection

  // Annotation kind (defaults to "feedback")
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
};`}
          />
        </section>

        <section>
          <h2 id="http-api">HTTP API</h2>
          <p>
            The <code>agentation-mcp</code> server provides a REST API for programmatic access:
          </p>

          <h3>Sessions</h3>
          <ReferenceTable label="Sessions">
            <thead><tr><th scope="col">Method</th><th scope="col">Endpoint</th><th scope="col">Description</th></tr></thead>
            <tbody>
              <tr>
                <td><span className="docs-http-method">POST</span></td>
                <td><code>/sessions</code></td>
                <td>Create a new session</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/sessions</code></td>
                <td>List all sessions</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/sessions/:id</code></td>
                <td>Get session with annotations</td>
              </tr>
            </tbody>
          </ReferenceTable>

          <h3>Annotations</h3>
          <ReferenceTable label="Annotations">
            <thead><tr><th scope="col">Method</th><th scope="col">Endpoint</th><th scope="col">Description</th></tr></thead>
            <tbody>
              <tr>
                <td><span className="docs-http-method">POST</span></td>
                <td><code>/sessions/:id/annotations</code></td>
                <td>Add annotation</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/annotations/:id</code></td>
                <td>Get annotation</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">PATCH</span></td>
                <td><code>/annotations/:id</code></td>
                <td>Update annotation</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">DELETE</span></td>
                <td><code>/annotations/:id</code></td>
                <td>Delete annotation</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">POST</span></td>
                <td><code>/annotations/:id/thread</code></td>
                <td>Add thread message</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/sessions/:id/pending</code></td>
                <td>Get pending annotations</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/pending</code></td>
                <td>Get all pending annotations</td>
              </tr>
            </tbody>
          </ReferenceTable>

          <h3>Events (SSE)</h3>
          <ReferenceTable label="Events (SSE)">
            <thead><tr><th scope="col">Method</th><th scope="col">Endpoint</th><th scope="col">Description</th></tr></thead>
            <tbody>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/sessions/:id/events</code></td>
                <td>Session event stream</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/events</code></td>
                <td>Global event stream (optionally filter with <code>?domain=...</code>)</td>
              </tr>
            </tbody>
          </ReferenceTable>

          <h3>Health</h3>
          <ReferenceTable label="Health">
            <thead><tr><th scope="col">Method</th><th scope="col">Endpoint</th><th scope="col">Description</th></tr></thead>
            <tbody>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/health</code></td>
                <td>Health check</td>
              </tr>
              <tr>
                <td><span className="docs-http-method">GET</span></td>
                <td><code>/status</code></td>
                <td>Server status</td>
              </tr>
            </tbody>
          </ReferenceTable>
        </section>

        <section>
          <h2 id="real-time-events">Real-Time Events</h2>
          <p>
            Subscribe to real-time events via Server-Sent Events:
          </p>
          <CodeBlock
            language="bash"
            code={`# Session-level: events for a single page
curl -N http://localhost:4747/sessions/:id/events

# Global: events across ALL sessions
curl -N http://localhost:4747/events

# Filtered by domain: events for pages on a specific domain
curl -N "http://localhost:4747/events?domain=localhost:3001"

# Reconnect after disconnect (replay missed events)
curl -N -H "Last-Event-ID: 42" http://localhost:4747/sessions/:id/events`}
          />
          <h3>Event types</h3>
          <ul className="docs-list-note">
            <li><code>annotation.created</code> &mdash; New annotation added (includes <code>kind</code> field for design annotations)</li>
            <li><code>annotation.updated</code> &mdash; Annotation modified (comment, status, design data, etc.)</li>
            <li><code>annotation.deleted</code> &mdash; Annotation removed</li>
            <li><code>session.created</code> &mdash; New session started</li>
            <li><code>session.updated</code> &mdash; Session updated</li>
            <li><code>session.closed</code> &mdash; Session closed</li>
            <li><code>action.requested</code> &mdash; Agent action requested</li>
            <li><code>thread.message</code> &mdash; New message in annotation thread</li>
          </ul>
        </section>


        <section>
          <h2 id="environment-variables">Environment Variables</h2>
          <ReferenceTable label="Environment Variables">
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">Description</th>
                <th scope="col">Default</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>AGENTATION_STORE</code></td>
                <td>Storage backend (<code>memory</code> or <code>sqlite</code>)</td>
                <td><code>sqlite</code></td>
              </tr>
              <tr>
                <td><code>AGENTATION_EVENT_RETENTION_DAYS</code></td>
                <td>Days to keep events</td>
                <td><code>7</code></td>
              </tr>
            </tbody>
          </ReferenceTable>
        </section>

        <section>
          <h2 id="storage">Storage</h2>
          <p>
            By default, data is persisted to SQLite at <code>~/.agentation/store.db</code>. To use
            in-memory storage:
          </p>
          <CodeBlock
            language="bash"
            copyable
            code={`AGENTATION_STORE=memory npx agentation-mcp server`}
          />
        </section>

        <section>
          <h2 id="programmatic-usage">Programmatic Usage</h2>
          <CodeBlock
            language="typescript"
            code={`import { startHttpServer, startMcpServer } from 'agentation-mcp';

// Start HTTP server on port 4747
startHttpServer(4747);

// Start MCP server (connects via stdio)
await startMcpServer('http://localhost:4747');`}
          />
          <DocNote>
            See <a href="/mcp">MCP Server</a> for AI agent integration and available tools.
          </DocNote>
        </section>
        <section>
          <h2 id="memory-event-history">In-memory event history</h2>
          <p>When <code>AGENTATION_STORE=memory</code>, these settings bound event replay history. They do not delete current sessions or annotations and do not change SQLite retention.</p>
          <CodeBlock language="bash" code={`AGENTATION_MAX_EVENTS=10000
AGENTATION_EVENT_TTL_MS=3600000
AGENTATION_CLEANUP_INTERVAL_MS=300000`} />
          <p>The defaults retain up to 10,000 events for one hour, with background cleanup every five minutes. Reads also remove expired events. Invalid values fall back to these defaults.</p>
        </section>
      </article>

      <Footer />
    </>
  );
}
