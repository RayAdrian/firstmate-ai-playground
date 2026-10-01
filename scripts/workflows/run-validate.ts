// Implementation of `npm run workflows:validate` (the entry point is validate.ts): check every file in content/workflows/
// against PRD §16.6 without a database (WF-1). `workflows:validate -- <file>...` checks just those files.
// Prints one `<path>: <field>: <reason>` line per problem to stderr. Exit 0 when everything is valid, 1 otherwise.
import { formatWorkflowIssue, listWorkflowFiles, loadWorkflows, validateWorkflowFiles, type WorkflowLoadOptions } from "./load";

export interface ValidateCliResult {
  exitCode: number;
  stdout: string[];
  stderr: string[];
}

export function runValidate(files: string[], opts: WorkflowLoadOptions): ValidateCliResult {
  const stdout: string[] = [];
  const stderr: string[] = [];

  let issues;
  let warnings;
  let checked: number;
  if (files.length > 0) {
    ({ issues, warnings } = validateWorkflowFiles(files, opts));
    checked = files.length;
  } else {
    const loaded = loadWorkflows(opts);
    ({ issues, warnings } = loaded);
    checked = listWorkflowFiles(opts.contentDir).length;
  }

  for (const w of warnings) stdout.push(`warning: ${formatWorkflowIssue(w)}`);
  if (issues.length > 0) {
    for (const i of issues) stderr.push(formatWorkflowIssue(i));
    stderr.push(`workflows:validate: ${issues.length} problem(s) in ${checked} file(s).`);
    return { exitCode: 1, stdout, stderr };
  }
  stdout.push(`workflows:validate: ${checked} workflow(s) valid.`);
  return { exitCode: 0, stdout, stderr };
}
