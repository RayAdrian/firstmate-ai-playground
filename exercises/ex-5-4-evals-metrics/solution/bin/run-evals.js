#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { evaluateCase, buildReport } from "../src/report.js";

function usage(msg) {
  if (msg) console.error(msg);
  console.error("usage: node bin/run-evals.js [--spec evals/spec.json] [--outputs outputs] [--threshold 0..1]");
  process.exit(2);
}

const args = process.argv.slice(2);
const opts = { spec: "evals/spec.json", outputs: "outputs", threshold: undefined };
for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];
  if (!["--spec", "--outputs", "--threshold"].includes(key) || value === undefined) usage(`bad argument: ${key}`);
  opts[key.slice(2)] = value;
}

let spec;
try {
  spec = JSON.parse(fs.readFileSync(opts.spec, "utf8"));
} catch (err) {
  usage(`cannot read spec ${opts.spec}: ${err.message}`);
}
if (!spec || !Array.isArray(spec.cases)) usage("spec must be an object with a cases array");

const threshold = opts.threshold !== undefined ? Number(opts.threshold) : spec.threshold;
let report;
try {
  report = buildReport(
    spec.cases.map((c) => evaluateCase(c, path.resolve(opts.outputs))),
    threshold,
  );
} catch (err) {
  usage(err.message);
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
console.error(
  `pass rate ${report.pass_rate ?? "n/a"} (${report.passed} passed, ${report.failed} failed, ${report.unscored} unscored) vs threshold ${report.threshold}: ${report.ok ? "OK" : "BLOCKED"}`,
);
process.exit(report.ok ? 0 : 1);
