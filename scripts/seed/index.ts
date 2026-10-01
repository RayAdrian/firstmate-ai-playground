// `npm run seed`: validate content/ and exercises/, then upsert into local Supabase (PRD S-1..S-4).
// `npm run seed -- --dry-run` validates only (no database, no key needed).
import { existsSync } from "node:fs";
import { getServiceClient } from "../../src/lib/db/service";
import { applyContent, sumCounts } from "./lib/apply";
import { readSeedEnv, requireServiceEnv } from "./lib/env";
import { formatIssues } from "./lib/issues";
import { loadContent } from "./lib/load";
import { seedWorkflows, supabaseWorkflowStore } from "./lib/workflows";
import { formatWorkflowIssue, loadWorkflows } from "../workflows/load";

async function main(): Promise<number> {
  const dryRun = process.argv.includes("--dry-run");
  const env = readSeedEnv();

  if (!existsSync(env.contentDir)) {
    console.warn(`seed: ${env.contentDir} does not exist; nothing to seed.`);
    return 0;
  }

  const content = loadContent({ contentDir: env.contentDir, exercisesDir: env.exercisesDir, now: env.now });

  if (content.warnings.length > 0) {
    console.warn(`seed: ${content.warnings.length} warning(s):`);
    console.warn(formatIssues(content.warnings));
  }
  if (content.issues.length > 0) {
    console.error(`seed: ${content.issues.length} validation error(s); nothing was written:`);
    console.error(formatIssues(content.issues));
    return 1;
  }

  const summary = `${content.levels.length} levels, ${content.lessons.length} lessons, ${content.exercises.length} exercises`;
  if (dryRun) {
    // A bad workflow never blocks the seed (PRD §16.7 WF-42): report it, keep the exit code.
    const wf = loadWorkflows({ contentDir: env.contentDir, now: env.now });
    for (const i of wf.issues) console.warn(`seed: would skip ${formatWorkflowIssue(i)}`);
    console.log(`seed: dry run OK (${summary}, ${wf.workflows.length} workflows valid, ${wf.issues.length} problem(s)); nothing written.`);
    return 0;
  }

  requireServiceEnv();
  const db = getServiceClient();
  const { error: reachError } = await db.from("levels").select("id").limit(1);
  if (reachError) {
    console.error(`seed: cannot reach the local database: ${reachError.message}`);
    console.error("Run `supabase start` first.");
    return 1;
  }

  if (content.lessons.length === 0 && !process.argv.includes("--allow-archive-all")) {
    const { count, error } = await db.from("lessons").select("id", { count: "exact", head: true }).is("archived_at", null);
    if (error) throw new Error(`cannot count lessons: ${error.message}`);
    if ((count ?? 0) > 0) {
      console.error(`seed: the content tree has no lessons but the database has ${count} active; refusing to archive them all.`);
      console.error("Check CONTENT_DIR, or pass --allow-archive-all if that is intended.");
      return 1;
    }
  }

  const result = await applyContent(db, content, env.now);
  const t = sumCounts(result);
  console.log(`seed: ${t.inserted} inserted, ${t.updated} updated, ${t.archived} archived, ${t.restored} restored (${summary}).`);

  // Workflows: an invalid file is skipped with a warning and its row left unchanged; lessons above are already written.
  const wf = await seedWorkflows(supabaseWorkflowStore(db), { contentDir: env.contentDir, now: env.now });
  for (const i of wf.skipped) console.warn(`seed: skipped ${formatWorkflowIssue(i)}`);
  for (const w of wf.warnings) console.warn(`seed: ${w}`);
  console.log(
    `seed: workflows: ${wf.inserted} inserted, ${wf.updated} updated, ${wf.removed} removed, ${wf.restored} restored, ${wf.purged} purged (takedown), ${wf.skipped.length} skipped.`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`seed: ${err instanceof Error ? err.message : "unexpected error"}`);
    process.exit(1);
  },
);
