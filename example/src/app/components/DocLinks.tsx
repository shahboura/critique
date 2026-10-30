import Link from "next/link";

export function DocLinks({ links }: {
  links: readonly { href: string; label: string }[];
}) {
  return (
    <nav className="docs-links" aria-label="Related documentation">
      {links.map(({ href, label }) => (
        <Link key={href} href={href}>
          <span>{label}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ))}
    </nav>
  );
}
