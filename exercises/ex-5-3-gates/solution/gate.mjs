#!/usr/bin/env node
// Local merge gate. Usage: node gate.mjs <pr-state.json>
// Exit 0 = safe to merge. Exit 1 = blocked (reasons on stderr). Exit 2 = bad usage or unreadable input.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const GATES = ["gate/browser", "gate/review", "gate/uiux"];
const LABELS = ["gate:browser-green", "gate:review-green", "gate:uiux-green"];
const CI_OK = new Set(["success", "skipped", "neutral"]);

const short = (sha) => String(sha).slice(0, 7);

export function evaluate(pr) {
  const reasons = [];
  const head = typeof pr?.head_sha === "string" ? pr.head_sha : "";
  if (!head) reasons.push("missing head_sha: cannot tell which commit was reviewed");

  // 1. Gate statuses. Only statuses posted on the head SHA count, and the latest one per context wins.
  const statuses = Array.isArray(pr?.statuses) ? pr.statuses : [];
  for (const gate of GATES) {
    const mine = statuses.filter((s) => s.context === gate);
    const onHead = mine.filter((s) => head && s.sha === head);
    if (onHead.length === 0) {
      const elsewhere = mine.at(-1);
      reasons.push(
        elsewhere
          ? `${gate}: only posted on ${short(elsewhere.sha)}, not on head ${short(head)} (re-review the new head)`
          : `${gate}: no status on head ${short(head)}`,
      );
      continue;
    }
    const latest = onHead.at(-1);
    if (latest.state !== "success") reasons.push(`${gate}: latest status on head ${short(head)} is ${latest.state}`);
  }

  // 2. Labels.
  const labels = Array.isArray(pr?.labels) ? pr.labels : [];
  for (const label of LABELS) if (!labels.includes(label)) reasons.push(`missing label ${label}`);

  // 3. CI. Nothing ran is not the same as everything passed.
  const checks = Array.isArray(pr?.check_runs) ? pr.check_runs : [];
  if (checks.length === 0) {
    reasons.push(`no CI check runs found on head ${short(head)}`);
  } else {
    for (const c of checks) {
      if (c.status !== "completed" || !CI_OK.has(c.conclusion)) {
        reasons.push(`CI check ${c.name}: ${c.status}/${c.conclusion ?? "none"}`);
      }
    }
  }

  // 4. Not behind main.
  if (typeof pr?.behind_by !== "number") {
    reasons.push("behind_by is missing: cannot tell whether the branch is current");
  } else if (pr.behind_by > 0) {
    reasons.push(`branch is ${pr.behind_by} commit(s) behind main; rebase and re-run the gates`);
  }

  return { ok: reasons.length === 0, reasons };
}

function main(argv) {
  const file = argv[2];
  if (!file) {
    console.error("usage: node gate.mjs <pr-state.json>");
    return 2;
  }
  let pr;
  try {
    pr = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`cannot read ${file}: ${err.message}`);
    return 2;
  }
  const { ok, reasons } = evaluate(pr);
  if (ok) {
    console.log(`GATE PASS: PR #${pr.pr} at ${short(pr.head_sha)}`);
    return 0;
  }
  console.error(`GATE BLOCKED: PR #${pr.pr} at ${short(pr.head_sha)}`);
  for (const reason of reasons) console.error(`  - ${reason}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv));
