import type { ReactNode } from "react";

export function DocHeader({ title, description, badge, hideTitle = false, children }: {
  title: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  hideTitle?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="docs-header">
      <h1 className={hideTitle ? "docs-sr-only" : undefined}>{title}{badge != null && <span className="docs-badge">{badge}</span>}</h1>
      <p className="tagline">{description}</p>
      {children}
    </header>
  );
}

/** Supporting constraints share one treatment across documentation pages. */
export function DocAside({ title, id, children }: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className="docs-aside">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function DocNote({ children }: { children: ReactNode }) {
  return <p className="docs-note">{children}</p>;
}

export function DocFootnote({ marker, children }: { marker: string; children: ReactNode }) {
  return (
    <p className="docs-footnote">
      <span className="docs-footnote-marker">{marker}</span>
      <span>{children}</span>
    </p>
  );
}

export function ReferenceList({ children }: { children: ReactNode }) {
  return <dl className="docs-reference-list">{children}</dl>;
}

export function ReferenceItem({ name, type, defaultValue, children }: {
  name: string;
  type?: ReactNode;
  defaultValue?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="docs-reference-item">
      <dt>
        <code className="docs-reference-name">{name}</code>
        {type != null && <span className="docs-reference-type">{type}</span>}
        {defaultValue != null && <span className="docs-reference-default">Default: {defaultValue}</span>}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ReferenceTable({ label, children }: {
  label: string;
  children: ReactNode;
}) {
  return (
    <table className="docs-reference-table">
      <caption className="docs-sr-only">{label}</caption>
      {children}
    </table>
  );
}
