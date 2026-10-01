// Env profiles for scripts (PRD 18.8 DP-5). `.env.local` always points at the LOCAL Supabase, so `npm run dev`, tests and
// agents never touch the hosted database. Scripts that must reach the hosted project (seed, news) run with
// `FM_ENV_FILE=.env.hosted.local npm run seed`; that file is gitignored (`.env*.local`) and holds the hosted URL, anon
// key and service-role key for scripts only. Variables already in the real environment win over either file.
import path from "node:path";

export type Env = Readonly<Record<string, string | undefined>>;

/** The env file scripts load: `FM_ENV_FILE` when set (relative to cwd), otherwise `.env.local`. */
export function resolveEnvFile(env: Env = process.env, cwd: string = process.cwd()): string {
  const file = env.FM_ENV_FILE;
  return path.resolve(cwd, file !== undefined && file !== "" ? file : ".env.local");
}

/** The host a script will talk to, for the start-up line. Never includes a key or a path. */
export function targetHost(url: string | undefined): string {
  if (!url) return "(SUPABASE_URL not set)";
  try {
    return new URL(url).hostname;
  } catch {
    return "(invalid SUPABASE_URL)";
  }
}

/** `seed → abcd.supabase.co`: printed on start so a hosted run is never a surprise. */
export function describeTarget(label: string, env: Env = process.env): string {
  return `${label} → ${targetHost(env.SUPABASE_URL)}`;
}
