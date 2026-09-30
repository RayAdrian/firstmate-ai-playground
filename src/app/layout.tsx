import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ProgressNotices } from "@/lib/progress";
import { CONTAINER_CLASS, GlobalNotices, LiveRegion, SiteFooter, SiteHeader, SkipLink, cn } from "@/components/ui";

// Satoshi, self-hosted (DESIGN.md §1.2, §2.6). next/font/local adds the metric-adjusted fallback (CLS < 0.05).
const satoshi = localFont({
  src: [
    { path: "../../public/fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Satoshi-Italic.woff2", weight: "400", style: "italic" },
    { path: "../../public/fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "First Mate AI Playground",
  description: "Learn Claude Code and Codex CLI, plus a daily AI news digest.",
};

// The shell is static: it never reads the database, so the route error boundary can always render inside it.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={satoshi.variable}>
      <body className="flex min-h-dvh flex-col">
        <SkipLink />
        <SiteHeader />
        <GlobalNotices>
          <ProgressNotices />
        </GlobalNotices>
        <main id="main" tabIndex={-1} className={cn(CONTAINER_CLASS, "flex-1 pt-8 pb-16 md:pt-12")}>
          {children}
        </main>
        <SiteFooter />
        <LiveRegion />
      </body>
    </html>
  );
}
