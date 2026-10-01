// Display labels for workflow facets (PRD §16.6 taxonomy). Pure, safe on server and client.
// Unknown values (a steward may extend _taxonomy.yaml) fall back to a humanised slug.
import type { WorkflowSetupKind, WorkflowTool } from "@/lib/contracts";

export const WORKFLOW_TOOL_LABEL: Record<WorkflowTool, string> = {
  "claude-code": "Claude Code",
  codex: "Codex CLI",
};

export const KIND_LABEL: Record<WorkflowSetupKind, string> = {
  "context-file": "Context file",
  hook: "Hook",
  skill: "Skill",
  subagent: "Subagent",
  config: "Config",
  script: "Script",
};

/** Initial taxonomy (PRD §16.6). The filter lists these plus anything the data adds. */
export const KNOWN_USE_CASES = [
  "planning",
  "review",
  "testing",
  "refactoring",
  "debugging",
  "parallel-work",
  "ci-and-gates",
  "security",
  "context",
  "automation",
] as const;

export const KNOWN_STACKS = [
  "any",
  "nextjs",
  "react",
  "typescript",
  "node",
  "supabase",
  "postgres",
  "python",
  "github-actions",
] as const;

const FACET_LABEL: Record<string, string> = {
  "parallel-work": "Parallel work",
  "ci-and-gates": "CI and gates",
  any: "Any stack",
  nextjs: "Next.js",
  react: "React",
  typescript: "TypeScript",
  node: "Node.js",
  supabase: "Supabase",
  postgres: "Postgres",
  python: "Python",
  "github-actions": "GitHub Actions",
};

/** "ci-and-gates" -> "CI and gates"; unknown "my-thing" -> "My thing". */
export function facetLabel(value: string): string {
  const known = FACET_LABEL[value];
  if (known) return known;
  const spaced = value.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function kindLabel(kind: string): string {
  return (KIND_LABEL as Record<string, string>)[kind] ?? facetLabel(kind);
}
