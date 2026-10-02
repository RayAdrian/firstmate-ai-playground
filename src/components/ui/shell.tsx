import type { ReactNode } from "react";
import { cn } from "./cn";

/** Page container shared by the notices slot, main and footer (DESIGN.md §5.1). */
export const CONTAINER_CLASS = "mx-auto w-full max-w-[var(--fm-container)] px-4 md:px-6 lg:px-8";

/** First focusable element; visible only on focus. Activating it focuses <main tabindex="-1">. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-canvas focus:px-4 focus:py-2 focus:text-link"
    >
      Skip to content
    </a>
  );
}

/**
 * Slot directly under the header, inside the container, above <main>'s h1 (DESIGN.md §4.11).
 * The shell mounts the client-only progress banners here.
 */
export function GlobalNotices({ children }: { children?: ReactNode }) {
  return (
    <div className={cn(CONTAINER_CLASS, "has-[[role=status],[role=alert]]:pt-4")}>{children}</div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div
        className={cn(
          CONTAINER_CLASS,
          "flex flex-col gap-1 py-8 text-sm text-fg-muted md:flex-row md:justify-between md:gap-4",
        )}
      >
        <p>First Mate AI Playground · internal, runs locally</p>
        <p>Content verified per lesson · News updates daily ~07:00 Manila</p>
      </div>
    </footer>
  );
}
