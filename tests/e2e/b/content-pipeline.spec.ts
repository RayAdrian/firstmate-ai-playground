/**
 * WS-B integration: seed, reset fixtures, RLS and content:stale against the LOCAL Supabase.
 *
 * These specs WIPE and reload the shared database, so they only run when FM_B_INTEGRATION=1 and must be run
 * under the db lock, on their own (never in parallel with other workstreams' e2e):
 *   db-lock.sh env FM_B_INTEGRATION=1 npx playwright test tests/e2e/b
 * They restore the fx-base fixtures when they finish.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  anonClient,
  contentSandbox,
  countRows,
  dumpTables,
  npmRun,
  serviceClient,
  TABLES,
  type Sandbox,
} from "./support";

test.describe.configure({ mode: "serial" });
test.skip(process.env.FM_B_INTEGRATION !== "1", "wipes the shared DB; run with FM_B_INTEGRATION=1 under the db lock");

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let sb: Sandbox;
test.beforeAll(() => {
  const r = npmRun("db:reset:test", ["--variant=fx-no-content"]);
  expect(r.code, r.stderr).toBe(0);
  sb = contentSandbox();
});
test.afterAll(() => {
  sb?.cleanup();
  const r = npmRun("db:reset:test");
  expect(r.code, r.stderr).toBe(0);
});

async function lesson(slug: string) {
  const { data, error } = await serviceClient().from("lessons").select("*").eq("slug", slug).single();
  expect(error).toBeNull();
  return data!;
}

test.describe("seed", () => {
  test("TC-B-50: refuses to run without the service-role key, and never prints it", async () => {
    const r = npmRun("seed", [], { ...sb.env, SUPABASE_SERVICE_ROLE_KEY: "" });
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain("SUPABASE_SERVICE_ROLE_KEY is required");
    expect(await countRows()).toMatchObject({ levels: 0, lessons: 0 });
  });

  test("tolerates a missing content directory", async () => {
    const r = npmRun("seed", [], { CONTENT_DIR: "/nonexistent/content", EXERCISES_DIR: "/nonexistent/exercises" });
    expect(r.code).toBe(0);
    expect(r.stderr + r.stdout).toContain("nothing to seed");
  });

  test("TC-B-01/05/21/24: seeds a valid tree", async () => {
    const r = npmRun("seed", [], sb.env);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("8 inserted, 0 updated, 0 archived");
    expect(r.stdout + r.stderr).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "no-key");

    const db = serviceClient();
    const { data: levels } = await db.from("levels").select("*").order("number");
    expect(levels?.map((l) => [l.number, l.slug, l.title, l.summary])).toEqual([
      [1, "l1", "Foundations", "One-line summary A"],
      [2, "l2", "Context engineering", "One-line summary B"],
    ]);
    const { data: lessons } = await db.from("lessons").select("*").order("slug");
    expect(lessons).toHaveLength(4);
    for (const l of lessons ?? []) {
      expect(l.id).toMatch(UUID_V4);
      expect(l.archived_at).toBeNull();
    }
    const first = await lesson("l1-first-session");
    expect(first).toMatchObject({ est_minutes: 20, last_verified_on: "2026-09-20", claude_no_equivalent: false, codex_no_equivalent: false });
    expect(first.tool_versions).toEqual({ claude_code: "2.1.0", codex_cli: "0.40.0" });
    expect(first.differences).toHaveLength(3);
    expect(first.concept_md).toContain(`echo "plain block"\n${"x".repeat(300)}`);
    const perms = await lesson("l1-permissions");
    expect(perms).toMatchObject({ codex_no_equivalent: true, codex_md: null, codex_workaround_md: "Workaround: use a sandbox profile" });
    const memory = await lesson("l2-memory");
    expect(memory.concept_md).toContain("<script>window.__xss=1</script>");
    expect(memory.concept_md).toContain('<img src=x onerror="window.__xss=2">');

    const { data: exercises } = await db.from("exercises").select("*").order("slug");
    expect(exercises?.map((e) => [e.slug, e.verify_cmd, e.repo_path])).toEqual([
      ["ex-fx-auto", "npm test", "exercises/ex-fx-auto/starter"],
      ["ex-fx-manual", null, "exercises/ex-fx-manual/starter"],
    ]);
    expect(exercises?.[0]?.checklist).toEqual([
      { id: "c1", text: "Test is green" },
      { id: "c2", text: "No test files edited" },
      { id: "c3", text: "Diff reviewed" },
    ]);
  });

  test("TC-B-26: a second run produces no diff", async () => {
    const before = await dumpTables();
    await new Promise((r) => setTimeout(r, 1100));
    const r = npmRun("seed", [], sb.env);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("0 inserted, 0 updated, 0 archived, 0 restored");
    expect(await dumpTables()).toBe(before);
  });

  test("TC-B-07: one invalid file writes nothing, even when another file changed", async () => {
    const before = await dumpTables();
    const bad = contentSandbox();
    try {
      bad.edit("content/lessons/l2/02-memory.md", (t) => t.replace("title: Memory", "title: Memory v2"));
      bad.edit("content/lessons/l1/02-permissions.md", (t) => t.replace("est_minutes: 15", 'est_minutes: "twenty"'));
      const r = npmRun("seed", [], bad.env);
      expect(r.code).not.toBe(0);
      expect(r.stderr).toContain("content/lessons/l1/02-permissions.md");
      expect(r.stderr).toContain("est_minutes");
      expect(await dumpTables()).toBe(before);
    } finally {
      bad.cleanup();
    }
  });

  test("TC-B-27: changing one field updates exactly one row", async () => {
    const before = await lesson("l2-context-files");
    const others = await dumpTables({ tables: ["levels", "exercises"] });
    await new Promise((r) => setTimeout(r, 50));
    sb.edit("content/lessons/l2/01-context-files.md", (t) => t.replace("title: Project instructions", "title: Project instructions (edited)"));
    const r = npmRun("seed", [], sb.env);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("0 inserted, 1 updated");
    const after = await lesson("l2-context-files");
    expect(after.title).toBe("Project instructions (edited)");
    expect(after.id).toBe(before.id);
    expect(after.content_hash).not.toBe(before.content_hash);
    expect(after.updated_at > before.updated_at).toBe(true);
    expect(await dumpTables({ tables: ["levels", "exercises"] })).toBe(others);
  });

  test("TC-B-28/29: a removed lesson is archived, and re-adding restores it with the same id", async () => {
    const original = await lesson("l2-memory");
    const before = await countRows();
    const file = "content/lessons/l2/02-memory.md";
    const abs = path.join(sb.root, file);
    const saved = readFileSync(abs, "utf8");
    sb.remove(file);

    let r = npmRun("seed", [], sb.env);
    expect(r.code, r.stderr).toBe(0);
    const archived = await lesson("l2-memory");
    expect(archived.id).toBe(original.id);
    expect(archived.archived_at).not.toBeNull();
    expect(await countRows()).toEqual(before);

    writeFileSync(abs, saved);
    r = npmRun("seed", [], sb.env);
    expect(r.code, r.stderr).toBe(0);
    expect(r.stdout).toContain("1 restored");
    const restored = await lesson("l2-memory");
    expect(restored.id).toBe(original.id);
    expect(restored.archived_at).toBeNull();

    r = npmRun("seed", [], sb.env);
    expect(r.stdout).toContain("0 inserted, 0 updated, 0 archived, 0 restored");
  });

  test("TC-B-30: removed exercise and removed level are archived", async () => {
    sb.remove("exercises/ex-fx-manual");
    sb.edit("content/lessons/l2/01-context-files.md", (t) => t.replace("exercise: ex-fx-manual\n", ""));
    let r = npmRun("seed", [], sb.env);
    expect(r.code, r.stderr).toBe(0);
    const db = serviceClient();
    const { data: ex } = await db.from("exercises").select("archived_at").eq("slug", "ex-fx-manual").single();
    expect(ex?.archived_at).not.toBeNull();

    sb.remove("content/lessons/l2");
    sb.edit("content/levels.yaml", (t) => t.slice(0, t.indexOf("  - number: 2")));
    r = npmRun("seed", [], sb.env);
    expect(r.code, r.stderr).toBe(0);
    const { data: level } = await db.from("levels").select("archived_at").eq("slug", "l2").single();
    expect(level?.archived_at).not.toBeNull();
    expect((await lesson("l2-context-files")).archived_at).not.toBeNull();
    expect((await lesson("l2-memory")).archived_at).not.toBeNull();
  });
});

test.describe("db:reset:test", () => {
  test("TC-B-35: refuses a non-local database", async () => {
    const r = npmRun("db:reset:test", [], { SUPABASE_URL: "https://example.supabase.co" });
    expect(r.code).not.toBe(0);
    expect(r.stderr).toMatch(/local/);
  });

  test("TC-B-34: unknown variant fails and lists valid names", async () => {
    const before = await dumpTables();
    const r = npmRun("db:reset:test", ["--variant=does-not-exist"]);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain("fx-base");
    expect(await dumpTables()).toBe(before);
  });

  test("TC-B-32: fx-base loads exactly", async () => {
    const r = npmRun("db:reset:test");
    expect(r.code, r.stderr).toBe(0);
    expect(await countRows()).toEqual({ levels: 2, lessons: 5, exercises: 2, news_sources: 4, news_items: 30, ingest_runs: 4 });
    const db = serviceClient();
    const { data: items } = await db.from("news_items").select("scoring_status");
    const count = (s: string) => items?.filter((i) => i.scoring_status === s).length;
    expect([count("scored"), count("pending"), count("failed"), count("skipped")]).toEqual([24, 3, 2, 1]);
    const retired = await lesson("l2-retired");
    expect(retired.archived_at).not.toBeNull();
    const { data: runs } = await db.from("ingest_runs").select("status").order("started_at");
    expect(runs?.map((x) => x.status)).toEqual(["success", "partial", "success", "failed"]);
  });

  test("TC-B-33: reset is deterministic", async () => {
    const one = await dumpTables({ dropIds: true });
    const r = npmRun("db:reset:test");
    expect(r.code, r.stderr).toBe(0);
    expect(await dumpTables({ dropIds: true })).toBe(one);
  });

  test("TC-B-34: variants load their documented contents", async () => {
    const expected: Record<string, Partial<Record<(typeof TABLES)[number], number>>> = {
      "fx-no-content": { levels: 0, lessons: 0, exercises: 0, news_sources: 0, news_items: 0, ingest_runs: 0 },
      "fx-no-news": { levels: 2, lessons: 5, exercises: 2, news_items: 0, ingest_runs: 0 },
      "fx-news-lowbar": { news_items: 5, ingest_runs: 1 },
      "fx-news-archive-60": { news_items: 90, ingest_runs: 4 },
    };
    for (const [variant, counts] of Object.entries(expected)) {
      const r = npmRun("db:reset:test", [`--variant=${variant}`]);
      expect(r.code, `${variant}: ${r.stderr}`).toBe(0);
      expect(await countRows(), variant).toMatchObject(counts);
    }
    const r = npmRun("db:reset:test");
    expect(r.code, r.stderr).toBe(0);
  });
});

test.describe("RLS (TC-B-48/49)", () => {
  test("anon can read every table", async () => {
    const anon = anonClient();
    for (const t of TABLES) {
      const { data, error } = await anon.from(t).select("*").limit(1);
      expect(error, t).toBeNull();
      expect(data?.length, t).toBe(1);
    }
  });

  test("anon cannot write any table", async () => {
    const before = await dumpTables();
    const anon = anonClient();
    for (const t of TABLES) {
      const ins = await anon.from(t).insert({ slug: "hacked" } as never);
      expect(ins.error, `insert ${t}`).not.toBeNull();
      const upd = await anon.from(t).update({ title: "hacked" } as never).not("id", "is", null).select();
      expect(upd.error !== null || (upd.data?.length ?? 0) === 0, `update ${t}`).toBe(true);
      const del = await anon.from(t).delete().not("id", "is", null).select();
      expect(del.error !== null || (del.data?.length ?? 0) === 0, `delete ${t}`).toBe(true);
    }
    expect(await dumpTables()).toBe(before);
  });
});

test.describe("content:stale (TC-B-45/47)", () => {
  for (const now of ["2026-09-30T13:00:00+08:00", "2026-09-30T23:59:00+08:00", "2026-09-30T00:30:00+08:00"]) {
    test(`lists 61 days but not 60 days at ${now}`, async () => {
      const r = npmRun("content:stale", [], { FM_NOW: now });
      expect(r.code, r.stderr).toBe(0);
      expect(r.stdout).toContain("l1-permissions: last verified 61 days ago");
      expect(r.stdout).not.toContain("l2-context-files");
    });
  }

  test("skips the version check when there is no release data", async () => {
    const r = npmRun("content:stale", [], { FM_NOW: "2026-09-30T13:00:00+08:00" });
    expect(r.stdout).toContain("version check skipped");
  });

  test("--strict exits non-zero when something is stale", async () => {
    const r = npmRun("content:stale", ["--strict"], { FM_NOW: "2026-09-30T13:00:00+08:00" });
    expect(r.code).toBe(1);
  });
});
