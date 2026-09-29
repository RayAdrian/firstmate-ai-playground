import type { Env } from "./env";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { git, GitError, SNAPSHOT_BRANCH } from "./gitx";
import { sameIgnoringExportedAt, type SnapshotFile } from "./snapshot";

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

export interface PublishOptions {
  /** A checkout of this repo (any branch). It is only used as the object store: nothing in it is modified. */
  repoDir: string;
  remote: string;
  files: readonly SnapshotFile[];
  message: string;
  env?: Env;
}

export interface PublishResult {
  pushed: boolean;
  reason?: "unchanged";
}

/**
 * Commit snapshot files to the `news-snapshots` branch through a separate temporary git worktree and push
 * (PRD section 14, Q1). The current branch, index, working tree, stash and main are never touched, no branch is
 * checked out in `repoDir`, and there is no force push: on a rejected push we re-fetch, rebuild on the new tip
 * and push once more.
 */
export async function publishSnapshots(opts: PublishOptions): Promise<PublishResult> {
  const { repoDir, remote, env } = opts;
  const g = (args: string[], cwd = repoDir) => git(args, { cwd, env });
  const remoteRef = `refs/remotes/${remote}/${SNAPSHOT_BRANCH}`;

  const fetchTip = async (): Promise<boolean> => {
    let listed: string;
    try {
      listed = (await g(["ls-remote", "--heads", remote, `refs/heads/${SNAPSHOT_BRANCH}`])).stdout;
    } catch (err) {
      throw new PublishError(`cannot reach remote "${remote}": ${firstLine(err)}`);
    }
    if (listed.trim() === "") return false;
    try {
      await g(["fetch", "--quiet", "--no-tags", remote, `+refs/heads/${SNAPSHOT_BRANCH}:${remoteRef}`]);
    } catch (err) {
      throw new PublishError(`fetch of ${SNAPSHOT_BRANCH} failed: ${firstLine(err)}`);
    }
    return true;
  };

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fm-news-snap-"));
  const wt = path.join(tmpRoot, "wt");
  const orphanBranch = `fm-news-orphan-${process.pid}-${Date.now()}`;
  let createdOrphan = false;
  let added = false;

  try {
    let exists = await fetchTip();
    if (exists) {
      await g(["worktree", "add", "--detach", "--quiet", wt, remoteRef]);
    } else {
      await g(["worktree", "add", "--detach", "--quiet", wt, "HEAD"]);
      await g(["checkout", "--quiet", "--orphan", orphanBranch], wt);
      createdOrphan = true;
      await g(["rm", "-rf", "--quiet", "--ignore-unmatch", "."], wt);
      await g(["clean", "-fdxq"], wt);
    }
    added = true;

    const stage = async (): Promise<boolean> => {
      let changed = false;
      for (const f of opts.files) {
        const target = path.join(wt, f.relPath);
        if (fs.existsSync(target) && sameIgnoringExportedAt(fs.readFileSync(target, "utf8"), f.content)) continue;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, f.content);
        await g(["add", "--", f.relPath], wt);
        changed = true;
      }
      return changed;
    };

    const commit = async () => {
      const identity: string[] = [];
      const hasName = (await g(["config", "user.name"]).catch(() => ({ stdout: "" }))).stdout.trim() !== "";
      const hasEmail = (await g(["config", "user.email"]).catch(() => ({ stdout: "" }))).stdout.trim() !== "";
      if (!hasName) identity.push("-c", "user.name=fm-playground-news");
      if (!hasEmail) identity.push("-c", "user.email=news@fm-playground.invalid");
      await g([...identity, "-c", "commit.gpgsign=false", "commit", "--quiet", "--no-verify", "-m", opts.message], wt);
    };

    if (!(await stage())) return { pushed: false, reason: "unchanged" };
    await commit();

    try {
      await g(["push", "--quiet", remote, `HEAD:refs/heads/${SNAPSHOT_BRANCH}`], wt);
    } catch (firstErr) {
      // Rejected (someone else pushed) or transient. Rebuild on the new tip and try exactly once more; never force.
      exists = await fetchTip();
      if (!exists) throw new PublishError(`push failed: ${firstLine(firstErr)}`);
      await g(["reset", "--hard", "--quiet", remoteRef], wt);
      if (!(await stage())) return { pushed: false, reason: "unchanged" };
      await commit();
      try {
        await g(["push", "--quiet", remote, `HEAD:refs/heads/${SNAPSHOT_BRANCH}`], wt);
      } catch (secondErr) {
        throw new PublishError(`push failed: ${firstLine(secondErr)}`);
      }
    }
    return { pushed: true };
  } catch (err) {
    if (err instanceof PublishError) throw err;
    throw new PublishError(`snapshot publish failed: ${firstLine(err)}`);
  } finally {
    if (added) await g(["worktree", "remove", "--force", wt]).catch(() => undefined);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    await g(["worktree", "prune"]).catch(() => undefined);
    if (createdOrphan) await g(["branch", "-D", "--quiet", orphanBranch]).catch(() => undefined);
  }
}

function firstLine(err: unknown): string {
  const text = err instanceof GitError ? err.stderr : err instanceof Error ? err.message : String(err);
  return text.split("\n").find((l) => l.trim() !== "")?.trim().slice(0, 300) ?? "unknown error";
}
