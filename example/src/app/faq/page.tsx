"use client";

import { DocHeader } from "../components/Documentation";

import { useState } from "react";
import { Footer } from "../Footer";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const faqCategories: FAQCategory[] = [
  {
    title: "Basics",
    items: [
      {
        question: "What is Agentation?",
        answer: "Agentation is a floating toolbar that lets you annotate web pages and generate structured feedback for AI coding agents. Click elements, select text, and copy markdown that agents can parse to find and fix issues in your codebase.</p><p>It grew out of <a href=\"https://benji.org/annotating\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"faq-link\">a post by Benji Taylor</a> exploring how to give better feedback to AI agents, and has since been packaged for anyone to use."
      },
      {
        question: "Why not just screenshot and annotate?",
        answer: "Screenshots lose the connection to code. When you annotate a screenshot, the AI has to guess which component you mean by \"the blue button.\" Agentation gives agents actual selectors like <code>.sidebar > button.primary</code> that they can <code>grep</code> for in your codebase. It's the difference between \"fix this\" and \"fix this at <code>src/components/Button.tsx:42</code>.\""
      },
      {
        question: "How do I install it?",
        answer: "Install via npm with <code>npm install agentation -D</code>, then import and add the <code>&lt;Agentation /&gt;</code> component to your app. Works with React 18 and Next.js."
      },
      {
        question: "Is there a Claude Code integration?",
        answer: "Yes. Run <code>npx skills add benjitaylor/agentation</code> in your terminal, then <code>/agentation</code> in Claude Code. It detects your framework, installs the package, creates a provider component, and wires it into your layout."
      },
    ]
  },
  {
    title: "Usage",
    items: [
      {
        question: "How does element identification work?",
        answer: "Agentation automatically identifies elements using class names, IDs, text content, and semantic structure. Buttons are named by their text, headings by content, images by <code>alt</code> text. This makes it easy for agents to <code>grep</code> for elements in your codebase."
      },
      {
        question: "Does it detect React components?",
        answer: "Yes. On React pages, Agentation traverses the fiber tree to find the component hierarchy for each annotated element. You'll see component names like <code>&lt;App&gt; &lt;Dashboard&gt; &lt;Button&gt;</code> in tooltips and output. This helps agents find the exact component file to edit. You can configure detection mode (Filtered, Smart, All, or Off) in settings."
      },
      {
        question: "Can I annotate text selections?",
        answer: "Yes. Select any text on the page to annotate specific content. The selected text is quoted in the output, making it easy for agents to search for exact strings in your code."
      },
      {
        question: "How do I collapse the toolbar?",
        answer: "Click <svg style=\"display:inline-block;vertical-align:-0.45em;width:1.5em;height:1.5em;margin:0 -0.1em\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><path d=\"M16.25 16.25L7.75 7.75\" /><path d=\"M7.75 16.25L16.25 7.75\" /></svg> or press <code>Escape</code> to collapse the toolbar. It stays minimal until you need it again."
      },
      {
        question: "Can I pause animations?",
        answer: "Yes. Click <svg style=\"display:inline-block;vertical-align:-0.45em;width:1.5em;height:1.5em;margin:0 -0.1em\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><path d=\"M8 6L8 18\" /><path d=\"M16 18L16 6\" /></svg> to pause supported page motion, including CSS animations, Web Animations, and videos. Custom animation engines may require their own pause controls."
      },
      {
        question: "Can I customize marker colors?",
        answer: "Yes. Click <svg style=\"display:inline-block;vertical-align:-0.45em;width:1.5em;height:1.5em;margin:0 -0.1em\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.6504 5.81117C10.9939 4.39628 13.0061 4.39628 13.3496 5.81117C13.5715 6.72517 14.6187 7.15891 15.4219 6.66952C16.6652 5.91193 18.0881 7.33479 17.3305 8.57815C16.8411 9.38134 17.2748 10.4285 18.1888 10.6504C19.6037 10.9939 19.6037 13.0061 18.1888 13.3496C17.2748 13.5715 16.8411 14.6187 17.3305 15.4219C18.0881 16.6652 16.6652 18.0881 15.4219 17.3305C14.6187 16.8411 13.5715 17.2748 13.3496 18.1888C13.0061 19.6037 10.9939 19.6037 10.6504 18.1888C10.4285 17.2748 9.38135 16.8411 8.57815 17.3305C7.33479 18.0881 5.91193 16.6652 6.66952 15.4219C7.15891 14.6187 6.72517 13.5715 5.81117 13.3496C4.39628 13.0061 4.39628 10.9939 5.81117 10.6504C6.72517 10.4285 7.15891 9.38134 6.66952 8.57815C5.91193 7.33479 7.33479 5.91192 8.57815 6.66952C9.38135 7.15891 10.4285 6.72517 10.6504 5.81117Z\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/></svg> to choose from preset colors for annotation markers. Your preference is saved in <code>localStorage</code>."
      },
      {
        question: "Where are annotations stored?",
        answer: "By default, annotations are stored in <code>localStorage</code>, keyed by page pathname. They persist across page refreshes but are cleared after 7 days. With Agent Sync enabled, annotations are also synchronized to the MCP server. Server persistence depends on its configured storage backend. Use <code>useHashLocation</code> to keep notes separate for hash-based routes."
      },
      {
        question: "What is Agent Sync?",
        answer: "Agent Sync connects the browser toolbar to an MCP server, enabling real-time sync between reviewers and AI agents. Annotations persist across pages and can be accessed via MCP tools. Run <code>npx add-mcp \"npx -y agentation-mcp server\"</code> to configure your agent, or <code>npx agentation-mcp init</code> for Claude Code specifically, then set <code>endpoint=\"http://localhost:4747\"</code> on the React component. Keep the agent running and add a note to check the connection."
      },
    ]
  },
  {
    title: "Output",
    items: [
      {
        question: "What output formats are available?",
        answer: "Four formats: <code>Compact</code> (minimal context), <code>Standard</code> (balanced), <code>Detailed</code> (full context with bounding boxes), and <code>Forensic</code> (maximum detail including computed styles). Choose based on how much context your AI agent needs."
      },
      {
        question: "Which AI agents work with Agentation?",
        answer: "Any agent that accepts text can read the copied output, including Claude, Codex, Gemini, Grok, and Copilot. For direct feedback sync, connect a client that supports local stdio MCP, such as Claude Code, Codex, Gemini CLI, or Grok Build. See the <a href=\"/install#agent-integration\" class=\"faq-link\">setup guide</a>."
      },
      {
        question: "Can multiple people share annotations?",
        answer: "With Agent Sync enabled, annotations sync to a shared server and can be accessed by multiple users or agents. Without Agent Sync, annotations are stored locally in each user's browser - you can still share by copying the markdown output."
      },
    ]
  },
  {
    title: "Technical",
    items: [
      {
        question: "Is there a React dependency?",
        answer: "Yes, Agentation requires React 18+ as a peer dependency. It's built as a React component to integrate seamlessly with modern React applications."
      },
      {
        question: "Does it work with TypeScript?",
        answer: "Yes. Agentation is written in TypeScript and exports full type definitions. Props like <code>demoAnnotations</code> and configuration options are fully typed."
      },
      {
        question: "Does it work with SSR/SSG?",
        answer: "Yes. Agentation is a client-side component that hydrates after page load. It works with Next.js, Remix, Astro, and other SSR/SSG frameworks without issues."
      },
      {
        question: "Does it affect performance?",
        answer: "Minimal impact. Agentation only adds event listeners and renders a small toolbar. It doesn't modify your existing DOM or intercept network requests. The annotation markers are lightweight SVG overlays."
      },
      {
        question: "Should I include it in production?",
        answer: "You can, but it's designed as a development tool. We recommend conditionally rendering it only in development or behind a feature flag. The launcher is visible when the component is mounted."
      },
      {
        question: "Can I annotate iframes or shadow DOM?",
        answer: "Agentation can select elements inside open shadow roots and same-origin iframes, including nested frames. Closed shadow roots and cross-origin frames remain inaccessible. For a cross-origin app, mount Agentation inside that app instead."
      },
      {
        question: "I'm having issues with better-sqlite3 in the MCP server",
        answer: "The MCP server uses <code>better-sqlite3</code> as a native dependency, which occasionally causes build or runtime issues depending on your Node.js version and platform. If you run into problems, check the <a href=\"https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"faq-link\">better-sqlite3 troubleshooting guide</a> for solutions."
      },
      {
        question: "How do I report bugs or request features?",
        answer: "Open an issue on <a href=\"https://github.com/benjitaylor/agentation/issues\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"faq-link\">GitHub</a>. Pull requests are welcome too."
      },
    ]
  },
];

function FAQToggle({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="faq-item">
      <button className="faq-question" onClick={onToggle} aria-expanded={isOpen}>
        <span>{item.question}</span>
        <span className={`faq-icon ${isOpen ? 'open' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <div className={`faq-answer ${isOpen ? 'open' : ''}`}>
        <div className="faq-answer-inner">
          {item.answer.split("</p><p>").map((paragraph, index) => (
            <p key={index} dangerouslySetInnerHTML={{ __html: paragraph }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const handleToggle = (key: string) => {
    setOpenKey(openKey === key ? null : key);
  };

  return (
    <>

      <article className="article">
        <DocHeader title="FAQ" description="Common questions about Agentation" />

        {faqCategories.map((category, catIndex) => (
          <div key={catIndex} className="faq-category">
            <h2>{category.title}</h2>
            {category.items.map((faq, itemIndex) => {
              const key = `${catIndex}-${itemIndex}`;
              return (
                <FAQToggle
                  key={key}
                  item={faq}
                  isOpen={openKey === key}
                  onToggle={() => handleToggle(key)}
                />
              );
            })}
          </div>
        ))}
      </article>

      <Footer />
    </>
  );
}
