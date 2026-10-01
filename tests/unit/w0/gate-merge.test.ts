// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * scripts/gate-merge.sh against a fake `gh` and real repo fixtures (a bare origin plus a clone).
 * Nothing here touches GitHub or a real PR.
 */
const SCRIPT = path.resolve(__dirname, "../../../scripts/gate-merge.sh");
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const GIT_ENV = {
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...GIT_ENV } }).trim();

const FAKE_GH = `#!/usr/bin/env bash
D="$GH_FAKE_DIR"
args="$*"
case "$args" in
  "repo view"*) echo "o/r" ;;
  "pr view"*headRefOid*)
    head -n1 "$D/heads"
    if (( $(wc -l <"$D/heads") > 1 )); then tail -n +2 "$D/heads" >"$D/heads.tmp"; mv "$D/heads.tmp" "$D/heads"; fi ;;
  "pr view"*labels*) cat "$D/labels" ;;
  "pr merge"*) echo "$args" >>"$D/merge.log" ;;
  "api --paginate"*check-runs*) cat "$D/checks" ;;
  "api repos/o/r/compare/"*) echo "\${GH_FAKE_BEHIND:-0}" ;;
  "api repos/o/r/commits/"*"/status"*) cat "$D/statuses" ;;
  *) echo "fake gh: unexpected call: $args" >&2; exit 99 ;;
esac
`;

interface Scenario {
  /** Mutates the PR branch working tree (relative to the clone root). */
  change: (work: string) => void;
  checks?: string[];
  labels?: string[];
  statuses?: string[];
  behind?: number;
  /** Extra head SHAs `gh pr view` returns on later calls (head moved). */
  headMoves?: string[];
  /** Report this SHA instead of the real head (not present in the repo). */
  fakeHead?: string;
}

function run(s: Scenario) {
  const root = mkdtempSync(path.join(tmpdir(), "gate-merge-"));
  roots.push(root);
  const origin = path.join(root, "origin.git");
  const work = path.join(root, "work");
  git(root, "init", "--bare", "--initial-branch=main", origin);
  git(root, "clone", "--quiet", origin, work);
  mkdirSync(path.join(work, "src"), { recursive: true });
  mkdirSync(path.join(work, "content/workflows"), { recursive: true });
  writeFileSync(path.join(work, "src/x.ts"), "export const x = 1;\n".repeat(20));
  writeFileSync(path.join(work, "content/workflows/_taxonomy.yaml"), "use_cases: []\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "base");
  git(work, "branch", "-M", "main");
  git(work, "push", "-q", "origin", "main");
  git(work, "switch", "-q", "-c", "pr");
  s.change(work);
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "change");
  const sha = git(work, "rev-parse", "HEAD");
  git(work, "push", "-q", "origin", "HEAD:refs/pull/7/head");
  git(work, "switch", "-q", "main");
  // Start from a clone that has not yet fetched the PR: the script must fetch it itself.
  git(work, "update-ref", "-d", "refs/remotes/origin/main");
  git(work, "branch", "-D", "pr");
  git(work, "gc", "-q", "--prune=now");

  const fake = path.join(root, "fake");
  mkdirSync(path.join(fake, "bin"), { recursive: true });
  writeFileSync(path.join(fake, "bin/gh"), FAKE_GH);
  chmodSync(path.join(fake, "bin/gh"), 0o755);
  writeFileSync(path.join(fake, "heads"), [s.fakeHead ?? sha, ...(s.headMoves ?? [])].join("\n") + "\n");
  writeFileSync(path.join(fake, "labels"), (s.labels ?? []).join("\n") + "\n");
  writeFileSync(path.join(fake, "statuses"), (s.statuses ?? []).join("\n") + "\n");
  writeFileSync(path.join(fake, "checks"), (s.checks ?? []).join("\n") + "\n");

  const r = spawnSync("bash", [SCRIPT, "7"], {
    cwd: work,
    encoding: "utf8",
    env: {
      ...process.env,
      ...GIT_ENV,
      PATH: `${path.join(fake, "bin")}:${process.env.PATH}`,
      GH_FAKE_DIR: fake,
      GH_FAKE_BEHIND: String(s.behind ?? 0),
    },
  });
  const mergeLog = path.join(fake, "merge.log");
  return {
    sha,
    status: r.status,
    out: r.stdout,
    err: r.stderr,
    merged: existsSync(mergeLog) ? readFileSync(mergeLog, "utf8") : "",
  };
}

