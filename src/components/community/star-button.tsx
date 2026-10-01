"use client";

import { Star } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useCommunityEntry } from "@/lib/community/hooks";
import { starsLabel } from "@/lib/community/format";
import { displayCount, press } from "@/lib/community/store";

export const CLOSED_NOTE_ID = "reactions-closed-note";

/**
 * The Star toggle (PRD 18.5 CM-1, DESIGN 4.13.1). On a card it is the only interactive thing inside the stretched link;
 * on the workflow page it is a separate control in the header, never part of the Reactions group.
 * Server HTML and the first client render are "unpressed, aria-disabled" (P-5, CM-6); `mine` then sets the real state.
 */
export function StarButton({
  slug,
  title,
  stars,
  variant,
  closed = false,
}: {
  slug: string;
  title: string;
  /** The server-rendered star count. */
  stars: number;
  variant: "card" | "page";
  /** Archived workflow (CM-11): counts stay, the control is disabled. */
  closed?: boolean;
}) {
  const entry = useCommunityEntry(slug);
  const count = displayCount(stars, entry.star);
  const pressed = entry.star.desired;
  const disabled = !entry.loaded || closed;
  const name = variant === "card" ? `Star ${title}, ${starsLabel(count)}` : `Star, ${starsLabel(count)}`;
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      aria-describedby={closed && variant === "page" ? CLOSED_NOTE_ID : undefined}
      data-community="star"
      onClick={(e) => {
        if (disabled) return;
        press(slug, "star", e.currentTarget);
      }}
      className={cn(
        "group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-canvas text-sm font-medium transition-colors duration-[var(--fm-duration-fast)] hover:bg-surface",
        "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2",
        variant === "card"
          ? "relative z-10 h-9 min-w-11 px-3 touch:h-11"
          : "h-11 min-w-11 px-3 md:px-4",
        pressed ? "text-fg-strong" : "text-fg-muted",
        closed ? "cursor-not-allowed opacity-60" : !entry.loaded ? "cursor-progress" : "",
      )}
    >
      <Star
        aria-hidden="true"
        className={cn(
          "size-4 transition-transform duration-[var(--fm-duration-fast)] motion-safe:group-active:scale-[1.15]",
          pressed ? "fill-current text-link" : "",
        )}
      />
      {variant === "page" ? <span className="hidden md:inline">Star</span> : null}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
