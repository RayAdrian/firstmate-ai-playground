import { z } from "zod";
import { isUuidV4 } from "./progress";

/**
 * Community reactions (PRD 18), no sign-in. Shared by the migration's tests, the route (R1) and the UI (R1).
 * Nothing here is secret, but `clientId` values are bearer credentials: they never appear in any response.
 */

export const REACTIONS = [
  { key: "worked", emoji: "🙌", label: "Worked for me" },
  { key: "learned", emoji: "💡", label: "Learned something" },
  { key: "saved_time", emoji: "⏱️", label: "Saved me time" },
  { key: "game_changer", emoji: "🔥", label: "Game-changer" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];
export const REACTION_KEYS = REACTIONS.map((r) => r.key) as [ReactionKey, ...ReactionKey[]];
export const reactionKeySchema = z.enum(REACTION_KEYS);

/** Request body cap for `POST /api/community`: larger bodies are refused with 413 before parsing. */
export const COMMUNITY_MAX_BODY_BYTES = 2048;
/** `mine` takes at most this many slugs (the read functions enforce it too). */
export const COMMUNITY_MAX_SLUGS = 100;

export const DISPLAY_NAME_MAX = 40;

/**
 * The display-name rule (CM-4). Applied here and again, identically, by `public.community_clean_name` in SQL;
 * `tests/unit/r0/name-vectors.json` runs through both and asserts the same output.
 *
 *  1. strip C0 and C1 controls, bidi embedding/override/isolate characters (U+202A-202E, U+2066-2069) and the
 *     zero-width and format characters (U+200B-200F, U+2060, U+FEFF);
 *  2. collapse runs of whitespace (a fixed list, not `\s`, so JS and Postgres agree) to one space;
 *  3. trim;
 *  4. empty becomes null (anonymous); more than 40 characters (code points) is invalid.
 */
const STRIP = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g;
const WHITESPACE = /[ \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

export type NormalizedName = { ok: true; value: string | null } | { ok: false; reason: "too_long" };

export function normalizeDisplayName(input: string): NormalizedName {
  const cleaned = input.replace(STRIP, "").replace(WHITESPACE, " ").replace(/^ | $/g, "");
  if (cleaned === "") return { ok: true, value: null };
  if ([...cleaned].length > DISPLAY_NAME_MAX) return { ok: false, reason: "too_long" };
  return { ok: true, value: cleaned };
}

const clientIdSchema = z.string().refine(isUuidV4, "clientId must be a UUID v4");
const slugSchema = z
  .string()
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a workflow slug");
/** The raw name as typed. The database applies `normalizeDisplayName` again and is the authority. */
const rawNameSchema = z.string().max(200).nullable();

/** `POST /api/community` body (CM-8). Strict: unknown keys are rejected. One database function per request. */
export const communityRequestSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("star"), clientId: clientIdSchema, slug: slugSchema, on: z.boolean() }),
  z.strictObject({
    op: z.literal("react"),
    clientId: clientIdSchema,
    slug: slugSchema,
    reaction: reactionKeySchema,
    on: z.boolean(),
    displayName: rawNameSchema.optional(),
  }),
  z.strictObject({ op: z.literal("name"), clientId: clientIdSchema, displayName: rawNameSchema }),
  z.strictObject({
    op: z.literal("mine"),
    clientId: clientIdSchema,
    slugs: z.array(slugSchema).max(COMMUNITY_MAX_SLUGS),
  }),
  z.strictObject({ op: z.literal("myStars"), clientId: clientIdSchema }),
]);
export type CommunityRequest = z.infer<typeof communityRequestSchema>;

/** Error codes the route returns (and the database raises). Never carries the input. */
export const communityErrorCodeSchema = z.enum([
  "invalid_request",
  "forbidden",
  "payload_too_large",
  "unsupported_media_type",
  "workflow_unavailable",
  "rate_limited",
  "unavailable",
]);
export type CommunityErrorCode = z.infer<typeof communityErrorCodeSchema>;

export const communityErrorSchema = z.object({ error: communityErrorCodeSchema });

/** One row of `community_summary`. No client_id, ever. */
export const communitySummarySchema = z.object({
  slug: z.string(),
  stars: z.number().int().nonnegative(),
  reactions: z.object(
    Object.fromEntries(
      REACTION_KEYS.map((k) => [k, z.object({ count: z.number().int().nonnegative(), names: z.array(z.string()).max(2) })]),
    ) as Record<ReactionKey, z.ZodObject<{ count: z.ZodNumber; names: z.ZodArray<z.ZodString> }>>,
  ),
});
export type CommunitySummary = z.infer<typeof communitySummarySchema>;

/** One row of `community_mine`: the caller's own booleans. */
export const communityMineSchema = z.object({
  slug: z.string(),
  starred: z.boolean(),
  reactions: z.array(reactionKeySchema),
});
export type CommunityMine = z.infer<typeof communityMineSchema>;

/** One row of `community_my_stars`, newest first. `removed` workflows show "Workflow no longer available". */
export const communityMyStarSchema = z.object({
  slug: z.string(),
  removed: z.boolean(),
});
export type CommunityMyStar = z.infer<typeof communityMyStarSchema>;

export const communityResponseSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(true), mine: z.array(communityMineSchema) }),
  z.object({ ok: z.literal(true), stars: z.array(communityMyStarSchema) }),
]);
export type CommunityResponse = z.infer<typeof communityResponseSchema>;
