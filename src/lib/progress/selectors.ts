import type { ProgressState } from "@/lib/contracts";
import type { BookmarkKind } from "./reducers";

const has = (obj: object, key: string): boolean => Object.hasOwn(obj, key);

export function isLessonComplete(state: ProgressState, slug: string): boolean {
  return has(state.lessons, slug);
}

/** Completed lessons among `slugs`. Stored slugs not in `slugs` (deleted/archived) are ignored (P-4). */
export function countCompleted(state: ProgressState, slugs: readonly string[]): number {
  let n = 0;
  for (const slug of new Set(slugs)) if (has(state.lessons, slug)) n += 1;
  return n;
}

/** Checked map limited to the item ids the exercise currently defines; orphan ids are ignored (P-4). */
export function checklistFor(
  state: ProgressState,
  exerciseSlug: string,
  itemIds: readonly string[],
): Record<string, boolean> {
  const stored = has(state.checklists, exerciseSlug) ? state.checklists[exerciseSlug] : {};
  const out: Record<string, boolean> = {};
  for (const id of itemIds) out[id] = has(stored, id) && stored[id] === true;
  return out;
}

export type BookmarkEntry = { id: string; at: string };

/** Newest bookmarked first; ties broken by id for a stable order. */
export function sortedBookmarks(state: ProgressState, kind: BookmarkKind): BookmarkEntry[] {
  return Object.entries(state.bookmarks[kind])
    .map(([id, at]) => ({ id, at }))
    .sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? 1 : -1));
}

export type ProgressCounts = {
  lessons: number;
  checklistItems: number;
  bookmarks: number;
};

/** Counts for the /progress summary. With `knownLessonSlugs`, orphan lessons and lesson bookmarks are excluded. */
export function summarize(
  state: ProgressState,
  knownLessonSlugs?: readonly string[],
): ProgressCounts {
  const known = knownLessonSlugs ? new Set(knownLessonSlugs) : null;
  const inKnown = (slug: string) => known === null || known.has(slug);
  return {
    lessons: Object.keys(state.lessons).filter(inKnown).length,
    checklistItems: Object.values(state.checklists).reduce(
      (sum, items) => sum + Object.values(items).filter(Boolean).length,
      0,
    ),
    bookmarks:
      Object.keys(state.bookmarks.lessons).filter(inKnown).length +
      Object.keys(state.bookmarks.news).length,
  };
}

/** What an export/import file contains, as-is (unknown ids counted). */
export function countFileContents(state: ProgressState): { lessons: number; bookmarks: number } {
  return {
    lessons: Object.keys(state.lessons).length,
    bookmarks:
      Object.keys(state.bookmarks.lessons).length + Object.keys(state.bookmarks.news).length,
  };
}