const addWorkflow = (work: string, name = "a.md") =>
  writeFileSync(path.join(work, "content/workflows", name), "---\ntitle: x\n---\n");
const addCode = (work: string) => writeFileSync(path.join(work, "src/y.ts"), "export {};\n");
const GREEN_CONTENT = ["validate=completed/success", "gitleaks=completed/success"];
const GATES = ["gate/browser=success", "gate/review=success", "gate/uiux=success"];
const LABELS = ["gate:browser-green", "gate:review-green", "gate:uiux-green"];
const mixed = (w: string) => {
  addWorkflow(w);
  addCode(w);
};

describe("gate-merge.sh content lane", () => {
  it("merges a workflows-only PR with green content checks and no gate statuses or labels", () => {
    const r = run({ change: (w) => addWorkflow(w), checks: GREEN_CONTENT });
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.out).toContain("Lane: content (content/workflows/** only)");
    expect(r.merged.trim()).toBe(`pr merge 7 --squash --delete-branch --match-head-commit ${r.sha}`);
  });

  it("does not require the branch to be up to date with main", () => {
    const r = run({ change: (w) => addWorkflow(w), checks: GREEN_CONTENT, behind: 5 });
    expect(r.status).toBe(0);
  });

  it("refuses a mixed PR (workflow plus src) that lacks gates", () => {
    const r = run({ change: mixed, checks: GREEN_CONTENT });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Lane: code");
    expect(r.err).toContain("status gate/browser is not success");
    expect(r.err).toContain("missing label gate:review-green");
    expect(r.merged).toBe("");
  });

  it("refuses a mixed PR with gates green but the content checks missing", () => {
    const r = run({ change: mixed, checks: ["checks=completed/success"], labels: LABELS, statuses: GATES });
    expect(r.status).toBe(1);
    expect(r.err).toContain("required content check 'validate'");
    expect(r.merged).toBe("");
  });

  it("merges a mixed PR when gates, labels and content checks are all green", () => {
    const r = run({
      change: mixed,
      checks: ["checks=completed/success", ...GREEN_CONTENT],
      labels: LABELS,
      statuses: GATES,
    });
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
    expect(r.merged).toContain(`--match-head-commit ${r.sha}`);
  });

  it("refuses a rename from src into content/workflows (code lane, no gates)", () => {
    const r = run({
      change: (w) => git(w, "mv", "src/x.ts", "content/workflows/x.md"),
      checks: GREEN_CONTENT,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Lane: code");
    expect(r.err).toContain("status gate/browser is not success");
    expect(r.merged).toBe("");
  });

  it("refuses to treat a symlink inside content/workflows as content-lane material", () => {
    const r = run({
      change: (w) => symlinkSync("../../src/x.ts", path.join(w, "content/workflows/link.md")),
      checks: GREEN_CONTENT,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Lane: code");
    expect(r.merged).toBe("");
  });

  it("refuses a symlink hidden among 300 regular files (SIGPIPE regression)", () => {
    const r = run({
      change: (w) => {
        symlinkSync("../../.env.local", path.join(w, "content/workflows/0000.md"));
        for (let i = 1; i <= 300; i++) addWorkflow(w, `wf-${String(i).padStart(4, "0")}.md`);
      },
      checks: GREEN_CONTENT,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Lane: code");
    expect(r.merged).toBe("");
  });

  it("refuses an executable .md", () => {
    const r = run({
      change: (w) => {
        addWorkflow(w);
        chmodSync(path.join(w, "content/workflows/a.md"), 0o755);
      },
      checks: GREEN_CONTENT,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Lane: code");
    expect(r.merged).toBe("");
  });

  it("refuses a gitlink (submodule) entry", () => {
    const r = run({
      change: (w) => {
        // A nested repo staged with `add -A` becomes a gitlink (mode 160000).
        const nested = path.join(w, "content/workflows/sub.md");
        mkdirSync(nested);
        git(nested, "init", "-q");
        writeFileSync(path.join(nested, "f"), "x");
        git(nested, "add", "-A");
        git(nested, "commit", "-q", "-m", "n");
      },
      checks: GREEN_CONTENT,
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain("Lane: code");
    expect(r.merged).toBe("");
  });

  it.each([
    ["queued", "validate=queued/"],
    ["in_progress", "validate=in_progress/"],
    ["pending", "validate=pending/"],
    ["failed", "validate=completed/failure"],
    ["cancelled", "validate=completed/cancelled"],
    ["neutral", "validate=completed/neutral"],
  ])("refuses when a check run is %s", (_n, line) => {
    const r = run({ change: (w) => addWorkflow(w), checks: [line, "gitleaks=completed/success"] });
    expect(r.status).toBe(1);
    expect(r.err).toContain("CI check validate");
    expect(r.merged).toBe("");
  });

  it("refuses a pending check that is not one of the required names", () => {
    const r = run({ change: (w) => addWorkflow(w), checks: [...GREEN_CONTENT, "other=in_progress/"] });
    expect(r.status).toBe(1);
    expect(r.err).toContain("CI check other: in_progress/");
    expect(r.merged).toBe("");
  });

  it("refuses when there are no check runs at all", () => {
    const r = run({ change: (w) => addWorkflow(w), checks: [] });
    expect(r.status).toBe(1);
    expect(r.err).toContain("no CI check runs");
  });

  it("refuses when gitleaks is missing in the content lane", () => {
    const r = run({ change: (w) => addWorkflow(w), checks: ["validate=completed/success"] });
    expect(r.status).toBe(1);
    expect(r.err).toContain("required content check 'gitleaks'");
    expect(r.merged).toBe("");
  });

  it("refuses when a required check was skipped", () => {
    const r = run({
      change: (w) => addWorkflow(w),
      checks: ["validate=completed/skipped", "gitleaks=completed/success"],
    });
    expect(r.status).toBe(1);
    expect(r.merged).toBe("");
  });

  it("refuses when the head moves between resolve and merge", () => {
    const moved = "b".repeat(40);
    const r = run({ change: (w) => addWorkflow(w), checks: GREEN_CONTENT, headMoves: [moved] });
    expect(r.status).toBe(1);
    expect(r.err).toContain(`head moved from ${r.sha} to ${moved}; re-run`);
    expect(r.merged).toBe("");
  });

  it("refuses when the reported head SHA is not in the fetched PR ref", () => {
    const r = run({ change: (w) => addWorkflow(w), checks: GREEN_CONTENT, fakeHead: "c".repeat(40) });
    expect(r.status).toBe(1);
    expect(r.err).toContain("head commit is not present");
    expect(r.merged).toBe("");
  });
});

describe("gate-merge.sh code lane (unchanged rules, now pinned to one SHA)", () => {
  it("merges when all gates, labels and checks are green", () => {
    const r = run({ change: addCode, checks: ["checks=completed/success"], labels: LABELS, statuses: GATES });
    expect(r.status).toBe(0);
    expect(r.out).toContain("Lane: code");
    expect(r.merged).toContain(`--match-head-commit ${r.sha}`);
  });

  it("allows neutral and skipped check conclusions, as on main", () => {
    const r = run({
      change: addCode,
      checks: ["checks=completed/success", "review=completed/neutral", "e2e=completed/skipped"],
      labels: LABELS,
      statuses: GATES,
    });
    expect(r.err).toBe("");
    expect(r.status).toBe(0);
  });

  it("refuses when behind main", () => {
    const r = run({
      change: addCode,
      checks: ["checks=completed/success"],
      labels: LABELS,
      statuses: GATES,
      behind: 2,
    });
    expect(r.status).toBe(1);
    expect(r.err).toContain("2 commit(s) behind main");
  });

  it("refuses with a pending check even when gates are green", () => {
    const r = run({ change: addCode, checks: ["e2e=in_progress/"], labels: LABELS, statuses: GATES });
    expect(r.status).toBe(1);
    expect(r.err).toContain("CI check e2e: in_progress/");
  });

  it("refuses when a gate status is not success", () => {
    const r = run({
      change: addCode,
      checks: ["checks=completed/success"],
      labels: LABELS,
      statuses: ["gate/browser=success", "gate/review=failure", "gate/uiux=success"],
    });
    expect(r.status).toBe(1);
    expect(r.err).toContain("status gate/review is not success");
  });
});
