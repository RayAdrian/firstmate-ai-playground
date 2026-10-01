// `npm run db:reset:test [-- --variant=<name>]`: wipe local Supabase and load the deterministic E2E fixtures (PRD S-5).
// Fixture contents are documented in tests/fixtures/README.md. Refuses to run against a non-local database.
import path from "node:path";
import { getServiceClient } from "../../src/lib/db/service";
import { VARIANTS, buildVariant, type VariantData } from "../../tests/fixtures/news";
import { applyContent } from "./lib/apply";
import { requireServiceEnv } from "./lib/env";
import { workflowsClient } from "./lib/workflows-db";
import { seedFixtureWorkflows } from "./lib/workflows-fixtures";
import { formatIssues } from "./lib/issues";
import { loadContent } from "./lib/load";
import { assertLocalSupabase } from "./lib/local-guard";
import { applyLocalRoles } from "../db/local-roles";

/** The fixed test clock (docs/test-cases README 4.1). Fixture rows never depend on the real clock. */
const FM_TEST_NOW = new Date("2026-09-30T13:00:00+08:00");
const FIXTURE_CONTENT = path.resolve(process.cwd(), "tests/fixtures/content/content-valid");

function readVariantName(argv: string[]): string {
  const i = argv.findIndex((a) => a === "--variant" || a.startsWith("--variant="));
  if (i === -1) return "fx-base";
  const arg = argv[i] ?? "";
  return arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : (argv[i + 1] ?? "");
}

async function main(): Promise<number> {
  const name = readVariantName(process.argv.slice(2));
  if (!(name in VARIANTS)) {
    console.error(`db:reset:test: unknown variant '${name}'. Valid variants: ${Object.keys(VARIANTS).join(", ")}`);
    return 1;
  }
  assertLocalSupabase(process.env.SUPABASE_URL);
  requireServiceEnv();
  // Idempotent: the community_writer role is created NOLOGIN by the migration; its local login lives in seed.sql (PRD 18.4).
  try {
    await applyLocalRoles();
  } catch (err) {
    console.warn(`db:reset:test: could not set the local community_writer login (${err instanceof Error ? err.message : "unknown error"}); community writes will fail until \`npm run db:local-roles\` succeeds.`);
  }
  const variant: VariantData = buildVariant(name);
  const db = getServiceClient();

  // Validate the fixture curriculum before wiping anything.
  const content = variant.content
    ? loadContent({
        contentDir: path.join(FIXTURE_CONTENT, "content"),
        exercisesDir: path.join(FIXTURE_CONTENT, "exercises"),
        now: FM_TEST_NOW,
      })
    : null;
  if (content && content.issues.length > 0) {
    console.error("db:reset:test: fixture content is invalid:");
    console.error(formatIssues(content.issues));
    return 1;
  }

  let workflowCount = 0;

  // Wipe in FK order. news_sources baseline rows go too: fixtures own the table.
  for (const table of ["news_items", "ingest_runs", "exercises", "lessons", "levels", "news_sources"] as const) {
    const { error } = await db.from(table).delete().not("id", "is", null);
    if (error) throw new Error(`could not clear ${table}: ${error.message}`);
  }
  const { error: wfClearError } = await workflowsClient(db).from("workflows").delete().not("id", "is", null);
  if (wfClearError) throw new Error(`could not clear workflows: ${wfClearError.message}`);

  if (content) {
    await applyContent(db, content, FM_TEST_NOW);
    const { data: level2, error } = await db.from("levels").select("id").eq("number", 2).single();
    if (error) throw new Error(`could not find fixture level 2: ${error.message}`);
    const { error: retiredError } = await db.from("lessons").insert({
      level_id: level2.id,
      slug: "l2-retired",
      sort: 3,
      title: "Retired lesson",
      objective: "Archived fixture: must never render.",
      est_minutes: 5,
      concept_md: "Retired.",
      claude_md: "Retired.",
      codex_md: "Retired.",
      differences: ["Retired."],
      tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" },
      last_verified_on: "2026-06-01",
      content_hash: "fixture-l2-retired",
      archived_at: "2026-09-01T00:00:00+08:00",
      updated_at: "2026-09-01T00:00:00+08:00",
    });
    if (retiredError) throw new Error(`could not insert l2-retired: ${retiredError.message}`);
    workflowCount = await seedFixtureWorkflows(db, { fixtureContent: path.join(FIXTURE_CONTENT, "content"), now: FM_TEST_NOW });
  }

  if (variant.sources.length > 0) {
    const { error } = await db.from("news_sources").insert(variant.sources);
    if (error) throw new Error(`could not insert news sources: ${error.message}`);
  }
  const { data: sources, error: sourcesError } = await db.from("news_sources").select("id, slug");
  if (sourcesError) throw new Error(`could not read news sources: ${sourcesError.message}`);
  const sourceId = new Map(sources.map((s) => [s.slug, s.id]));

  if (variant.news.length > 0) {
    const rows = variant.news.map(({ alias, source_slug, ...item }) => {
      const id = sourceId.get(source_slug);
      if (!id) throw new Error(`fixture ${alias} references unknown source ${source_slug}`);
      return { ...item, source_id: id };
    });
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await db.from("news_items").insert(rows.slice(i, i + 50));
      if (error) throw new Error(`could not insert news items: ${error.message}`);
    }
  }
  if (variant.runs.length > 0) {
    const { error } = await db.from("ingest_runs").insert(variant.runs.map(({ alias, ...run }) => (void alias, run)));
    if (error) throw new Error(`could not insert ingest runs: ${error.message}`);
  }

  console.log(
    `db:reset:test: loaded ${name} (${content?.levels.length ?? 0} levels, ${content ? content.lessons.length + 1 : 0} lessons incl. 1 archived, ` +
      `${content?.exercises.length ?? 0} exercises, ${workflowCount} workflows, ${variant.sources.length} sources, ${variant.news.length} news items, ${variant.runs.length} runs).`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`db:reset:test: ${err instanceof Error ? err.message : "unexpected error"}`);
    process.exit(1);
  },
);
