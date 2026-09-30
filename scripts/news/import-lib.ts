import type { Env } from "./env";
import { newsSnapshotSchema, type NewsSnapshot, type SnapshotItem, type SnapshotRun } from "@/lib/contracts";
import { git, GitError, SNAPSHOT_BRANCH, SNAPSHOT_DIR } from "./gitx";
import { EXCERPT_MAX, TITLE_MAX } from "./normalize";
import type { ImportResult, NewsStore } from "./types";

export class ImportError extends Error {
  constructor(
    message: string,
    readonly kind: "no-branch" | "fetch" | "invalid",
  ) {
    super(message);
    this.name = "ImportError";
  }
}

const WHY_MAX = 280;
const cp = (s: string) => Array.from(s).length;

/**
 * Snapshots come from a shared branch any engineer could push to, so they are untrusted input. On top of the
 * contract schema (which also enforces http(s)-only urls) this caps text lengths.
 */
export function validateSnapshotFile(name: string, text: string): NewsSnapshot {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportError(`${name}: invalid JSON`, "invalid");
  }
  const parsed = newsSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ImportError(`${name}: field ${issue.path.join(".") || "(root)"}: ${issue.message}`, "invalid");
  }
  const snap = parsed.data;
  const expected = name.replace(/^.*\//, "").replace(/\.json$/, "");
  if (snap.digest_date !== expected) throw new ImportError(`${name}: field digest_date: "${snap.digest_date}" does not match the file name`, "invalid");
  snap.items.forEach((item, i) => {
    const where = `${name}: items.${i}`;
    if (item.digest_date !== snap.digest_date) throw new ImportError(`${where}.digest_date: differs from the snapshot digest_date`, "invalid");
    if (item.why_it_matters !== null && cp(item.why_it_matters) > WHY_MAX) throw new ImportError(`${where}.why_it_matters: longer than ${WHY_MAX} characters`, "invalid");
    if (cp(item.title) > TITLE_MAX) throw new ImportError(`${where}.title: longer than ${TITLE_MAX} characters`, "invalid");
    if (item.excerpt !== null && cp(item.excerpt) > EXCERPT_MAX) throw new ImportError(`${where}.excerpt: longer than ${EXCERPT_MAX} characters`, "invalid");
  });
  return snap;
}

export interface ImportSummary {
  snapshots: number;
  result: ImportResult;
}

/**
 * Fetch `news-snapshots` (fetch only: no checkout, index and HEAD untouched), validate EVERY snapshot first, then
 * upsert. Validation is all-or-nothing; the upsert is idempotent (items by canonical_url, runs by id), so a retry
 * after a mid-way database failure converges to the same state.
 */
export async function importSnapshots(opts: { store: NewsStore; repoDir: string; remote: string; env?: Env }): Promise<ImportSummary> {
  const { repoDir, remote, env } = opts;
  const g = (args: string[]) => git(args, { cwd: repoDir, env });
  const ref = `refs/remotes/${remote}/${SNAPSHOT_BRANCH}`;

  let listed: string;
  try {
    listed = (await g(["ls-remote", "--heads", remote, `refs/heads/${SNAPSHOT_BRANCH}`])).stdout;
  } catch (err) {
    throw new ImportError(`could not reach "${remote}": ${firstLine(err)}`, "fetch");
  }
  if (listed.trim() === "") throw new ImportError(`No ${SNAPSHOT_BRANCH} branch on ${remote} yet`, "no-branch");
  try {
    await g(["fetch", "--quiet", "--no-tags", remote, `+refs/heads/${SNAPSHOT_BRANCH}:${ref}`]);
  } catch (err) {
    throw new ImportError(`fetch of ${SNAPSHOT_BRANCH} failed: ${firstLine(err)}`, "fetch");
  }

  const names = (await g(["ls-tree", "-r", "--name-only", ref, "--", `${SNAPSHOT_DIR}/`])).stdout
    .split("\n")
    .filter((n) => /\/\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort();

  const snapshots: NewsSnapshot[] = [];
  for (const name of names) {
    const { stdout } = await g(["show", `${ref}:${name}`]);
    snapshots.push(validateSnapshotFile(name, stdout));
  }

  const items: SnapshotItem[] = snapshots.flatMap((s) => s.items);
  const runs: SnapshotRun[] = snapshots.flatMap((s) => s.runs);
  const result = await opts.store.importSnapshot(items, runs);
  return { snapshots: snapshots.length, result };
}

function firstLine(err: unknown): string {
  const text = err instanceof GitError ? err.stderr : err instanceof Error ? err.message : String(err);
  return text.split("\n").find((l) => l.trim() !== "")?.trim().slice(0, 300) ?? "unknown error";
}
