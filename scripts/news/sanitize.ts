import type { Env } from "./env";
const SECRET_ENV_KEYS = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "ANTHROPIC_API_KEY"];

/**
 * Make a message safe to log, store in `ingest_runs.error_summary` or commit in a snapshot: no secrets from the
 * environment, JWT/API-key shapes, absolute local paths or stack frames.
 */
export function sanitize(text: string, env: Env = process.env): string {
  let out = text;
  for (const key of SECRET_ENV_KEYS) {
    const v = env[key];
    if (v && v.length >= 8) out = out.split(v).join("[redacted]");
  }
  return out
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, "[redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/^\s+at .*$/gm, "")
    .replace(/(?<![A-Za-z0-9._~:/-])(?:file:\/\/)?\/(?:Users|home|private|var|tmp)\/[^\s"'`)]*/g, "<path>")
    .replace(/\s+/g, " ")
    .trim();
}

export const ERROR_SUMMARY_MAX = 2000;

export function summarizeErrors(errors: readonly string[], env: Env = process.env): string | null {
  if (errors.length === 0) return null;
  const joined = sanitize(errors.join("; "), env);
  return Array.from(joined).slice(0, ERROR_SUMMARY_MAX).join("");
}
