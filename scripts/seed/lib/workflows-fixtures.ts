// The 6 E2E fixture workflows loaded by `npm run db:reset:test` (PRD §16.8). They go through the real seed path, so a fixture
// that fails validation fails the reset. Attribution is fixed (no git), so two resets are identical.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Database } from "../../../src/lib/db/types";
import { formatWorkflowIssue } from "../../workflows/load";
import { seedWorkflows, supabaseWorkflowStore } from "./workflows";

export const FIXTURE_AUTHOR = "Fixture Author";
export const FIXTURE_REVIEWED_ON = "2026-09-29";

/**
 * `fixtureContent` is the fixture content dir (it holds lessons/, so related_lesson resolves). The workflow files come from
 * tests/fixtures/workflows/e2e/ and the taxonomy from the real content/workflows/_taxonomy.yaml.
 */
export async function seedFixtureWorkflows(db: SupabaseClient<Database>, opts: { fixtureContent: string; now: Date; repoRoot?: string }): Promise<number> {
  const root = opts.repoRoot ?? process.cwd();
  const source = path.join(root, "tests/fixtures/workflows/e2e");
  if (!existsSync(source)) return 0;
  const tmp = mkdtempSync(path.join(tmpdir(), "fm-wf-fixtures-"));
  try {
    const contentDir = path.join(tmp, "content");
    mkdirSync(path.join(contentDir, "workflows"), { recursive: true });
    cpSync(source, path.join(contentDir, "workflows"), { recursive: true });
    cpSync(path.join(root, "content/workflows/_taxonomy.yaml"), path.join(contentDir, "workflows/_taxonomy.yaml"));
    cpSync(path.join(opts.fixtureContent, "lessons"), path.join(contentDir, "lessons"), { recursive: true });

    const r = await seedWorkflows(supabaseWorkflowStore(db), {
      contentDir,
      now: opts.now,
      meta: () => ({ author_name: FIXTURE_AUTHOR, reviewed_on: FIXTURE_REVIEWED_ON }),
    });
    if (r.skipped.length > 0) throw new Error(`fixture workflows are invalid:\n${r.skipped.map((i) => `  ${formatWorkflowIssue(i)}`).join("\n")}`);
    return r.inserted;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
