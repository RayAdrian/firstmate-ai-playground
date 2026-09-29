import type { Env } from "./env";
import path from "node:path";
import { REPO_ROOT } from "./sources";

/** Paths and tunables, all overridable by env so tests never touch repo content or the real spool. */
export function newsPaths(env: Env = process.env) {
  const spoolDir = env.NEWS_SPOOL_DIR ?? path.join(REPO_ROOT, ".news-spool");
  return {
    spoolDir,
    lockPath: env.NEWS_LOCK_PATH ?? path.join(spoolDir, "run.lock"),
    gateMarker: path.join(spoolDir, "last-scheduled.json"),
    stageDir: env.NEWS_SNAPSHOT_DIR ?? path.join(spoolDir, "snapshots"),
    profilePath: env.NEWS_PROFILE_PATH ?? path.join(REPO_ROOT, "content/news/firstmate-profile.md"),
    repoDir: env.NEWS_GIT_DIR ?? REPO_ROOT,
    remote: env.NEWS_SNAPSHOT_REMOTE ?? "origin",
  };
}

export function intEnv(env: Env, key: string, fallback: number): number {
  const v = Number(env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
