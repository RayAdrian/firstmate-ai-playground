/** One validation finding. `file` is shown relative to the repo root (e.g. content/lessons/l1/a.md). */
export interface SeedIssue {
  file: string;
  /** 1-based line in `file`, when known. */
  line?: number;
  field: string;
  reason: string;
}

export function formatIssue(issue: SeedIssue): string {
  const where = issue.line ? `${issue.file}:${issue.line}` : issue.file;
  return `${where}: ${issue.field}: ${issue.reason}`;
}

export function formatIssues(issues: SeedIssue[]): string {
  return issues.map((i) => `  ${formatIssue(i)}`).join("\n");
}
