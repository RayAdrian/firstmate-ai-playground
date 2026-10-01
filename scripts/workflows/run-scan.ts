// Implementation of `npm run workflows:scan` (the entry point is scan.ts): report secrets and PII-shaped strings in workflow
// files (PRD §16.7 WF-11). With no path it scans every workflow in content/workflows/.
// Prints `<line>: <rule-id>` (never the matched text). Exit 0 when clean, 1 on any finding or unreadable file.
// The scan never offers to be skipped.
import { existsSync } from "node:fs";
import path from "node:path";
import { listWorkflowFiles } from "./load";
import { scanFile, type GitleaksRunner } from "./scan-file";
import { formatFinding } from "./scan-rules";

export interface ScanCliResult {
  exitCode: number;
  stdout: string[];
  stderr: string[];
}

export async function runScan(args: string[], opts: { contentDir: string; gitleaks?: GitleaksRunner | "off" }): Promise<ScanCliResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const files = args.length > 0 ? args : listWorkflowFiles(opts.contentDir);
  const prefix = files.length > 1;
  let problems = 0;
  const warned = new Set<string>();

  for (const file of files) {
    if (!existsSync(file)) {
      stderr.push(`workflows:scan: ${file}: no such file`);
      problems++;
      continue;
    }
    const r = await scanFile(file, { gitleaks: opts.gitleaks });
    for (const w of r.warnings) {
      if (!warned.has(w)) stderr.push(`workflows:scan: warning: ${w}`);
      warned.add(w);
    }
    // Finding lines keep the exact `<line>: <rule-id>` shape (W3 parses them); a `# <path>` line says which file they belong to.
    if (prefix && r.findings.length > 0) stderr.push(`# ${path.relative(process.cwd(), file)}`);
    for (const f of r.findings) {
      stderr.push(formatFinding(f));
      problems++;
    }
  }

  if (problems === 0) stdout.push(`workflows:scan: ${files.length} file(s) clean.`);
  else stderr.push(`workflows:scan: ${problems} problem(s). Remove findings (and rotate anything real) before sharing; the matched text is not printed.`);
  return { exitCode: problems === 0 ? 0 : 1, stdout, stderr };
}
