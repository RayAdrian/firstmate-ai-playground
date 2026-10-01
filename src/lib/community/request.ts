import { COMMUNITY_MAX_BODY_BYTES } from "@/lib/contracts";

/** Pure request guards for `POST /api/community` (PRD CM-8, CM-9). Free of Next and pg so they unit-test directly. */

/** `Origin` must be present and its host must equal the request's host. A cross-site form post fails this. */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isJsonContentType(headers: Headers): boolean {
  const type = headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return type === "application/json";
}

/**
 * The caller's IP, only ever from a header the platform sets: `x-real-ip`, else the first entry of `x-forwarded-for`.
 * Never from the body or any other client-supplied value.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export type IpLimiter = { allow(ip: string, now?: number): boolean };

/** Fixed-window per-IP limiter, in memory (best effort per instance, PRD CM-9: 120 requests per minute). */
export function createIpLimiter(limit = 120, windowMs = 60_000, maxEntries = 5_000): IpLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    allow(ip, now = Date.now()) {
      if (hits.size > maxEntries) {
        for (const [key, v] of hits) if (v.resetAt <= now) hits.delete(key);
        if (hits.size > maxEntries) hits.clear();
      }
      const entry = hits.get(ip);
      if (!entry || entry.resetAt <= now) {
        hits.set(ip, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}

/** Read the body as text, giving up as soon as it exceeds the cap (413 before any parsing). null = too large. */
export async function readCappedText(request: Request, cap = COMMUNITY_MAX_BODY_BYTES): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > cap) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}
