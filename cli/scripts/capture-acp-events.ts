#!/usr/bin/env bun
// Script to capture ACP events from an opencode session and save to JSON
// Usage: bun run scripts/capture-acp-events.ts [output-file]

import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type SessionNotification,
} from "@agentclientprotocol/sdk"
import fs from "fs"

const outputFile = process.argv[2] || "acp-events.json"
const events: SessionNotification[] = []

console.log("Spawning opencode ACP server...")

const proc = Bun.spawn([ "opencode", "acp"], {
  stdin: "pipe",
  stdout: "pipe",
  stderr: "inherit",
})

const procStdin = proc.stdin
const procStdout = proc.stdout

if (!procStdin || !procStdout) {
  throw new Error("Failed to create stdin/stdout pipes")
}

const stdin = new WritableStream<Uint8Array>({
  write: (chunk) => {
    if (typeof procStdin !== "number" && "write" in procStdin) {
      procStdin.write(chunk)
    }
  },
})

const stdout = procStdout as ReadableStream<Uint8Array>
const stream = ndJsonStream(stdin, stdout)

const conn = client()
  .onNotification(methods.client.session.update, ({ params }) => {
    events.push(params)
    // Log event type for visibility
    console.log(`[${events.length}] ${params.update.sessionUpdate}`)
  })
  .onRequest(methods.client.session.requestPermission, ({ params }) => {
    console.log("Permission requested:", params.toolCall?.title)
    const allowOption = params.options?.find(
      (o) => o.kind === "allow_once" || o.kind === "allow_always",
    )
    if (allowOption) {
      return {
        outcome: { outcome: "selected" as const, optionId: allowOption.optionId },
      }
    }
    return { outcome: { outcome: "cancelled" as const } }
  })
  .connect(stream)

console.log("Initializing ACP connection...")
await conn.agent.request(methods.agent.initialize, {
  protocolVersion: PROTOCOL_VERSION,
  clientCapabilities: {},
})
console.log("Connected!")

const cwd = process.cwd()

// Create new session
console.log("Creating new session...")
const { sessionId } = await conn.agent.request(methods.agent.session.new, {
  cwd,
  mcpServers: [],
})
console.log(`Session created: ${sessionId}`)

// Send a prompt - can be customized via env var
const prompt = process.env.ACP_PROMPT || `Say "Hello! I'm ready to help you review code." and nothing else.`

console.log("Sending prompt...")
console.log("---")

try {
  await conn.agent.request(methods.agent.session.prompt, {
    sessionId,
    prompt: [{ type: "text", text: prompt }],
  })
} catch (error) {
  console.error("Prompt error:", error)
}

console.log("---")
console.log(`Captured ${events.length} events`)

// Save to file
fs.writeFileSync(outputFile, JSON.stringify(events, null, 2))
console.log(`Saved to ${outputFile}`)

// Cleanup
proc.kill()
process.exit(0)
