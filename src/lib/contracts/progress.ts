import { z } from "zod";

/** localStorage key holding the whole progress document (PRD P-1). */
export const PROGRESS_STORAGE_KEY = "fm-playground:v1";
/**
 * Version 2 (PRD 18.3) adds `community`. The key string stays `fm-playground:v1`: the key name is not the version.
 * A stored doc with a HIGHER version is never reset or rewritten (the store goes read-only).
 */
export const PROGRESS_VERSION = 2;

export const toolSchema = z.enum(["claude", "codex"]);
export type Tool = z.infer<typeof toolSchema>;

const isoTimestamp = z.string().datetime({ offset: true });

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

/**
 * A random UUID v4. `crypto.randomUUID()` only exists in secure contexts, so over http on a LAN IP
 * (phone testing) it is built from `crypto.getRandomValues`.
 */
export function newClientId(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Anonymous community identity (PRD 18.3). The `clientId` is a bearer credential for this browser's stars and
 * reactions: it is never shown, never logged, never exported and never imported.
 */
export const communitySchema = z.object({
  clientId: z.string().refine(isUuidV4, "clientId must be a UUID v4"),
  displayName: z.string().max(40).nullable(),
  namePrompted: z.boolean(),
});
export type Community = z.infer<typeof communitySchema>;

export function createCommunity(clientId: string = newClientId()): Community {
  return { clientId, displayName: null, namePrompted: false };
}

/** Fixed stand-in used before hydration and for imported docs (the store keeps the browser's own `community`). */
export const PLACEHOLDER_CLIENT_ID = "00000000-0000-4000-8000-000000000000";

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
  community: communitySchema,
});
export type ProgressState = z.infer<typeof progressStateSchema>;

/** A fresh document. Pass `clientId` to keep an identity the caller already holds. */
export function createEmptyProgress(clientId?: string): ProgressState {
  return {
    version: PROGRESS_VERSION,
    lessons: {},
    checklists: {},
    bookmarks: { lessons: {}, news: {} },
    prefs: { tool: "claude" },
    lastViewed: null,
    community: createCommunity(clientId),
  };
}
