import { z } from "zod";
import {
  communityErrorSchema,
  communityMineSchema,
  communityMyStarSchema,
  type CommunityErrorCode,
  type CommunityRequest,
} from "@/lib/contracts";

/** The route client (PRD 18.5 CM-8). Browser only: the one place the app talks to the community route. */

export type CommunityFailure = CommunityErrorCode | "network";
export type CommunityOk = {
  mine: z.infer<typeof communityMineSchema>[];
  stars: z.infer<typeof communityMyStarSchema>[];
};
export type CommunityResult = { ok: true; data: CommunityOk } | { ok: false; code: CommunityFailure };

// Not `communityResponseSchema`: its first union member (`{ ok: true }`) strips `mine` and `stars` and always matches.
const okSchema = z.object({
  ok: z.literal(true),
  mine: z.array(communityMineSchema).optional(),
  stars: z.array(communityMyStarSchema).optional(),
});

const TIMEOUT_MS = 8_000;

/**
 * POST one request. Never throws: a network failure, a timeout, a non-JSON reply and an error code all become
 * `{ ok: false }`, so the UI rolls back instead of claiming a save that did not happen. Nothing here is logged.
 */
export async function postCommunity(body: CommunityRequest): Promise<CommunityResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = communityErrorSchema.safeParse(json);
      return { ok: false, code: err.success ? err.data.error : "unavailable" };
    }
    const parsed = okSchema.safeParse(json);
    if (!parsed.success) return { ok: false, code: "unavailable" };
    return { ok: true, data: { mine: parsed.data.mine ?? [], stars: parsed.data.stars ?? [] } };
  } catch {
    return { ok: false, code: "network" };
  } finally {
    clearTimeout(timer);
  }
}
