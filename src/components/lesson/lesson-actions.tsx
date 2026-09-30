"use client";

import { useEffect, useRef } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui";
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
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={hydrated && bookmarked}
      disabled={!hydrated}
      onClick={toggle}
      icon={<Bookmark aria-hidden="true" fill={hydrated && bookmarked ? "currentColor" : "none"} />}
    >
      Bookmark
    </Button>
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
  const root = useRef<HTMLDivElement>(null);
  const focusNext = useRef<"undo" | "mark" | null>(null);

  useEffect(() => {
    const find = (a: string) => root.current?.querySelector<HTMLButtonElement>(`[data-action="${a}"]`);
    if (focusNext.current === "undo" && completed) find("undo")?.focus();
    if (focusNext.current === "mark" && !completed) find("mark")?.focus();
    focusNext.current = null;
  }, [completed]);

  return (
    <div ref={root} className="flex flex-col gap-3 rounded-card bg-surface p-5 sm:flex-row sm:items-center sm:justify-between md:p-6 dark:border dark:border-border">
      <p className="text-lg font-bold text-fg-strong">Done with this lesson?</p>
      {hydrated && completed ? (
        <p className="text-base">
          <span className="font-bold text-success">Completed ✓</span>
          <span aria-hidden="true"> · </span>
          <Button
            data-action="undo"
            variant="ghost"
            size="sm"
            className="underline underline-offset-2"
            onClick={() => {
              focusNext.current = "mark";
              undo();
              announce("Marked not complete");
            }}
          >
            Undo
          </Button>
        </p>
      ) : (
        <Button
          data-action="mark"
          variant="primary"
          disabled={!hydrated}
          className="max-sm:w-full"
          onClick={() => {
            focusNext.current = "undo";
            markComplete();
            announce("Lesson marked complete");
          }}
        >
          Mark complete
        </Button>
      )}
    </div>
  );
}
