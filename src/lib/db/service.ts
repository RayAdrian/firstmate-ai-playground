// Service-role client. SCRIPTS ONLY (seed, news pipeline, fixtures).
// Never import this from src/app or any component; ESLint enforces it.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describeTarget } from "../../../scripts/lib/env-profile";
import type { Database } from "./types";

let announced = false;

/** Print `<npm script> → <host>` once per process, so a run against the hosted project is never a surprise (PRD 18.8 DP-5). */
function announceTarget(): void {
  if (announced) return;
  announced = true;
  console.error(describeTarget(process.env.npm_lifecycle_event ?? "script"));
}

export function getServiceClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  }
  announceTarget();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
