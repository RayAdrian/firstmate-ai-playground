// Scan one file: gitleaks when it is installed, plus the built-in rules (PRD §16.7 WF-11). W3's share CLI imports `scanFile`.
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseGitleaksReport, scanText, type ScanFinding } from "./scan-rules";

export type GitleaksRunResult = { status: "ok"; report: string } | { status: "missing" } | { status: "error"; message: string };
/** Runs `gitleaks detect --no-git` on `file`. Injectable so tests need no binary. */
export type GitleaksRunner = (file: string) => Promise<GitleaksRunResult>;

export const NO_GITLEAKS_WARNING = "gitleaks is not installed; running the built-in rules only (install it for the full scan: https://github.com/gitleaks/gitleaks)";

/** The real runner. `--redact` keeps secret material out of anything gitleaks writes. Exit code 0 is forced so a finding is data, not a crash. */
export const runGitleaks: GitleaksRunner = (file) =>
  new Promise((resolve) => {
    const dir = mkdtempSync(path.join(tmpdir(), "fm-gitleaks-"));
    const reportPath = path.join(dir, "report.json");
    const done = (r: GitleaksRunResult) => {
      rmSync(dir, { recursive: true, force: true });
      resolve(r);
    };
    execFile(
      "gitleaks",
      ["detect", "--no-git", "--no-banner", "--redact", "--exit-code", "0", "--source", file, "--report-format", "json", "--report-path", reportPath],
      { timeout: 60_000 },
      (err) => {
        if (err) {
          const code = (err as NodeJS.ErrnoException).code;
          return done(code === "ENOENT" ? { status: "missing" } : { status: "error", message: `gitleaks failed (${String(code ?? "unknown")})` });
        }
        try {
          done({ status: "ok", report: readFileSync(reportPath, "utf8") });
        } catch {
          done({ status: "error", message: "gitleaks wrote no report" });
        }
      },
    );
  });

export interface ScanFileResult {
  findings: ScanFinding[];
  warnings: string[];
}

export async function scanFile(file: string, opts: { gitleaks?: GitleaksRunner | "off" } = {}): Promise<ScanFileResult> {
  const findings = scanText(readFileSync(file, "utf8"));
  const warnings: string[] = [];
  const runner = opts.gitleaks ?? runGitleaks;
  if (runner !== "off") {
    const r = await runner(file);
    if (r.status === "missing") warnings.push(NO_GITLEAKS_WARNING);
    else if (r.status === "error") warnings.push(`${r.message}; running the built-in rules only`);
    else {
      try {
        findings.push(...parseGitleaksReport(r.report));
      } catch {
        warnings.push("could not read the gitleaks report; running the built-in rules only");
      }
    }
  }
  findings.sort((a, b) => a.line - b.line || (a.rule < b.rule ? -1 : 1));
  return { findings, warnings };
}
