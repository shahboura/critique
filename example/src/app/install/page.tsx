"use client";

import { DocAside, DocHeader, DocNote } from "../components/Documentation";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";
import { CopyButton } from "../components/CopyButton";
import { AgentSetup } from "../components/AgentSetup";
import { Callout } from "../components/Callout";

export default function InstallPage() {
  return (
    <>
      <article className="article">
        <DocHeader title="Installation" description="Get started with Agentation in your project" />

        <p>Start with the React component and copy feedback into any agent. Add MCP when you want your agent to read annotations and respond directly.</p>

        <section>
          <h2>Install the package</h2>
          <CodeBlock code="npm install agentation -D" language="bash" copyable />
          <DocNote>
            Or use{" "}
            <CopyButton text="yarn add agentation --dev" className="docs-copy-inline" label="Copy yarn install command">yarn</CopyButton>,{" "}
            <CopyButton text="pnpm add agentation -D" className="docs-copy-inline" label="Copy pnpm install command">pnpm</CopyButton>, or{" "}
            <CopyButton text="bun add agentation -d" className="docs-copy-inline" label="Copy bun install command">bun</CopyButton>.
          </DocNote>
        </section>

        <section>
          <h2>Add to your app</h2>
          <p>
            Add the component anywhere in your React app, ideally at the root
            level. The <code>NODE_ENV</code> check renders the toolbar only in
            development.
          </p>
          <CodeBlock
            code={`import { Agentation } from "agentation";

function App() {
  return (
    <>
      <YourApp />
      {process.env.NODE_ENV === "development" && <Agentation />}
    </>
  );
}`}
            language="tsx"
          />
        </section>

        <section>
          <h2 id="agent-integration">Connect your agent</h2>
          <p>Claude Code, Codex, Gemini CLI, Grok Build, and other clients can connect through MCP. Use Node.js 24 LTS for a new setup. Node.js 22 LTS and 20 are also compatible.</p>
          <h3>1. Register the MCP server</h3>
          <AgentSetup />
          <p>Restart your agent or reload its MCP servers after configuration. Your agent starts the server when it connects.</p>

          <h3>2. Verify setup</h3>
          <p>
            Check that everything is configured correctly:
          </p>
          <CodeBlock code="npx agentation-mcp doctor" language="bash" copyable />
          <DocNote>
            The server runs on port 4747 by default. Use <code>--port 8080</code> to change it.
          </DocNote>

          <h3>3. Connect the component</h3>
          <p>
            Point the React component to your server:
          </p>
          <CodeBlock code={`<Agentation endpoint="http://localhost:4747" />`} language="tsx" />
          <DocNote>
            Annotations are stored locally and synced to the server when connected. Registering the server with your agent does not set this endpoint for you. Add a note in the browser, then ask your agent to list pending feedback to check the complete connection.
          </DocNote>

          <ul className="docs-list-note">
            <li><strong>Local-first</strong> &mdash; Works offline, syncs when server is available</li>
            <li><strong>Session continuity</strong> &mdash; Rejoins the same session on page refresh</li>
            <li><strong>No duplicates</strong> &mdash; Only new annotations are uploaded; existing ones are skipped</li>
            <li><strong>Server authority</strong> &mdash; Agent changes (resolve, dismiss) take precedence on rejoin</li>
          </ul>

          <Callout><p>Using Claude Code? The optional <code>/agentation</code> skill can set up the React component for you. Install it with <code>npx skills add benjitaylor/agentation</code>, then run <code>/agentation</code> in Claude Code.</p></Callout>
        </section>

        <DocAside title="Requirements">
          <ul>
            <li>
              <strong>React 18+</strong> &mdash; Uses modern React features
            </li>
            <li>
              <strong>Client-side only</strong> &mdash; Requires DOM access
            </li>
            <li>
              <strong>Desktop only</strong> &mdash; Not optimized for mobile
              devices
            </li>
            <li>
              <strong>Zero dependencies</strong> &mdash; No runtime deps beyond
              React
            </li>
          </ul>
        </DocAside>

        <section>
          <h2>Customize your setup</h2>
          <p>The <a href="/api#props">API reference</a> covers every prop and callback, including Copy formats, source editor links, hash routing, and integrations with dialogs and menus.</p>
        </section>

        <DocAside title="Security notes">
          <p>
            Agentation runs in your browser and reads DOM content to generate
            feedback. By default, it does <strong>not</strong> send data anywhere &mdash;
            everything stays local until you manually copy and paste.
          </p>
          <ul>
            <li>
              <strong>No external requests</strong> &mdash; all processing is
              client-side by default
            </li>
            <li>
              <strong>Your configured endpoint</strong> &mdash; annotations are sent to the server you choose. Use a localhost endpoint for a local workflow
            </li>
            <li>
              <strong>Optional integrations</strong> &mdash; configured webhooks and callbacks can send feedback to other services
            </li>
            <li>
              <strong>Dev-only</strong> &mdash; use the <code>NODE_ENV</code>{" "}
              check to exclude from production
            </li>
          </ul>
        </DocAside>
      </article>

      <Footer />
    </>
  );
}
