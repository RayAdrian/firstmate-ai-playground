// Service-role client. SCRIPTS ONLY (seed, news pipeline, fixtures).
// Never import this from src/app or any component; ESLint enforces it.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function getServiceClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
