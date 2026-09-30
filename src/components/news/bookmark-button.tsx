"use client";

// Client boundary: the only part of a news card that needs browser state (localStorage bookmarks).
import { Bookmark, BookmarkCheck } from "lucide-react";
import { announce } from "@/components/ui/live-region";
import { useBookmark } from "@/lib/progress";

export function BookmarkButton({ id, title }: { id: string; title: string }) {
  const { hydrated, bookmarked, toggle } = useBookmark("news", id);
  // Server HTML and the first client render are always "unpressed, disabled" (P-5).
  const pressed = hydrated && bookmarked;
  const Icon = pressed ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      aria-label={`Bookmark: ${title}`}
      aria-pressed={pressed}
      aria-disabled={hydrated ? undefined : true}
      onClick={() => {
        if (!hydrated) return;
        if (bookmarked) announce("Removed from bookmarks");
        toggle();
      }}
      className={`relative z-10 inline-flex size-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full self-start justify-self-end [grid-area:bookmark] touch:size-11 hover:bg-border-subtle ${
        pressed ? "text-link" : "text-fg-muted"
      } ${hydrated ? "" : "cursor-not-allowed opacity-50"}`}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}
