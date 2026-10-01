// Attribution for workflows comes from git, never from the file (PRD §16.7 WF-42, §16.8). Emails are never read or stored.
import { execFileSync } from "node:child_process";

export interface WorkflowGitMeta {
  /** Name on the earliest commit that added the file, or "Unknown". */
  author_name: string;
  /** Date (YYYY-MM-DD) of the latest commit that touched the file on main, or null while it is not on main. */
  reviewed_on: string | null;
}

/** `fileName` is the file's name inside the workflows folder. */
export type GitMetaProvider = (fileName: string) => WorkflowGitMeta;

const UNKNOWN: WorkflowGitMeta = { author_name: "Unknown", reviewed_on: null };
export const NO_HISTORY_WARNING =
  'workflow authors are unavailable (shallow clone or not a git checkout): authors show as "Unknown" and reviewed_on is empty. Run `git fetch --unshallow` for full history.';

/** Run git with an argv array (never a shell). Returns stdout, or null when git fails. */
function git(dir: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000 });
  } catch {
    return null;
  }
}

/**
 * Git-backed attribution for the files in `dir` (content/workflows). History problems degrade to "Unknown" with ONE warning;
 * they never fail a seed. `reviewed_on` reads `main` when it exists locally and HEAD otherwise, so a file that is only on a
 * feature branch has no review date yet.
 */
export function createGitMeta(dir: string): { meta: GitMetaProvider; warnings: string[] } {
  const warnings: string[] = [];
  let state: { usable: false } | { usable: true; reviewRef: string } | null = null;

  const resolve = () => {
    if (state) return state;
    const inside = git(dir, ["rev-parse", "--is-inside-work-tree"])?.trim() === "true";
    const shallow = git(dir, ["rev-parse", "--is-shallow-repository"])?.trim() !== "false";
    if (!inside || shallow) {
      warnings.push(NO_HISTORY_WARNING);
      return (state = { usable: false });
    }
    const hasMain = git(dir, ["rev-parse", "--verify", "--quiet", "refs/heads/main"]) !== null;
    return (state = { usable: true, reviewRef: hasMain ? "main" : "HEAD" });
  };

  const meta: GitMetaProvider = (fileName) => {
    const s = resolve();
    if (!s.usable) return UNKNOWN;
    const added = git(dir, ["log", "--diff-filter=A", "--follow", "--format=%an", "--", fileName]);
    const author = added?.split("\n").map((l) => l.trim()).filter(Boolean).pop();
    const reviewed = git(dir, ["log", "-1", "--format=%cs", s.reviewRef, "--", fileName])?.trim();
    return { author_name: author || UNKNOWN.author_name, reviewed_on: reviewed && /^\d{4}-\d{2}-\d{2}$/.test(reviewed) ? reviewed : null };
  };
  return { meta, warnings };
}
