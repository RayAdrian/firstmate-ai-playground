import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DbUnavailableError, isConnectionFailure } from "./errors";
import type { ReadOnlyDatabase } from "./types";

// A fetch that turns network-level failures into DbUnavailableError.
// Note: supabase-js normally folds fetch errors into `{ error }`; wrap queries in `dbRead()`
// (or call `.throwOnError()`) so the DbUnavailableError reaches the error boundary.
const readFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (isConnectionFailure(err)) throw new DbUnavailableError(err);
    throw err;
  }
};

/** Read-only (anon key, RLS SELECT-only) client for server components and route handlers. */
export function getReadClient(): SupabaseClient<ReadOnlyDatabase> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set (see .env.example).");
  }
  return createClient<ReadOnlyDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: readFetch },
    // Fail fast when the DB is down instead of retrying with 1s/2s/4s backoff.
    db: { retry: false },
  });
}
