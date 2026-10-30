"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DocHeader } from "./components/Documentation";
import { DocLinks } from "./components/DocLinks";
import { docsNavigation } from "./docs-navigation";

export default function NotFound() {
  const pathname = usePathname();
  // The exported 404 is shared by every missing URL. Read its actual path after
  // hydration so the static fallback stays valid and a bad link is never echoed.
  const [requestedPath, setRequestedPath] = useState("");
  useEffect(() => setRequestedPath(pathname ?? ""), [pathname]);
  const segments = requestedPath.toLowerCase().split("/").filter(Boolean);
  const suggested = docsNavigation.find(link => "href" in link && link.href !== "/" && segments.includes(link.href.slice(1)));
  const destination = suggested && "href" in suggested ? suggested : { href: "/install", label: "Install" };

  return (
    <article className="article docs-not-found">
      <DocHeader
        title="Page not found"
        description="This link may be out of date, or the address may be incorrect."
      />
      <DocLinks links={[
        { href: "/", label: "Back to overview" },
        { href: destination.href, label: `Go to ${destination.label}` },
      ]} />
    </article>
  );
}
