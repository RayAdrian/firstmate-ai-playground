/**
 * Lane classifier for `npm run gate:merge` (PRD §16.7 WF-22). Pure function over the output of
 * `git diff --name-status --find-renames --find-copies`; no I/O except the CLI wrapper below.
 *
 * CLI: reads name-status text on stdin, prints `lane=<content|code> touches_workflows=<0|1>` and exits 0,
 * or prints the refusal reason on stderr and exits 1.
 */

export type Lane = "content" | "code";
export type LaneResult =
  | { ok: true; lane: Lane; touchesWorkflows: boolean; paths: string[] }
  | { ok: false; reason: string };

const WORKFLOWS_DIR = "content/workflows";
const ALLOWED_NAME = /^(?:[^/]+\.md|_taxonomy\.yaml|_takedowns\.txt)$/;

/** A direct child of content/workflows/ with an allowlisted name (no subfolders). */
export function isWorkflowLanePath(path: string): boolean {
  const prefix = `${WORKFLOWS_DIR}/`;
  return path.startsWith(prefix) && ALLOWED_NAME.test(path.slice(prefix.length));
}

const inWorkflowsTree = (path: string) => path === WORKFLOWS_DIR || path.startsWith(`${WORKFLOWS_DIR}/`);

export function classifyLane(nameStatus: string): LaneResult {
  const paths: string[] = [];
  for (const raw of nameStatus.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "") continue;
    const [status = "", ...rest] = line.split("\t");
    if (/^[AMDT]$/.test(status) && rest.length === 1) {
      paths.push(rest[0]);
    } else if (/^[RC]\d{0,3}$/.test(status) && rest.length === 2) {
      // Renames and copies: the old AND the new path both count.
      paths.push(rest[0], rest[1]);
    } else {
      return { ok: false, reason: `unrecognised change entry (status "${status}"); refusing to classify` };
    }
    if (rest.some((p) => p === "")) {
      return { ok: false, reason: `empty path in change entry "${line}"` };
    }
  }
  if (paths.length === 0) return { ok: false, reason: "no changed files; nothing to merge" };
  const lane: Lane = paths.every(isWorkflowLanePath) ? "content" : "code";
  return { ok: true, lane, touchesWorkflows: paths.some(inWorkflowsTree), paths };
}

async function main() {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const r = classifyLane(Buffer.concat(chunks).toString("utf8"));
  if (!r.ok) {
    console.error(r.reason);
    process.exit(1);
  }
  console.log(`lane=${r.lane} touches_workflows=${r.touchesWorkflows ? 1 : 0}`);
}

if (process.argv[1] && /gate-lane\.[cm]?[jt]s$/.test(process.argv[1])) {
  void main();
}
