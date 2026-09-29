// Safe to import from client components (no server-only, no secrets).

/** Exact PRD §9 wording for the app-wide "database is down" state. */
export const DB_UNAVAILABLE_MESSAGE =
  "Can't reach the local database. Run `supabase start` then `npm run seed`.";

/** The command shown with a copy button next to DB_UNAVAILABLE_MESSAGE. */
export const DB_UNAVAILABLE_COMMAND = "supabase start && npm run seed";

/**
 * Next.js replaces server error messages with a generic one in production but
 * keeps `error.digest`. A string digest set on the error is passed through,
 * so this value survives into the client error boundary.
 */
export const DB_UNAVAILABLE_DIGEST = "DB_UNAVAILABLE";

export class DbUnavailableError extends Error {
  readonly digest = DB_UNAVAILABLE_DIGEST;

  constructor(cause?: unknown) {
    super(DB_UNAVAILABLE_MESSAGE, cause === undefined ? undefined : { cause });
    this.name = "DbUnavailableError";
  }
}

/** True for a DbUnavailableError, including one that crossed the server/client boundary. */
export function isDbUnavailable(err: unknown): boolean {
  if (err instanceof DbUnavailableError) return true;
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: unknown; digest?: unknown };
  return e.name === "DbUnavailableError" || e.digest === DB_UNAVAILABLE_DIGEST;
}

const CONNECTION_PATTERN =
  /ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|fetch failed|Failed to fetch|Invalid URL/i;

/** Heuristic for a network-level failure (as opposed to a query error from Postgres). */
export function isConnectionFailure(err: unknown): boolean {
  if (isDbUnavailable(err)) return true;
  if (typeof err !== "object" || err === null) return false;
  const e = err as { message?: unknown; details?: unknown; code?: unknown; cause?: unknown };
  const text = [e.message, e.details, e.code].filter((v) => typeof v === "string").join(" ");
  return CONNECTION_PATTERN.test(text) || (e.cause !== undefined && isConnectionFailure(e.cause));
}

type QueryResult<T> = { data: T | null; error: { message: string } | null };

/**
 * Await a supabase-js query and return its data. Throws DbUnavailableError on a
 * connection failure, and a plain Error for any other query error.
 */
export async function dbRead<T>(query: PromiseLike<QueryResult<T>>): Promise<T> {
  let res: QueryResult<T>;
  try {
    res = await query;
  } catch (err) {
    if (isConnectionFailure(err)) throw new DbUnavailableError(err);
    throw err;
  }
  if (res.error) {
    if (isConnectionFailure(res.error)) throw new DbUnavailableError(res.error);
    throw new Error(`Database query failed: ${res.error.message}`);
  }
  return res.data as T;
}
