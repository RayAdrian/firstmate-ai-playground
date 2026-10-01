import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll } from "vitest";
import type { WorkflowValidationContext } from "../../../src/lib/contracts";

export const WF_FIXTURES = path.resolve(__dirname, "../../fixtures/workflows");
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const FM_NOW = new Date("2026-09-30T13:00:00+08:00");

/** Same values as content/workflows/_taxonomy.yaml plus two fixture lessons. */
export const CTX: WorkflowValidationContext = {
  useCases: ["planning", "review", "testing", "refactoring", "debugging", "parallel-work", "ci-and-gates", "security", "context", "automation"],
  stacks: ["any", "nextjs", "react", "typescript", "node", "supabase", "postgres", "python", "github-actions"],
  lessonSlugs: ["l1-first-session", "l1-permissions"],
  today: "2026-09-30",
};

export const readFixture = (...rel: string[]): string => readFileSync(path.join(WF_FIXTURES, ...rel), "utf8");
export const VALID = readFixture("valid", "gate-status-per-commit.md");

const made: string[] = [];
afterAll(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

export function tmpDir(prefix = "fm-wf-"): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

/** A sandbox content dir: content/levels.yaml-less, with the real taxonomy and two fixture lessons. */
export function contentSandbox(workflows: Record<string, string> = {}): { root: string; contentDir: string; workflowsDir: string } {
  const root = tmpDir();
  const contentDir = path.join(root, "content");
  const workflowsDir = path.join(contentDir, "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  cpSync(path.join(REPO_ROOT, "content/workflows/_taxonomy.yaml"), path.join(workflowsDir, "_taxonomy.yaml"));
  cpSync(path.join(__dirname, "../../fixtures/content/content-valid/content/lessons"), path.join(contentDir, "lessons"), { recursive: true });
  for (const [name, text] of Object.entries(workflows)) writeFileSync(path.join(workflowsDir, name), text);
  return { root, contentDir, workflowsDir };
}
