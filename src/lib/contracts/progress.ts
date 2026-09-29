import { z } from "zod";

/** localStorage key holding the whole progress document (PRD P-1). */
export const PROGRESS_STORAGE_KEY = "fm-playground:v1";
export const PROGRESS_VERSION = 1;

export const toolSchema = z.enum(["claude", "codex"]);
export type Tool = z.infer<typeof toolSchema>;

const isoTimestamp = z.string().datetime({ offset: true });

/**
 * Shape of the persisted state. This is the contract between workstreams.
 * Bookmarks map an id (lesson slug / news item id) to the ISO time it was bookmarked (newest-first sorting).
 */
export const progressStateSchema = z.object({
  version: z.literal(PROGRESS_VERSION),
  lessons: z.record(z.string(), z.object({ completedAt: isoTimestamp })),
  /** checklists[exerciseSlug][itemId] = checked */
  checklists: z.record(z.string(), z.record(z.string(), z.boolean())),
  bookmarks: z.object({
    lessons: z.record(z.string(), isoTimestamp),
    news: z.record(z.string(), isoTimestamp),
  }),
  prefs: z.object({ tool: toolSchema }),
  lastViewed: z.object({ slug: z.string(), at: isoTimestamp }).nullable(),
});
export type ProgressState = z.infer<typeof progressStateSchema>;

export function createEmptyProgress(): ProgressState {
  return {
    version: PROGRESS_VERSION,
    lessons: {},
    checklists: {},
    bookmarks: { lessons: {}, news: {} },
    prefs: { tool: "claude" },
    lastViewed: null,
  };
}
