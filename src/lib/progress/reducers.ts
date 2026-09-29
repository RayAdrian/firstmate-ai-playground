import { createEmptyProgress, toolSchema, type ProgressState } from "@/lib/contracts";

/**
 * Pure state transitions. Every reducer returns the same object when nothing changes,
 * never mutates its input, and takes `now` (an ISO string) so it stays deterministic.
 */

export type BookmarkKind = "lessons" | "news";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSafeKey(key: string): boolean {
  return key.length > 0 && !FORBIDDEN_KEYS.has(key);
}

const has = (obj: object, key: string): boolean => Object.hasOwn(obj, key);

function nowIso(): string {
  return new Date().toISOString();
}

export function emptyState(): ProgressState {
  return createEmptyProgress();
}

/** Idempotent: an already-completed lesson keeps its first completedAt. */
export function markComplete(
  state: ProgressState,
  slug: string,
  now: string = nowIso(),
): ProgressState {
  if (!isSafeKey(slug) || has(state.lessons, slug)) return state;
  return { ...state, lessons: { ...state.lessons, [slug]: { completedAt: now } } };
}

/** Removes the lesson entry entirely. */
export function undoComplete(state: ProgressState, slug: string): ProgressState {
  if (!has(state.lessons, slug)) return state;
  const rest = Object.fromEntries(Object.entries(state.lessons).filter(([key]) => key !== slug));
  return { ...state, lessons: rest };
}

/** Checked stores `true`; unchecked removes the key (and the exercise map once empty). */
export function toggleChecklistItem(
  state: ProgressState,
  exerciseSlug: string,
  itemId: string,
  checked: boolean,
): ProgressState {
  if (!isSafeKey(exerciseSlug) || !isSafeKey(itemId)) return state;
  const current = has(state.checklists, exerciseSlug) ? state.checklists[exerciseSlug] : {};
  const isChecked = has(current, itemId) && current[itemId] === true;
  if (checked === isChecked) return state;
  if (checked) {
    return {
      ...state,
      checklists: { ...state.checklists, [exerciseSlug]: { ...current, [itemId]: true } },
    };
  }
  const items = Object.fromEntries(Object.entries(current).filter(([key]) => key !== itemId));
  const others = Object.fromEntries(
    Object.entries(state.checklists).filter(([key]) => key !== exerciseSlug),
  );
  return {
    ...state,
    checklists: Object.keys(items).length === 0 ? others : { ...others, [exerciseSlug]: items },
  };
}

export function isBookmarked(state: ProgressState, kind: BookmarkKind, id: string): boolean {
  return has(state.bookmarks[kind], id);
}

/** Adds a bookmark. `at` lets Undo restore the original timestamp. No-op when already present. */
export function addBookmark(
  state: ProgressState,
  kind: BookmarkKind,
  id: string,
  at: string = nowIso(),
): ProgressState {
  if (!isSafeKey(id) || has(state.bookmarks[kind], id)) return state;
  return {
    ...state,
    bookmarks: { ...state.bookmarks, [kind]: { ...state.bookmarks[kind], [id]: at } },
  };
}

export function removeBookmark(
  state: ProgressState,
  kind: BookmarkKind,
  id: string,
): ProgressState {
  if (!has(state.bookmarks[kind], id)) return state;
  const rest = Object.fromEntries(
    Object.entries(state.bookmarks[kind]).filter(([key]) => key !== id),
  );
  return { ...state, bookmarks: { ...state.bookmarks, [kind]: rest } };
}

export function toggleBookmark(
  state: ProgressState,
  kind: BookmarkKind,
  id: string,
  now: string = nowIso(),
): ProgressState {
  return isBookmarked(state, kind, id)
    ? removeBookmark(state, kind, id)
    : addBookmark(state, kind, id, now);
}

/** Only "claude" and "codex" are accepted; anything else leaves the state unchanged. */
export function setToolPref(state: ProgressState, tool: string): ProgressState {
  const parsed = toolSchema.safeParse(tool);
  if (!parsed.success || state.prefs.tool === parsed.data) return state;
  return { ...state, prefs: { ...state.prefs, tool: parsed.data } };
}

export function setLastViewed(
  state: ProgressState,
  slug: string,
  now: string = nowIso(),
): ProgressState {
  if (!isSafeKey(slug)) return state;
  return { ...state, lastViewed: { slug, at: now } };
}
