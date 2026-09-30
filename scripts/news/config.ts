import type { Env } from "./env";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "./sources";

/** Paths and tunables, all overridable by env so tests never touch repo content or the real spool. */
export function newsPaths(env: Env = process.env) {
  const spoolDir = env.NEWS_SPOOL_DIR ?? path.join(REPO_ROOT, ".news-spool");
  // The run lock and the schedule gate marker guard the ONE shared database, so they live in a fixed per-user
  // location, not in the checkout: a run from any worktree must not overlap the scheduled run.
  const stateDir = env.NEWS_STATE_DIR ?? (env.NEWS_SPOOL_DIR ? spoolDir : sharedStateDir());
  return {
    spoolDir,
    lockPath: env.NEWS_LOCK_PATH ?? path.join(stateDir, "run.lock"),
    gateMarker: path.join(stateDir, "last-scheduled.json"),
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

function sharedStateDir(): string {
  const home = os.homedir();
  return process.platform === "darwin" ? path.join(home, "Library", "Application Support", "fm-playground") : path.join(home, ".local", "state", "fm-playground");
}
