import { REPO_URL } from "@/lib/contracts";

/** The repo URL lives in the contracts (WF-37). Components build every GitHub link from the helpers here. */

export const REPO_CLONE_CMD = `git clone ${REPO_URL}.git`;

/** The `exercises/` folder on the default branch. */
export function exercisesTreeUrl(): string {
  return `${REPO_URL}/tree/main/exercises`;
}

/**
 * GitHub folder URL for one exercise, from its `repo_path` (`exercises/<slug>/starter`).
 * The folder is the exercise directory, so a trailing `/starter` is dropped.
 */
export function exerciseFolderUrl(repoPath: string): string {
  const folder = repoPath
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/starter$/, "");
  return `${REPO_URL}/tree/main/${folder}`;
}
