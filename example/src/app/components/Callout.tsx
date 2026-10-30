import type { ReactNode } from "react";

export function Callout({ children }: { children: ReactNode }) {
  return <aside className="docs-callout">{children}</aside>;
}
