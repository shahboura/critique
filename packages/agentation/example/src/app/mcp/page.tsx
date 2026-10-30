"use client";

import { DocHeader, DocNote, ReferenceItem, ReferenceList, ReferenceTable } from "../components/Documentation";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";
import { AgentSetup } from "../components/AgentSetup";
import { MCPDiagram } from "../components/MCPDiagram";

export default function McpPage() {
  return (
    <>
      <article className="article">
        <DocHeader title="MCP Server" description="Connect AI agents to web page annotations via the Model Context Protocol" />

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            The <code>agentation-mcp</code> package provides an MCP server that allows AI coding agents
            (including Claude Code, Codex, Gemini CLI, and Grok Build) to receive and respond to web page annotations created with the Agentation toolbar.
            Once connected, your agent can read the feedback and element context directly.
          </p>
          <p>
            It runs both an <strong>HTTP server</strong> (for the browser toolbar) and an{" "}
            <strong>MCP server</strong> (for agents via stdio), sharing the same data store.
          </p>
          <DocNote>
            <code>toolbar</code> → <code>server</code> → <code>agent</code>
          </DocNote>

          <MCPDiagram />
        </section>

        <section>
          <h2 id="installation">Installation</h2>
          <p>Node.js 24 LTS is recommended. Node.js 22 LTS is also supported; Node.js 20 remains compatible. This requirement applies to the MCP server, not the browser toolbar.</p>
          <CodeBlock
            language="bash"
            copyable
            code={`npm install agentation-mcp
# or
pnpm add agentation-mcp`}
          />
        </section>

        <section>
          <h2 id="quick-start">Quick Start</h2>

          <h3>1. Add to your agent</h3>
          <AgentSetup />
          <p>Restart your agent or reload its MCP servers after configuration. Keep the agent running while you annotate so the browser can reach its server.</p>

          <h3>2. Verify your setup</h3>
          <CodeBlock language="bash" copyable code={`npx agentation-mcp doctor`} />
          <DocNote>
            Checks Node.js, the local server connection, and Claude Code configuration if present. For other clients, also check the server status in your agent.
          </DocNote>
          <h3>3. Connect the browser toolbar</h3>
          <CodeBlock code={`<Agentation endpoint="http://localhost:4747" />`} />
          <p>Registering the MCP server with your agent does not configure the React component. Set the matching endpoint in your app, start the agent so its server runs, then add one note in the browser and ask the agent to list pending feedback.</p>
          <p><code>doctor</code> checks the server connection. A note making the complete browser-to-agent trip confirms that both sides are connected.</p>
        </section>

        <section>
          <h2 id="cli-commands">CLI Commands</h2>
          <CodeBlock
            language="bash"
            code={`npx agentation-mcp init      # Setup wizard
npx agentation-mcp server    # Start server
npx agentation-mcp doctor    # Check setup
npx agentation-mcp help      # Show help`}
          />
        </section>

        <section>
          <h2 id="server-options">Server Options</h2>
          <CodeBlock
            language="bash"
            code={`--port <port>      # HTTP server port (default: 4747)
--mcp-only         # Skip HTTP server, only run MCP on stdio
--http-url <url>   # HTTP server URL for MCP to fetch from
--host <address>   # Interface to bind (default: loopback only)`}
          />
        </section>

        <section>
          <h2 id="browser-origins">Browser origins and delivery</h2>
          <p>Set <code>AGENTATION_CORS_ORIGINS</code> to a comma-separated list of exact HTTP(S) origins, including ports. The policy also applies to event streams and errors.</p>
          <CodeBlock language="bash" code={`AGENTATION_CORS_ORIGINS='http://localhost:3000,https://preview.example.com' npx agentation-mcp server`} />
          <p>When unset, dev-server origins are allowed: <code>localhost</code>, <code>*.localhost</code>, loopback and private-network addresses, and <code>.local</code>, <code>.test</code> or <code>.internal</code> hostnames on any port. Set the variable for public origins, or to <code>*</code> to allow every origin. An empty value rejects every browser Origin. Requests without an Origin remain allowed; this setting is not authentication.</p>
          <p>Server webhooks retry network failures, timeouts, HTTP 429 and 5xx responses. Each retry keeps the same <code>X-Agentation-Delivery-Id</code> so receivers can deduplicate. Delivery is best effort and in memory; pending deliveries do not survive a restart.</p>
          <p><a href="/webhooks#delivery-retries">Configure delivery retries</a> or <a href="/api#memory-event-history">bound in-memory event history</a>.</p>
        </section>

        <section>
          <h2 id="mcp-tools">MCP Tools</h2>
          <p>
            Nine tools are exposed to AI agents via the{" "}
            <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">
              Model Context Protocol
            </a>:
          </p>

          <ReferenceTable label="MCP Tools">
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>agentation_list_sessions</code></td>
                <td>List all active annotation sessions</td>
              </tr>
              <tr>
                <td><code>agentation_get_session</code></td>
                <td>Get a session with all its annotations</td>
              </tr>
              <tr>
                <td><code>agentation_get_pending</code></td>
                <td>Get pending annotations for a session</td>
              </tr>
              <tr>
                <td><code>agentation_get_all_pending</code></td>
                <td>Get pending annotations across all sessions</td>
              </tr>
              <tr>
                <td><code>agentation_acknowledge</code></td>
                <td>Mark an annotation as acknowledged</td>
              </tr>
              <tr>
                <td><code>agentation_resolve</code></td>
                <td>Mark an annotation as resolved</td>
              </tr>
              <tr>
                <td><code>agentation_dismiss</code></td>
                <td>Dismiss an annotation with a reason</td>
              </tr>
              <tr>
                <td><code>agentation_reply</code></td>
                <td>Add a reply to an annotation thread</td>
              </tr>
              <tr>
                <td><code>agentation_watch_annotations</code></td>
                <td>Block until new annotations appear, then return batch</td>
              </tr>
            </tbody>
          </ReferenceTable>

          <h3 id="sessions">Tool Details</h3>

          <ReferenceList>
            <ReferenceItem name="agentation_list_sessions">
              List all active annotation sessions. Use this to discover which pages have feedback.
            </ReferenceItem>
            <ReferenceItem name="agentation_get_session">
              Get a session with all its annotations. Input: <code>sessionId</code>
            </ReferenceItem>
            <ReferenceItem name="agentation_get_pending">
              Get all pending (unacknowledged) annotations for a session. Returns feedback, placement, and rearrange
              annotations. Use the <code>kind</code> field to distinguish between them. Input: <code>sessionId</code>
              <CodeBlock
                language="json"
                code={`// Response — feedback annotation
{
  "count": 2,
  "annotations": [{
    "id": "ann_123",
    "comment": "Button is cut off on mobile",
    "element": "button",
    "elementPath": "body > main > .hero > button.cta",
    "kind": "feedback",
    "intent": "fix",
    "severity": "blocking"
  }, {
    "id": "ann_456",
    "comment": "Place a Hero component here",
    "kind": "placement",
    "placement": {
      "componentType": "Hero",
      "width": 800,
      "height": 400,
      "scrollY": 0
    }
  }]
}`}
              />
            </ReferenceItem>
            <ReferenceItem name="agentation_get_all_pending">
              Get all pending annotations across ALL sessions. Returns all three annotation kinds: feedback,
              placement, and rearrange. Use this to see all unaddressed feedback and design requests from the human.
            </ReferenceItem>
            <ReferenceItem name="agentation_acknowledge">
              Mark an annotation as acknowledged. Use this to let the human know you&apos;ve seen their
              feedback and will address it. Input: <code>annotationId</code>
            </ReferenceItem>
            <ReferenceItem name="agentation_resolve">
              Mark an annotation as resolved. Use this after you&apos;ve addressed the feedback. Optionally
              include a summary of what you did. Input: <code>annotationId</code>, optional <code>summary</code>
            </ReferenceItem>
            <ReferenceItem name="agentation_dismiss">
              Dismiss an annotation. Use this when you&apos;ve decided not to address the feedback, with a
              reason why. Input: <code>annotationId</code>, <code>reason</code>
            </ReferenceItem>
            <ReferenceItem name="agentation_reply">
              Add a reply to an annotation&apos;s thread. Use this to ask clarifying questions or provide
              updates to the human. Input: <code>annotationId</code>, <code>message</code>
            </ReferenceItem>
            <ReferenceItem name="agentation_watch_annotations">
              Block until new annotations appear, then collect a batch and return them. Picks up all annotation
              kinds: feedback, placement, and rearrange. Layout mode placements and rearrange changes trigger
              the watcher just like regular feedback annotations.
              After detecting the first new annotation, waits for a batch window to collect more before returning.
              Use in a loop for hands-free feedback processing.
              Input: optional <code>sessionId</code>, optional <code>batchWindowSeconds</code> (default: 10, max: 60),
              optional <code>timeoutSeconds</code> (default: 120, max: 300)
            </ReferenceItem>
          </ReferenceList>
        </section>

        <section>
          <h2 id="hands-free-mode">Hands-Free Mode</h2>
          <p>
            Use <code>agentation_watch_annotations</code> in a loop for automatic feedback
            processing &mdash; the agent automatically picks up new annotations as they&apos;re created:
          </p>
          <ol>
            <li>Agent calls <code>agentation_watch_annotations</code> (blocks until annotations appear)</li>
            <li>Annotations arrive &mdash; agent receives batch after collection window</li>
            <li>Agent processes each annotation:
              <ul>
                <li><code>agentation_acknowledge</code> &mdash; mark as seen</li>
                <li>Make code changes and verify the result, including a browser check for visual feedback</li>
                <li><code>agentation_resolve</code> &mdash; mark verified work as done (annotation disappears from browser)</li>
              </ul>
            </li>
            <li>Agent calls <code>agentation_watch_annotations</code> again (loop)</li>
          </ol>
          <CodeBlock
            language="markdown"
            copyable
            code={`# Example CLAUDE.md instructions
When I say "watch mode", call agentation_watch_annotations in a loop.
For each annotation: read its thread, acknowledge actionable work, make the fix,
and verify it before resolving with a summary. Leave questions and unverified
work unresolved.
Continue watching until I say stop or timeout is reached.`}
          />
        </section>

        <section>
          <h2 id="critique-mode">Critique Mode</h2>
          <p>
            Hands-free mode waits for <em>you</em> to annotate. Critique mode flips that &mdash; the
            agent opens a headed browser, scrolls through your page top-to-bottom, and adds
            design annotations through the toolbar on your behalf. You watch the cursor move
            across the page in real time.
          </p>
          <CodeBlock
            language="markdown"
            copyable
            code={`Critique the UI at http://localhost:3000`}
          />
          <ol>
            <li>Agent opens a headed browser to your page</li>
            <li>Scrolls top-to-bottom, picking elements to critique</li>
            <li>Moves cursor to each element, clicks to open the annotation dialog</li>
            <li>Types specific, actionable feedback and submits</li>
            <li>Repeats for 5&ndash;8 annotations across hierarchy, spacing, typography, navigation, and CTAs</li>
          </ol>
          <DocNote>
            You review them in the toolbar and decide what to fix.
          </DocNote>

          <h3>Requires</h3>
          <CodeBlock
            language="bash"
            copyable
            code={`npx skills add vercel-labs/agent-browser`}
          />
        </section>

        <section>
          <h2 id="self-driving-mode">Self-Driving Mode</h2>
          <p>
            Critique mode leaves annotations for you to review. Self-driving mode goes
            further &mdash; the same agent also fixes each issue after annotating it.
          </p>
          <CodeBlock
            language="markdown"
            copyable
            code={`Self-driving mode on http://localhost:3000`}
          />
          <ol>
            <li>Agent opens a headed browser to your page</li>
            <li>Scrolls to an element, adds a critique annotation (visible in the toolbar)</li>
            <li>Reads the relevant source code and edits it to fix the issue</li>
            <li>Calls <code>agentation_resolve</code> &mdash; annotation disappears from the browser</li>
            <li>Verifies the fix in the browser (if a dev server is running)</li>
            <li>Moves to the next element, repeats</li>
          </ol>
          <DocNote>
            One Claude Code session handles everything &mdash; browser, code, and annotations.
          </DocNote>

          <h3>Requires</h3>
          <DocNote>
            Everything from critique mode, plus the self-driving skill:
          </DocNote>
          <CodeBlock
            language="bash"
            copyable
            code={`ln -s "$(pwd)/skills/agentation-self-driving" ~/.claude/skills/agentation-self-driving`}
          />
        </section>

        <section>
          <h2 id="types">TypeScript Types</h2>
          <p>
            Key types for building your own integrations:
          </p>
          <CodeBlock
            language="typescript"
            code={`import type {
  Annotation,
  AnnotationIntent,    // "fix" | "change" | "question" | "approve"
  AnnotationSeverity,  // "blocking" | "important" | "suggestion"
  AnnotationStatus,    // "pending" | "acknowledged" | "resolved" | "dismissed"
  Session,
  SessionStatus,       // "active" | "approved" | "closed"
  SessionWithAnnotations,
  ThreadMessage,
  AFSEvent,
  AFSEventType,
  ActionRequest,
} from 'agentation-mcp';`}
          />
        </section>
      </article>

      <Footer />
    </>
  );
}
