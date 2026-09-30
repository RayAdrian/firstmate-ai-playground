// Acceptance tests for the gate. Frozen: do not edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { evaluate } from "../gate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = (name) => path.join(root, "fixtures", `${name}.json`);
const load = (name) => JSON.parse(readFileSync(fixturePath(name), "utf8"));
const run = (...args) => spawnSync(process.execPath, [path.join(root, "gate.mjs"), ...args], { encoding: "utf8" });

function blocked(name, ...patterns) {
  const { ok, reasons } = evaluate(load(name));
  assert.equal(ok, false, `${name} must be blocked`);
  const text = reasons.join("\n");
  for (const p of patterns) assert.match(text, p, `${name}: expected a reason matching ${p}, got:\n${text}`);
}

test("a PR with three fresh gate statuses, three labels, green CI and no lag merges", () => {
  assert.deepEqual(evaluate(load("good")), { ok: true, reasons: [] });
});

test("skipped and neutral CI checks are allowed", () => {
  assert.deepEqual(evaluate(load("good-with-skipped")), { ok: true, reasons: [] });
});

test("a missing gate status blocks", () => {
  blocked("missing-uiux-status", /gate\/uiux/);
});

test("an approval posted on an older commit does not count (approvals are pinned to the head SHA)", () => {
  blocked("stale-sha", /gate\/review/);
});

test("the latest status on the head SHA wins: a later failure overrides an earlier success", () => {
  blocked("flipped-to-failure", /gate\/review/);
});

test("a failing CI check blocks and is named", () => {
  blocked("failing-ci", /typecheck/);
});

test("a CI check that has not finished blocks and is named", () => {
  blocked("ci-still-running", /e2e/);
});

test("no CI check runs at all blocks (nothing ran is not the same as everything passed)", () => {
  blocked("no-ci", /no CI check runs/i);
});

test("a branch behind main blocks and says by how much", () => {
  blocked("behind-main", /behind/i, /2/);
});

test("a missing gate label blocks and names the label", () => {
  blocked("missing-label", /gate:review-green/);
});

test("the seeded bad PR is blocked for every reason, not just the first", () => {
  const { ok, reasons } = evaluate(load("seeded-bad-pr"));
  assert.equal(ok, false);
  const text = reasons.join("\n");
  for (const p of [/gate\/browser/, /gate\/review/, /gate\/uiux/, /gate:review-green/, /gate:uiux-green/, /unit/, /e2e/, /behind/i]) {
    assert.match(text, p);
  }
});

test("missing or empty input fails closed instead of throwing", () => {
  assert.equal(evaluate({}).ok, false);
  assert.equal(evaluate({ head_sha: "abc", statuses: [], labels: [], check_runs: [], behind_by: 0 }).ok, false);
});

test("CLI: exit 0 and a PASS line for a good PR", () => {
  const r = run(fixturePath("good"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /GATE PASS/);
});

test("CLI: exit 1 and every reason on stderr for the seeded bad PR", () => {
  const r = run(fixturePath("seeded-bad-pr"));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /GATE BLOCKED/);
  assert.match(r.stderr, /gate\/uiux/);
  assert.match(r.stderr, /behind/i);
});

test("CLI: exit 2 with no argument or an unreadable file", () => {
  assert.equal(run().status, 2);
  assert.equal(run(path.join(root, "fixtures", "does-not-exist.json")).status, 2);
});

test("optional GitHub Action: if .github/workflows/gate.yml exists it runs on pull_request and keeps secrets in secrets", (t) => {
  const wf = path.join(root, ".github", "workflows", "gate.yml");
  if (!existsSync(wf)) return t.skip("no workflow (optional)");
  const text = readFileSync(wf, "utf8");
  assert.match(text, /pull_request/);
  assert.match(text, /secrets\./);
  assert.doesNotMatch(text, /sk-[A-Za-z0-9]{10,}/, "no literal API keys in workflow files");
});
