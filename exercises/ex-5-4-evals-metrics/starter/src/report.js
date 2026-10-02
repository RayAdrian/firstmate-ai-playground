import { runCheck } from "./checks.js";

// A case result is { id, status: "pass" | "fail" | "unscored", reason?, checks: [{ type, status, reason }] }.

/**
 * Run every check of one case against outputs/<id>/ and decide the case status.
 *
 * TODO: this naive version trusts the spec and the checks. Make it fail closed:
 *   - the id must be a plain name (letters, digits, ".", "_", "-"), never a path
 *   - a case with no checks fails; a case whose output folder does not exist fails
 *   - a check that throws, or returns no valid status, is a failed check (never crash the run)
 *   - "skipped" checks (rubric) do not count; if nothing is left to score the case is "unscored"
 *   - otherwise the case passes only if every scored check passes
 */
export function evaluateCase(spec, outputsDir) {
  const checks = (spec.checks ?? []).map((check) => ({ type: check.type, ...runCheck(check, { caseDir: `${outputsDir}/${spec.id}` }) }));
  return { id: spec.id, status: "pass", checks };
}

/**
 * Turn case results into the report the CLI prints. The shape:
 *   { total_cases, passed, failed, unscored, pass_rate, threshold, ok, failures_by_type, cases }
 *
 * TODO: this naive version divides by every case and ignores the threshold.
 *   - pass_rate = passed / (passed + failed), rounded to 3 decimals, or null when nothing was scored
 *   - unscored cases are listed and counted, but are not part of the pass rate
 *   - ok = pass_rate is not null and pass_rate >= threshold
 *   - failures_by_type counts failed checks per check type, keys sorted alphabetically
 *   - a threshold that is not a number between 0 and 1 throws a RangeError
 */
export function buildReport(cases, threshold) {
  const passed = cases.filter((c) => c.status === "pass").length;
  return {
    total_cases: cases.length,
    passed,
    failed: cases.length - passed,
    unscored: 0,
    pass_rate: cases.length === 0 ? null : passed / cases.length,
    threshold,
    ok: true,
    failures_by_type: {},
    cases,
  };
}
