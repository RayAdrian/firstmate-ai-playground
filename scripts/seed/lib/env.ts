import path from "node:path";
import { resolveEnvFile } from "../../lib/env-profile";

export interface SeedEnv {
  contentDir: string;
  exercisesDir: string;
  now: Date;
}

/** CONTENT_DIR / EXERCISES_DIR override the defaults (content/, exercises/); FM_NOW pins the clock for tests. */
export function readSeedEnv(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): SeedEnv {
  const now = env.FM_NOW ? new Date(env.FM_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("FM_NOW is not a valid ISO timestamp.");
  return {
    contentDir: path.resolve(cwd, env.CONTENT_DIR ?? "content"),
    exercisesDir: path.resolve(cwd, env.EXERCISES_DIR ?? "exercises"),
    now,
  };
}

/** Service-role client prerequisites. Never echoes the key. */
export function requireServiceEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL is required (from .env.local). Run `supabase start` and copy it from `supabase status -o env`.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required (from .env.local).");
}

/** Load .env.local (or the FM_ENV_FILE profile, PRD 18.8 DP-5) for scripts whose npm command has no --env-file flag. Variables already in the environment win. */
export function loadLocalEnv(cwd = process.cwd()): void {
  try {
    process.loadEnvFile(resolveEnvFile(process.env, cwd));
  } catch {
    // no .env.local: rely on the real environment
  }
}
