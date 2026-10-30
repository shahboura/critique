"use client";

import { Highlight, type PrismTheme } from "prism-react-renderer";
import { CopyButton } from "./CopyButton";

const syntaxTheme: PrismTheme = {
  plain: { color: "#343740", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#828790" } },
    { types: ["punctuation", "operator"], style: { color: "#717784" } },
    { types: ["keyword", "atrule"], style: { color: "#8b42bd" } },
    { types: ["string", "attr-value", "template-string"], style: { color: "#16816b" } },
    { types: ["function", "property", "attr-name"], style: { color: "#286cb7" } },
    { types: ["number", "boolean", "constant"], style: { color: "#c46524" } },
    { types: ["tag", "class-name", "builtin"], style: { color: "#ba4162" } },
    { types: ["deleted"], style: { color: "#ba4162" } },
    { types: ["inserted"], style: { color: "#16816b" } },
  ],
};

export function CodeBlock({
  code,
  language = "tsx",
  copyable = false,
  textOpacity = 1,
}: {
  code: string;
  language?: string;
  copyable?: boolean;
  textOpacity?: number;
}) {
  return (
    <div className={`docs-code${copyable ? " docs-code-copyable" : ""}`}>
      <Highlight theme={syntaxTheme} code={code.trim()} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="code-block">
            <code style={{ opacity: textOpacity, transition: "opacity 150ms ease" }}>
            {tokens.map((line, i) => (
              <span key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
                {i < tokens.length - 1 ? "\n" : ""}
              </span>
            ))}
            </code>
          </pre>
        )}
      </Highlight>
      {copyable && <CopyButton text={code.trim()} className="docs-code-copy" />}
    </div>
  );
}
