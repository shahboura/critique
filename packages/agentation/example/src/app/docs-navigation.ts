export type DocLink = {
  href: string;
  label: string;
  badge?: string;
  items?: { id: string; text: string }[];
};

// Desktop navigation, mobile navigation and page anchors share this inventory.
export const docsNavigation: (DocLink | { section: string })[] = [
  { href: "/", label: "Overview" },
  { href: "/install", label: "Install" },
  {
    href: "/features",
    label: "Features",
    items: [
      { id: "annotation-modes", text: "Annotation Modes" },
      { id: "toolbar-controls", text: "Toolbar Controls" },
      { id: "marker-types", text: "Marker Types" },
      { id: "smart-identification", text: "Smart Identification" },
      { id: "computed-styles", text: "Computed Styles" },
      { id: "react-detection", text: "React Detection" },
      { id: "layout-mode", text: "Layout Mode" },
      { id: "keyboard-shortcuts", text: "Keyboard Shortcuts" },
      { id: "agent-sync", text: "Agent Sync" },
      { id: "settings", text: "Settings" },
      { id: "integrations", text: "Fit Your App" },
    ],
  },
  { href: "/output", label: "Output" },
  {
    href: "/schema",
    label: "Schema",
    badge: "AFS 1.1",
    items: [
      { id: "overview", text: "Overview" },
      { id: "what-this-unlocks", text: "What This Unlocks" },
      { id: "design-goals", text: "Design Goals" },
      { id: "annotation-object", text: "Annotation Object" },
      { id: "typescript-definition", text: "TypeScript" },
      { id: "browser-metadata", text: "Browser Metadata" },
      { id: "event-envelope", text: "Event Envelope" },
      { id: "json-schema", text: "JSON Schema" },
      { id: "example", text: "Example" },
      { id: "layout-mode-example", text: "Layout Example" },
      { id: "markdown-output", text: "Markdown Output" },
      { id: "implementations", text: "Implementations" },
      { id: "building", text: "Building" },
      { id: "why", text: "Why This Format?" },
      { id: "versioning", text: "Versioning" },
    ],
  },
  { section: "Tools" },
  {
    href: "/mcp",
    label: "MCP",
    items: [
      { id: "overview", text: "Overview" },
      { id: "installation", text: "Installation" },
      { id: "quick-start", text: "Quick Start" },
      { id: "cli-commands", text: "CLI Commands" },
      { id: "server-options", text: "Server Options" },
      { id: "browser-origins", text: "Browser Origins" },
      { id: "mcp-tools", text: "MCP Tools" },
      { id: "hands-free-mode", text: "Hands-Free Mode" },
      { id: "critique-mode", text: "Critique Mode" },
      { id: "self-driving-mode", text: "Self-Driving Mode" },
      { id: "types", text: "TypeScript Types" },
    ],
  },
  {
    href: "/api",
    label: "API",
    items: [
      { id: "overview", text: "Overview" },
      { id: "props", text: "Props" },
      { id: "basic-usage", text: "Basic Usage" },
      { id: "copy-formats", text: "Copy Formats" },
      { id: "identifying-attributes", text: "Identifiers" },
      { id: "open-in-editor", text: "Open in Editor" },
      { id: "host-overlays", text: "Host Overlays" },
      { id: "embedded-pages", text: "Embedded Pages" },
      { id: "routing-and-shortcuts", text: "Routing & Shortcuts" },
      { id: "annotation-type", text: "Annotation Type" },
      { id: "http-api", text: "HTTP API" },
      { id: "real-time-events", text: "Real-Time Events" },
      { id: "environment-variables", text: "Environment Variables" },
      { id: "storage", text: "Storage" },
      { id: "programmatic-usage", text: "Programmatic Usage" },
      { id: "memory-event-history", text: "Memory History" },
    ],
  },
  { href: "/webhooks", label: "Webhooks" },
  { section: "Resources" },
  { href: "/changelog", label: "Changelog" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
];

export const docPages = docsNavigation.filter(
  (item): item is DocLink => "href" in item,
);
