import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ReadOnlyDatabase } from "./types";

/** Read-only (anon key, RLS SELECT-only) client for server components and route handlers. */
export function getReadClient(): SupabaseClient<ReadOnlyDatabase> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set (see .env.example).");
  }
  return createClient<ReadOnlyDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
