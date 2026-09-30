#!/usr/bin/env node
// Local merge gate. Usage: node gate.mjs <pr-state.json>
// Exit 0 = safe to merge. Exit 1 = blocked (reasons on stderr). Exit 2 = bad usage or unreadable input.
//
// STARTER: this version is naive on purpose. It only checks that each gate has a "success" status
// somewhere, on any commit. Fix it so every rule in README.md holds.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const GATES = ["gate/browser", "gate/review", "gate/uiux"];

export function evaluate(pr) {
  const reasons = [];
  for (const gate of GATES) {
    const ok = (pr.statuses ?? []).some((s) => s.context === gate && s.state === "success");
    if (!ok) reasons.push(`${gate} is not success`);
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
    console.log(`GATE PASS: PR #${pr.pr} at ${String(pr.head_sha).slice(0, 7)}`);
    return 0;
  }
  console.error(`GATE BLOCKED: PR #${pr.pr} at ${String(pr.head_sha).slice(0, 7)}`);
  for (const reason of reasons) console.error(`  - ${reason}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv));
