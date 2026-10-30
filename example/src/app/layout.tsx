import type { Metadata } from "next";
import "./globals.scss";
import "./docs.scss";
import { ToolbarProvider } from "./ToolbarProvider";
import { SideNav } from "./SideNav";
import { MobileNav } from "./MobileNav";
import { MobileNotice } from "./MobileNotice";
import { initializeDownloadCounter } from "./components/download-counter-bootstrap";
import { DOWNLOAD_COUNTER_KEY, parseDownloadCounter, resumeDownloadCounter } from "./components/download-counter";
import { DOWNLOAD_SNAPSHOT } from "./downloads";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentation.com"),
  title: "Agentation",
  description: "The visual feedback tool for agents.",
  openGraph: {
    title: "Agentation",
    description: "The visual feedback tool for agents.",
    images: [
      {
        url: "/og-image.png",
        width: 2400,
        height: 1260,
        alt: "Agentation visual feedback and UI annotations",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentation",
    description: "The visual feedback tool for agents.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(${initializeDownloadCounter.toString()})(${JSON.stringify(DOWNLOAD_COUNTER_KEY)},${DOWNLOAD_SNAPSHOT.downloads},${parseDownloadCounter.toString()},${resumeDownloadCounter.toString()});` }} />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Cascadia+Code:ital@1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <MobileNotice />
        <MobileNav />
        <SideNav />
        <main className="main-content">{children}</main>
        <ToolbarProvider />
      </body>
    </html>
  );
}
