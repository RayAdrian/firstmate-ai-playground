"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ProgressState, Tool } from "@/lib/contracts";
import {
  addBookmark,
  isBookmarked,
  markComplete,
  removeBookmark,
  setLastViewed,
  setToolPref,
  toggleBookmark,
  toggleChecklistItem,
  undoComplete,
  type BookmarkKind,
} from "./reducers";
import { checklistFor, countCompleted, sortedBookmarks, type BookmarkEntry } from "./selectors";
import {
  dismissCorruptNotice,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  updateProgress,
  type ProgressSnapshot,
} from "./store";

/**
 * Hydration-safe hooks over the progress store. Until `hydrated` is true (server render and
 * the first client render) they report empty values: gate any "not started" / "0 / n" UI on
 * `hydrated` and render a neutral placeholder instead.
 */

export function useProgressSnapshot(): ProgressSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The whole document. Prefer the focused hooks below. */
export function useProgressState(): { hydrated: boolean; state: ProgressState } {
  const { hydrated, state } = useProgressSnapshot();
  return { hydrated, state };
}

/** Storage banner (P-3) and corruption notice (P-2) state. */
export function useProgressStatus(): {
  hydrated: boolean;
  storageAvailable: boolean;
  corruptNotice: boolean;
  dismissCorruptNotice: () => void;
} {
  const { hydrated, storageAvailable, corruptNotice } = useProgressSnapshot();
  return { hydrated, storageAvailable, corruptNotice, dismissCorruptNotice };
}

/** One lesson's completion, with undo (L-5). */
export function useLessonCompletion(slug: string): {
  hydrated: boolean;
  completed: boolean;
  completedAt: string | null;
  markComplete: () => void;
  undo: () => void;
} {
  const { hydrated, state } = useProgressSnapshot();
  const entry = Object.hasOwn(state.lessons, slug) ? state.lessons[slug] : undefined;
  const complete = useCallback(() => updateProgress((s) => markComplete(s, slug)), [slug]);
  const undo = useCallback(() => updateProgress((s) => undoComplete(s, slug)), [slug]);
  return {
    hydrated,
    completed: entry !== undefined,
    completedAt: entry?.completedAt ?? null,
    markComplete: complete,
    undo,
  };
}

/** Completion counts for a set of lessons (a level card, the curriculum list, the home page). */
export function useLessonsProgress(slugs: readonly string[]): {
  hydrated: boolean;
  completedCount: number;
  total: number;
  isComplete: (slug: string) => boolean;
} {
  const { hydrated, state } = useProgressSnapshot();
  const key = slugs.join("\n");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the stable identity of `slugs`
  const completedCount = useMemo(() => countCompleted(state, slugs), [state, key]);
  const isComplete = useCallback((slug: string) => Object.hasOwn(state.lessons, slug), [state]);
  return { hydrated, completedCount, total: new Set(slugs).size, isComplete };
}

/**
 * An exercise's checklist (E-2). `itemIds` are the ids the exercise currently defines:
 * stored ids not in the list (orphans) are ignored and preserved.
 */
export function useChecklist(
  exerciseSlug: string,
  itemIds: readonly string[],
): {
  hydrated: boolean;
  checked: Readonly<Record<string, boolean>>;
  doneCount: number;
  total: number;
  allDone: boolean;
  setChecked: (itemId: string, checked: boolean) => void;
} {
  const { hydrated, state } = useProgressSnapshot();
  const key = itemIds.join("\n");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the stable identity of `itemIds`
  const checked = useMemo(() => checklistFor(state, exerciseSlug, itemIds), [state, exerciseSlug, key]);
  const setChecked = useCallback(
    (itemId: string, value: boolean) =>
      updateProgress((s) => toggleChecklistItem(s, exerciseSlug, itemId, value)),
    [exerciseSlug],
  );
  const total = Object.keys(checked).length;
  const doneCount = Object.values(checked).filter(Boolean).length;
  return { hydrated, checked, doneCount, total, allDone: total > 0 && doneCount === total, setChecked };
}

/** Bookmark state for one lesson (`kind: "lessons"`, id = slug) or news item (`"news"`, id = item id). */
export function useBookmark(
  kind: BookmarkKind,
  id: string,
): {
  hydrated: boolean;
  bookmarked: boolean;
  bookmarkedAt: string | null;
  toggle: () => void;
  add: () => void;
  remove: () => void;
} {
  const { hydrated, state } = useProgressSnapshot();
  const bookmarked = isBookmarked(state, kind, id);
  const toggle = useCallback(() => updateProgress((s) => toggleBookmark(s, kind, id)), [kind, id]);
  const add = useCallback(() => updateProgress((s) => addBookmark(s, kind, id)), [kind, id]);
  const remove = useCallback(() => updateProgress((s) => removeBookmark(s, kind, id)), [kind, id]);
  return {
    hydrated,
    bookmarked,
    bookmarkedAt: bookmarked ? state.bookmarks[kind][id] : null,
    toggle,
    add,
    remove,
  };
}

/** All bookmarks, newest first, including ids that no longer exist in the DB. */
export function useBookmarks(): {
  hydrated: boolean;
  lessons: BookmarkEntry[];
  news: BookmarkEntry[];
  /** Re-add with the original timestamp (Undo). */
  restore: (kind: BookmarkKind, id: string, at: string) => void;
  remove: (kind: BookmarkKind, id: string) => void;
} {
  const { hydrated, state } = useProgressSnapshot();
  const lessons = useMemo(() => sortedBookmarks(state, "lessons"), [state]);
  const news = useMemo(() => sortedBookmarks(state, "news"), [state]);
  const restore = useCallback(
    (kind: BookmarkKind, id: string, at: string) => updateProgress((s) => addBookmark(s, kind, id, at)),
    [],
  );
  const remove = useCallback(
    (kind: BookmarkKind, id: string) => updateProgress((s) => removeBookmark(s, kind, id)),
    [],
  );
  return { hydrated, lessons, news, restore, remove };
}

/**
 * The remembered tool tab (L-2.3). `tool` is "claude" until `hydrated`; consumers should
 * wait for `hydrated` before applying it. An explicit `?tool=` in the URL wins (WS-C's rule).
 */
export function useToolPref(): {
  hydrated: boolean;
  tool: Tool;
  setTool: (tool: Tool) => void;
} {
  const { hydrated, state } = useProgressSnapshot();
  const setTool = useCallback((tool: Tool) => updateProgress((s) => setToolPref(s, tool)), []);
  return { hydrated, tool: state.prefs.tool, setTool };
}

/**
 * Record `slug` as the last viewed lesson once hydrated (call from the lesson page).
 * Writes once per mount or slug change, driven only by this tab's own navigation: it never
 * reacts to what other tabs store, so two open lesson tabs cannot overwrite each other.
 */
export function useTrackLastViewed(slug: string): void {
  const { hydrated } = useProgressSnapshot();
  const written = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || written.current === slug) return;
    written.current = slug;
    updateProgress((s) => (s.lastViewed?.slug === slug ? s : setLastViewed(s, slug)));
  }, [hydrated, slug]);
}

/** The last viewed lesson, for the Continue CTA (C-4). */
export function useLastViewed(): {
  hydrated: boolean;
  lastViewed: ProgressState["lastViewed"];
  setLastViewed: (slug: string) => void;
} {
  const { hydrated, state } = useProgressSnapshot();
  const set = useCallback((slug: string) => updateProgress((s) => setLastViewed(s, slug)), []);
  return { hydrated, lastViewed: state.lastViewed, setLastViewed: set };
}
