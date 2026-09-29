/** Destructive resets may only target a local Supabase. Throws otherwise, before any network write. */
export function assertLocalSupabase(url: string | undefined): void {
  if (!url) throw new Error("SUPABASE_URL is not set (see .env.example).");
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("SUPABASE_URL is not a valid URL; db:reset:test only runs against a local (127.0.0.1 or localhost) Supabase.");
  }
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]") {
    throw new Error("db:reset:test only runs against a local (127.0.0.1 or localhost) Supabase; refusing to touch a hosted database.");
  }
}
