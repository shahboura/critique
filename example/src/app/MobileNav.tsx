"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./components/Wordmark";
import { docPages } from "./docs-navigation";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <nav
      className="mobile-nav"
      aria-label="Documentation"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !isOpen) return;
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        toggle.current?.focus();
      }}
    >
      <div className="mobile-nav-header">
        <Link
          href="/"
          aria-label="Agentation home"
          style={{ display: "flex", color: "#E5484D" }}
        >
          <Wordmark />
        </Link>
        <button
          ref={toggle}
          type="button"
          className={`mobile-nav-toggle ${isOpen ? "open" : ""}`}
          onClick={() => setIsOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
          aria-controls={menuId}
        >
          <span className="mobile-nav-icon" aria-hidden="true">
            <span />
            <span />
          </span>
        </button>
      </div>
      <div
        id={menuId}
        className={`mobile-nav-links ${isOpen ? "open" : ""}`}
        aria-hidden={!isOpen}
      >
        <div className="mobile-nav-links-inner">
          {docPages.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`mobile-nav-link ${pathname === link.href ? "active" : ""}`}
              aria-current={pathname === link.href ? "page" : undefined}
              tabIndex={isOpen ? undefined : -1}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
