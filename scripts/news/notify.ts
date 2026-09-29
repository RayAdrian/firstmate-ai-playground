import type { Env } from "./env";
import { execFile } from "node:child_process";

/** macOS notification (I-6). Best effort: never throws, never changes the run outcome. */
export function macNotify(message: string, env: Env = process.env): void {
  if (env.NEWS_NOTIFY === "0" || (process.platform !== "darwin" && !env.FM_FORCE_NOTIFY)) return;
  const script = `display notification ${JSON.stringify(message)} with title "First Mate news"`;
  try {
    execFile("osascript", ["-e", script], { env: env as NodeJS.ProcessEnv, timeout: 10_000 }, () => undefined);
  } catch {
    // ignore
  }
}
