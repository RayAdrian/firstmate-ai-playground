import type { Env } from "./env";
import { execFile } from "node:child_process";

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = "GitError";
  }
}

export interface GitResult {
  stdout: string;
  stderr: string;
}

/** Run git without a shell and without ever prompting for credentials. */
export function git(args: readonly string[], options: { cwd: string; env?: Env; timeoutMs?: number }): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...args],
      {
        cwd: options.cwd,
        env: { ...(options.env ?? process.env), GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" } as unknown as NodeJS.ProcessEnv,
        timeout: options.timeoutMs ?? 60_000,
        maxBuffer: 32 * 1024 * 1024,
        encoding: "utf8",
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new GitError(`git ${args[0]} failed`, String(stderr || err.message)));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

export const SNAPSHOT_BRANCH = "news-snapshots";
export const SNAPSHOT_DIR = "content/news/snapshots";
