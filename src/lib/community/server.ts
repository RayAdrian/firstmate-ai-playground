import "server-only";
import { Pool } from "pg";
import { z } from "zod";
import {
  COMMUNITY_MAX_SLUGS,
  communityMineSchema,
  communityMyStarSchema,
  communitySummarySchema,
  type CommunityErrorCode,
  type CommunityMine,
  type CommunityMyStar,
  type CommunitySummary,
  type ReactionKey,
} from "@/lib/contracts";
import { getReadClient } from "@/lib/db/server";

/**
 * Server side of the community feature (PRD 18.4).
 *  - Writes go ONLY through the `community_writer` Postgres role (`COMMUNITY_DATABASE_URL`, server-only), which can execute
 *    the three SECURITY DEFINER write functions and nothing else. The service-role key is never used here.
 *  - Reads go through the existing read-only anon client and the three read functions. No read returns a client id.
 */

/** A failure the route turns into an error code. Never carries the input. */
export class CommunityError extends Error {
  constructor(readonly code: CommunityErrorCode) {
    super(code);
    this.name = "CommunityError";
  }
}

/** SQLSTATEs the migration raises (CM001 workflow, CM002 rate limit, CM003 invalid input). */
export function codeForPgError(err: unknown): CommunityErrorCode {
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  if (code === "CM001") return "workflow_unavailable";
  if (code === "CM002") return "rate_limited";
  if (code === "CM003") return "invalid_request";
  return "unavailable";
}

const globalForPool = globalThis as unknown as { __fmCommunityPool?: Pool };

function writerPool(): Pool {
  const url = process.env.COMMUNITY_DATABASE_URL;
  if (!url) throw new CommunityError("unavailable");
  if (!globalForPool.__fmCommunityPool) {
    // Lazy and small: `next build` runs many workers and each would open its own pool (it only connects on first use).
    const pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 4_000 });
    pool.on("error", () => undefined); // an idle client dropped by the server must not crash the process
    globalForPool.__fmCommunityPool = pool;
  }
  return globalForPool.__fmCommunityPool;
}

async function callWriter(sql: string, params: unknown[]): Promise<void> {
  try {
    await writerPool().query(sql, params);
  } catch (err) {
    if (err instanceof CommunityError) throw err;
    throw new CommunityError(codeForPgError(err));
  }
}

export const writeStar = (slug: string, clientId: string, on: boolean) =>
  callWriter("select public.community_set_star($1, $2, $3)", [slug, clientId, on]);

export const writeReaction = (slug: string, clientId: string, reaction: ReactionKey, on: boolean, name: string | null) =>
  callWriter("select public.community_set_reaction($1, $2, $3, $4, $5)", [slug, clientId, reaction, on, name]);

export const writeName = (clientId: string, name: string | null) =>
  callWriter("select public.community_set_name($1, $2)", [clientId, name]);

type RpcResult = PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
type Rpc = { rpc(fn: string, args: Record<string, unknown>): RpcResult };

async function rpcRows<T>(fn: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T[]> {
  let res: Awaited<RpcResult>;
  try {
    res = await (getReadClient() as unknown as Rpc).rpc(fn, args);
  } catch {
    throw new CommunityError("unavailable");
  }
  if (res.error) throw new CommunityError(res.error.code === "CM003" ? "invalid_request" : "unavailable");
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.flatMap((r) => {
    const parsed = schema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}

export const readMine = (clientId: string, slugs: string[]): Promise<CommunityMine[]> =>
  rpcRows("community_mine", { p_client_id: clientId, p_slugs: slugs }, communityMineSchema);

export const readMyStars = (clientId: string): Promise<CommunityMyStar[]> =>
  rpcRows("community_my_stars", { p_client_id: clientId }, communityMyStarSchema);

const summaryRowSchema = communitySummarySchema;

/**
 * Star counts, reaction counts and the 2 most recent names per reaction, for server-rendering. Returns null when the
 * community read fails: the page then renders without the community UI and without an error (PRD 18.7).
 */
export async function getCommunitySummaries(slugs: readonly string[]): Promise<Map<string, CommunitySummary> | null> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return new Map();
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += COMMUNITY_MAX_SLUGS) chunks.push(unique.slice(i, i + COMMUNITY_MAX_SLUGS));
    const results = await Promise.all(chunks.map((c) => rpcRows("community_summary", { p_slugs: c }, summaryRowSchema)));
    return new Map(results.flat().map((s) => [s.slug, s]));
  } catch {
    return null;
  }
}
