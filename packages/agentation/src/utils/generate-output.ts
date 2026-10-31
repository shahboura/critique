import {
  OutputDetailLevel,
  ReactComponentMode,
} from "../components/page-toolbar-css";
import { Annotation } from "../types";

export const OUTPUT_TO_REACT_MODE: Record<
  OutputDetailLevel,
  ReactComponentMode
> = {
  compact: "off",
  standard: "filtered",
  detailed: "smart",
  forensic: "all",
};

export const OUTPUT_DETAIL_OPTIONS: {
  value: OutputDetailLevel;
  label: string;
}[] = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
  { value: "forensic", label: "Forensic" },
];

// Annotation text can come from the page or another client, so it is
// untrusted: collapse CR/LF and control characters so a note cannot forge
// markdown headings, list items or extra fields.
function oneLine(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ");
}

// file:line or file:line-line, no whitespace or colon in the path.
const ANCHOR_PATTERN = /^[^\s:]+:\d+(?:-\d+)?$/;

export function generateOutputHeader(pathname: string, appName?: string): string {
  let output = `## Page Feedback: ${pathname}\n`;
  const name = oneLine(appName).trim();
  if (name) output += `**App:** ${name.replace(/[\\`*_\[\]<>]/g, "\\$&")}\n`;
  return output;
}

export function generateOutput(
  annotations: Annotation[],
  pathname: string,
  detailLevel: OutputDetailLevel = "standard",
  options: { appName?: string } = {},
): string {
  if (annotations.length === 0) return "";

  const viewport =
    typeof window !== "undefined"
      ? `${window.innerWidth}×${window.innerHeight}`
      : "unknown";

  let output = generateOutputHeader(pathname, options.appName);

  if (detailLevel === "forensic") {
    output += `\n**Environment:**\n`;
    output += `- Viewport: ${viewport}\n`;
    if (typeof window !== "undefined") {
      output += `- URL: ${window.location.href}\n`;
      output += `- User Agent: ${navigator.userAgent}\n`;
      output += `- Timestamp: ${new Date().toISOString()}\n`;
      output += `- Device Pixel Ratio: ${window.devicePixelRatio}\n`;
    }
    output += `\n---\n`;
  } else if (detailLevel !== "compact") {
    output += `**Viewport:** ${viewport}\n`;
  }
  output += "\n";

  annotations.forEach((a, i) => {
    if (detailLevel === "compact") {
      output += `${i + 1}. **${oneLine(a.element)}**${a.sourceFile ? ` (${oneLine(a.sourceFile)})` : ""}: ${oneLine(a.comment)}`;
      if (a.selectedText) {
        const selected = oneLine(a.selectedText);
        output += ` (re: "${selected.slice(0, 30)}${selected.length > 30 ? "..." : ""}")`;
      }
      output += "\n";
    } else if (detailLevel === "forensic") {
      output += `### ${i + 1}. ${oneLine(a.element)}\n`;
      if (a.isMultiSelect && a.fullPath) {
        output += `*Forensic data shown for first element of selection*\n`;
      }
      if (a.fullPath) {
        output += `**Full DOM Path:** ${oneLine(a.fullPath)}\n`;
      }
      if (a.cssClasses) {
        output += `**CSS Classes:** ${oneLine(a.cssClasses)}\n`;
      }
      if (a.boundingBox) {
        output += `**Position:** x:${Math.round(a.boundingBox.x)}, y:${Math.round(a.boundingBox.y)} (${Math.round(a.boundingBox.width)}×${Math.round(a.boundingBox.height)}px)\n`;
      }
      output += `**Annotation at:** ${Number(a.x ?? 0).toFixed(1)}% from left, ${Math.round(a.y)}px from top\n`;
      if (a.selectedText) {
        output += `**Selected text:** "${oneLine(a.selectedText)}"\n`;
      }
      if (a.nearbyText && !a.selectedText) {
        output += `**Context:** ${oneLine(a.nearbyText).slice(0, 100)}\n`;
      }
      if (a.computedStyles) {
        output += `**Computed Styles:** ${oneLine(a.computedStyles)}\n`;
      }
      if (a.accessibility) {
        output += `**Accessibility:** ${oneLine(a.accessibility)}\n`;
      }
      if (a.nearbyElements) {
        output += `**Nearby Elements:** ${oneLine(a.nearbyElements)}\n`;
      }
      if (a.sourceFile) {
        output += `**Source:** ${oneLine(a.sourceFile)}\n`;
      }
      if (a.reactComponents) {
        output += `**React:** ${oneLine(a.reactComponents)}\n`;
      }
      output += `**Feedback:** ${oneLine(a.comment)}\n\n`;
    } else {
      // standard and detailed
      output += `### ${i + 1}. ${oneLine(a.element)}\n`;
      const anchor = oneLine(a.anchor);
      if (ANCHOR_PATTERN.test(anchor)) {
        output += `**Anchor:** ${anchor}\n`;
      } else {
        output += `**Location:** ${oneLine(a.elementPath)}\n`;
      }
      if (a.sourceFile) {
        output += `**Source:** ${oneLine(a.sourceFile)}\n`;
      }
      if (a.reactComponents) {
        output += `**React:** ${oneLine(a.reactComponents)}\n`;
      }
      if (detailLevel === "detailed") {
        if (a.cssClasses) {
          output += `**Classes:** ${oneLine(a.cssClasses)}\n`;
        }
        if (a.boundingBox) {
          output += `**Position:** ${Math.round(a.boundingBox.x)}px, ${Math.round(a.boundingBox.y)}px (${Math.round(a.boundingBox.width)}×${Math.round(a.boundingBox.height)}px)\n`;
        }
      }
      if (a.selectedText) {
        output += `**Selected text:** "${oneLine(a.selectedText)}"\n`;
      }
      if (detailLevel === "detailed" && a.nearbyText && !a.selectedText) {
        output += `**Context:** ${oneLine(a.nearbyText).slice(0, 100)}\n`;
      }
      output += `**Feedback:** ${oneLine(a.comment)}\n\n`;
    }
  });

  return output.trim();
}
