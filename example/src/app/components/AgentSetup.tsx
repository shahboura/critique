"use client";

import { useId, useState } from "react";
import { CodeBlock } from "./CodeBlock";
import { Select } from "./Select";

const clients = [
  { name: "Claude Code", command: "claude mcp add agentation -- npx -y agentation-mcp server", docs: "https://code.claude.com/docs/en/mcp" },
  { name: "Codex", command: "codex mcp add agentation -- npx -y agentation-mcp server", docs: "https://developers.openai.com/codex/mcp/" },
  { name: "Gemini CLI", command: "gemini mcp add agentation npx -- -y agentation-mcp server", docs: "https://geminicli.com/docs/tools/mcp-server/" },
  { name: "Grok Build", command: "grok mcp add agentation -- npx -y agentation-mcp server", docs: "https://docs.x.ai/build/features/mcp-servers" },
  { name: "Other MCP clients", command: 'npx -y agentation-mcp server', docs: null },
];

export function AgentSetup() {
  const [selected, setSelected] = useState(clients[0].name);
  const id = useId();
  const client = clients.find(({ name }) => name === selected)!;

  return (
    <div className="agent-setup">
      <div className="agent-setup-heading">
        <label htmlFor={id}>Your agent</label>
        <Select id={id} value={selected} onValueChange={setSelected} options={clients.map(({ name }) => name)} />
      </div>
      {selected === "Other MCP clients" ? (
        <p className="docs-caption">Add a local stdio MCP server named <code>agentation</code> with this command.</p>
      ) : (
        <p className="docs-caption">Run this in your terminal with {client.name} installed.</p>
      )}
      <CodeBlock key={selected} code={client.command} language="bash" copyable />
      {client.docs && <p className="docs-caption"><a href={client.docs} target="_blank" rel="noopener noreferrer">{client.name} MCP documentation ↗</a></p>}
    </div>
  );
}
