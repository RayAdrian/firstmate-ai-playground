import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Mate AI Playground",
  description: "Learn Claude Code and Codex CLI, plus a daily AI news digest.",
};

// M0 placeholder shell. WS-A owns this file and replaces it with the real layout/nav.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a href="#main">Skip to content</a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
