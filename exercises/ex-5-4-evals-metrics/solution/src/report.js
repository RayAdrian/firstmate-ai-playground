import fs from "node:fs";
import path from "node:path";
import { runCheck } from "./checks.js";

const STATUSES = new Set(["pass", "fail", "skipped"]);

/** Run every check of one case. Never throws: anything unexpected becomes a failed check. */
export function evaluateCase(spec, outputsDir) {
  const id = typeof spec?.id === "string" ? spec.id : "(no id)";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    return { id, status: "fail", reason: "bad case id", checks: [] };
  }
  const checks = Array.isArray(spec.checks) ? spec.checks : [];
  if (checks.length === 0) return { id, status: "fail", reason: "case has no checks", checks: [] };

  const caseDir = path.join(outputsDir, id);
  if (!fs.existsSync(caseDir) || !fs.statSync(caseDir).isDirectory()) {
    return { id, status: "fail", reason: "no output folder for this case", checks: [] };
  }

  const results = checks.map((check) => {
    const type = typeof check?.type === "string" ? check.type : "(none)";
    try {
      const r = runCheck(check, { caseDir });
      if (!r || !STATUSES.has(r.status)) return { type, status: "fail", reason: "check returned no valid status" };
      return { type, status: r.status, reason: r.reason ?? "" };
    } catch (err) {
      return { type, status: "fail", reason: `check threw: ${err.message}` };
    }
  });

  const scored = results.filter((r) => r.status !== "skipped");
  const status = scored.length === 0 ? "unscored" : scored.every((r) => r.status === "pass") ? "pass" : "fail";
  return { id, status, checks: results };
}

/** Turn case results into the report. The pass rate is over scored cases only; unscored cases are listed, not counted. */
export function buildReport(cases, threshold) {
  if (typeof threshold !== "number" || !(threshold >= 0 && threshold <= 1)) {
    throw new RangeError("threshold must be a number between 0 and 1");
  }
  const passed = cases.filter((c) => c.status === "pass").length;
  const failed = cases.filter((c) => c.status === "fail").length;
  const unscored = cases.filter((c) => c.status === "unscored").length;
  const scored = passed + failed;
  const passRate = scored === 0 ? null : Math.round((passed / scored) * 1000) / 1000;

  const counts = {};
  for (const c of cases) {
    for (const check of c.checks) {
      if (check.status === "fail") counts[check.type] = (counts[check.type] ?? 0) + 1;
    }
  }
  const failuresByType = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));

  return {
    total_cases: cases.length,
    passed,
    failed,
    unscored,
    pass_rate: passRate,
    threshold,
    ok: passRate !== null && passRate >= threshold,
    failures_by_type: failuresByType,
    cases,
  };
}
