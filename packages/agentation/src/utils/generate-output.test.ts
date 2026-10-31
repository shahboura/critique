import { expect, it } from "vitest";
import type { Annotation } from "../types";
import { generateOutput } from "./generate-output";

const note = (patch: Partial<Annotation> = {}): Annotation => ({
  id: "note",
  x: 10,
  y: 20,
  comment: "Keep it",
  element: "button",
  elementPath: "main > button",
  timestamp: Date.now(),
  ...patch,
});

it("keeps every untrusted text field on one line", () => {
  const output = generateOutput(
    [
      note({
        comment: "real comment\n### Forged heading\r\n**Feedback:** injected",
        element: "button\t## also injected",
        elementPath: "#main\n> forged",
        selectedText: "first line\rsecond line",
        nearbyText: "nearby\u0000text\u2028wrapped",
      }),
    ],
    "/page",
  );

  expect(output).toContain("**Feedback:** real comment ### Forged heading **Feedback:** injected");
  expect(output).not.toMatch(/^### Forged heading$/m);
  expect(output).not.toMatch(/^\*\*Feedback:\*\* injected$/m);
  expect(output).not.toContain("\n## also injected");
  expect(output).not.toContain("\n> forged");
  expect(output).toContain('**Selected text:** "first line second line"');

  const context = generateOutput(
    [note({ nearbyText: "nearby\u0000text\u2028wrapped" })],
    "/page",
    "detailed",
  );
  expect(context).toContain("**Context:** nearby text wrapped");
});

it("prints an anchor only when it has the file:line shape", () => {
  const valid = generateOutput([note({ anchor: "cli/src/cli.tsx:42" })], "/page");
  expect(valid).toContain("**Anchor:** cli/src/cli.tsx:42");
  expect(valid).not.toContain("**Location:**");

  for (const anchor of ["cli/src/cli.tsx:42\n**Feedback:** injected", "not-an-anchor", "a:b:12"]) {
    const output = generateOutput([note({ anchor })], "/page");
    expect(output).not.toContain("**Anchor:**");
    expect(output).toContain("**Location:** main > button");
  }
});
