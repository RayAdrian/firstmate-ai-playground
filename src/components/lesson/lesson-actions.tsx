"use client";

import { useEffect, useRef } from "react";
import { Bookmark } from "lucide-react";
import { announce, useBookmark, useLessonCompletion, useTrackLastViewed } from "@/lib/progress";
import { CompletedBadge } from "./curriculum-progress";

/** Completion badge in the lesson header. Renders nothing until hydrated and completed. */
export function HeaderCompletion({ slug }: { slug: string }) {
  const { hydrated, completed } = useLessonCompletion(slug);
  return hydrated && completed ? <CompletedBadge /> : null;
}

/** Bookmark toggle (L-8): fixed name "Bookmark", state in aria-pressed and a filled icon. */
export function BookmarkToggle({ slug }: { slug: string }) {
  const { hydrated, bookmarked, toggle } = useBookmark("lessons", slug);
  return (
    <button
      type="button"
      aria-pressed={hydrated && bookmarked}
      disabled={!hydrated}
      onClick={toggle}
      className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-fg hover:bg-surface disabled:opacity-50 touch:min-h-11"
    >
      <Bookmark size={16} aria-hidden="true" fill={hydrated && bookmarked ? "currentColor" : "none"} />
      Bookmark
    </button>
  );
}

/** Records the lesson as last viewed once progress has hydrated (Continue CTA on the home page). */
export function TrackLastViewed({ slug }: { slug: string }) {
  useTrackLastViewed(slug);
  return null;
}

/**
 * "Done with this lesson?" block (L-5). Completing swaps the button for the PRD string
 * "Completed ✓ · Undo" and moves focus to Undo; Undo restores the button and focuses it.
 * Before hydration the button is disabled and claims no state.
 */
export function CompleteBlock({ slug }: { slug: string }) {
  const { hydrated, completed, markComplete, undo } = useLessonCompletion(slug);
  const markRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"undo" | "mark" | null>(null);

  useEffect(() => {
    if (focusNext.current === "undo" && completed) undoRef.current?.focus();
    if (focusNext.current === "mark" && !completed) markRef.current?.focus();
    focusNext.current = null;
  }, [completed]);

  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-5 sm:flex-row sm:items-center sm:justify-between md:p-6 dark:border dark:border-border">
      <p className="text-lg font-bold text-fg-strong">Done with this lesson?</p>
      {hydrated && completed ? (
        <p className="text-base">
          <span className="font-bold text-success">Completed ✓</span>
          <span aria-hidden="true"> · </span>
          <button
            ref={undoRef}
            type="button"
            onClick={() => {
              focusNext.current = "mark";
              undo();
              announce("Marked not complete");
            }}
            className="inline-flex h-9 items-center rounded-xl px-3 font-medium text-fg underline underline-offset-2 hover:bg-canvas touch:min-h-11"
          >
            Undo
          </button>
        </p>
      ) : (
        <button
          ref={markRef}
          type="button"
          disabled={!hydrated}
          onClick={() => {
            focusNext.current = "undo";
            markComplete();
            announce("Lesson marked complete");
          }}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-base font-bold text-primary-fg hover:bg-primary-hover disabled:opacity-50 max-sm:w-full"
        >
          Mark complete
        </button>
      )}
    </div>
  );
}
