import {
  communityRequestSchema,
  normalizeDisplayName,
  type CommunityErrorCode,
  type CommunityResponse,
} from "@/lib/contracts";
import { clientIp, createIpLimiter, isJsonContentType, isSameOrigin, readCappedText } from "@/lib/community/request";
import {
  CommunityError,
  readMine,
  readMyStars,
  writeName,
  writeReaction,
  writeStar,
} from "@/lib/community/server";

/**
 * POST /api/community (PRD 18.5 CM-8, CM-9). One narrow route: same-origin JSON only, 2 KB cap, a strict zod body, one
 * database function per request. Writes use the `community_writer` credential; reads use the anon client.
 * Every response is JSON and carries only the function's result or an error code, never the input.
 */
export const dynamic = "force-dynamic";

const STATUS: Record<CommunityErrorCode, number> = {
  invalid_request: 400,
  forbidden: 403,
  workflow_unavailable: 404,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  unavailable: 503,
};

function fail(code: CommunityErrorCode): Response {
  return Response.json({ error: code }, { status: STATUS[code], headers: { "Cache-Control": "no-store" } });
}

function ok(body: CommunityResponse): Response {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

/** Per-IP velocity (CM-9: 120 requests per minute), best effort per instance. Skipped outside production. */
const ipLimiter = createIpLimiter(120, 60_000);

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request.headers)) return fail("forbidden");
  if (!isJsonContentType(request.headers)) return fail("unsupported_media_type");
  if (process.env.NODE_ENV === "production" && !ipLimiter.allow(clientIp(request.headers))) return fail("rate_limited");

  const text = await readCappedText(request);
  if (text === null) return fail("payload_too_large");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail("invalid_request");
  }
  const parsed = communityRequestSchema.safeParse(json);
  if (!parsed.success) return fail("invalid_request");
  const req = parsed.data;

  try {
    switch (req.op) {
      case "star":
        await writeStar(req.slug, req.clientId, req.on);
        return ok({ ok: true });
      case "react": {
        const name = normalizeDisplayName(req.displayName ?? "");
        if (!name.ok) return fail("invalid_request");
        await writeReaction(req.slug, req.clientId, req.reaction, req.on, name.value);
        return ok({ ok: true });
      }
      case "name": {
        const name = normalizeDisplayName(req.displayName ?? "");
        if (!name.ok) return fail("invalid_request");
        await writeName(req.clientId, name.value);
        return ok({ ok: true });
      }
      case "mine":
        return ok({ ok: true, mine: await readMine(req.clientId, req.slugs) });
      case "myStars":
        return ok({ ok: true, stars: await readMyStars(req.clientId) });
    }
  } catch (err) {
    return fail(err instanceof CommunityError ? err.code : "unavailable");
  }
}
