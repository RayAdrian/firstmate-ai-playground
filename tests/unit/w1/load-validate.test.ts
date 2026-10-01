// @vitest-environment node
import { execFile } from "node:child_process";
import { mkdirSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { formatWorkflowIssue, loadWorkflows, readLessonIndex } from "../../../scripts/workflows/load";
import { runValidate } from "../../../scripts/workflows/run-validate";
import { FM_NOW, REPO_ROOT, VALID, WF_FIXTURES, contentSandbox, readFixture } from "./helpers";

const run = promisify(execFile);

const invalidFixtures = (): Record<string, string> =>
  Object.fromEntries(readdirSync(path.join(WF_FIXTURES, "invalid")).map((f) => [f, readFixture("invalid", f)]));

describe("loadWorkflows", () => {
  it("loads a valid workflow with its level taken from the related lesson folder", () => {
    const { contentDir } = contentSandbox({ "gate-status-per-commit.md": VALID });
    const r = loadWorkflows({ contentDir, now: FM_NOW });
    expect(r.issues).toEqual([]);
    expect(r.workflows.map((w) => w.slug)).toEqual(["gate-status-per-commit"]);
    expect(r.levelBySlug.get("l1-first-session")).toBe(1);
    expect([...r.presentSlugs]).toEqual(["gate-status-per-commit"]);
  });

  it("is a no-op when content/workflows does not exist", () => {
    const { contentDir, workflowsDir } = contentSandbox();
    expect(workflowsDir).toBeTruthy();
    const r = loadWorkflows({ contentDir: path.join(contentDir, "nowhere"), now: FM_NOW });
    expect(r).toMatchObject({ workflows: [], issues: [] });
  });

  it("collects every issue at once and keeps invalid slugs as present", () => {
    const { contentDir } = contentSandbox({ ...Object.fromEntries(Object.entries(invalidFixtures())), "good-one.md": VALID });
    const r = loadWorkflows({ contentDir, now: FM_NOW });
    expect(r.workflows.map((w) => w.slug)).toEqual(["good-one"]);
    expect(r.issues.length).toBeGreaterThanOrEqual(11);
    expect(r.presentSlugs.size).toBe(12);
  });

  it("ignores _TEMPLATE.md, _taxonomy.yaml and _takedowns.txt", () => {
    const { contentDir } = contentSandbox({ "_TEMPLATE.md": "not a workflow", "_takedowns.txt": "", "a-flow.md": VALID });
    const r = loadWorkflows({ contentDir, now: FM_NOW });
    expect(r.issues).toEqual([]);
    expect(r.workflows).toHaveLength(1);
  });

  it("rejects a symlink, a subfolder, a stray non-.md file and an unknown _ file", () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID, "_notes.md": "x", "notes.txt": "x" });
    symlinkSync(path.join(workflowsDir, "good-one.md"), path.join(workflowsDir, "linked.md"));
    mkdirSync(path.join(workflowsDir, "sub"));
    writeFileSync(path.join(workflowsDir, "sub", "inner.md"), VALID);
    const r = loadWorkflows({ contentDir, now: FM_NOW });
    const byFile = Object.fromEntries(r.issues.map((i) => [path.basename(i.file), i.reason]));
    expect(byFile["linked.md"]).toMatch(/symlink/);
    expect(byFile["sub"]).toMatch(/subfolder/);
    expect(byFile["notes.txt"]).toMatch(/only .*\.md/);
    expect(byFile["_notes.md"]).toMatch(/not a known config file/);
    expect(r.issues.every((i) => i.field === "structure")).toBe(true);
    expect(r.workflows.map((w) => w.slug)).toEqual(["good-one"]);
  });

  it("reports a missing taxonomy once and validates nothing else against it", () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID });
    writeFileSync(path.join(workflowsDir, "_taxonomy.yaml"), "use_cases: []\n");
    const r = loadWorkflows({ contentDir, now: FM_NOW });
    expect(r.workflows).toEqual([]);
    expect(r.issues.map((i) => path.basename(i.file))).toContain("_taxonomy.yaml");
    expect(r.presentSlugs.has("good-one")).toBe(true);
  });

  it("uses today in Manila for the future-date rule", () => {
    const { contentDir } = contentSandbox({ "a-flow.md": VALID.replace("2026-09-20", "2026-09-30") });
    expect(loadWorkflows({ contentDir, now: new Date("2026-09-30T00:30:00+08:00") }).issues).toEqual([]);
    expect(loadWorkflows({ contentDir, now: new Date("2026-09-29T20:00:00Z") }).issues).toEqual([]); // 04:00 Manila on the 30th
    expect(loadWorkflows({ contentDir, now: new Date("2026-09-29T10:00:00Z") }).issues.map((i) => i.field)).toEqual(["verified_on"]); // 18:00 Manila on the 29th
  });

  it("readLessonIndex maps lesson slugs to their level folder", () => {
    const { contentDir } = contentSandbox();
    const idx = readLessonIndex(contentDir);
    expect(idx.get("l1-first-session")).toBe(1);
    expect(idx.get("l2-memory")).toBe(2);
  });
});

describe("workflows:validate (WF-1)", () => {
  it("exits 0 and says so when every file is valid", () => {
    const { contentDir } = contentSandbox({ "good-one.md": VALID });
    const r = runValidate([], { contentDir, now: FM_NOW });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.join("\n")).toMatch(/1 workflow\(s\) valid/);
    expect(r.stderr).toEqual([]);
  });

  it("exits 1 and prints one '<path>: <field>: <reason>' line per problem", () => {
    const { contentDir } = contentSandbox({ "client-safe-yes.md": readFixture("invalid", "client-safe-yes.md") });
    const r = runValidate([], { contentDir, now: FM_NOW });
    expect(r.exitCode).toBe(1);
    const lines = r.stderr.filter((l) => /client_safe/.test(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^content\/workflows\/client-safe-yes\.md: client_safe: must be exactly `confirmed`$/);
  });

  it("validates explicit paths, so the template can be checked on its own", () => {
    const { contentDir, workflowsDir } = contentSandbox({ "_TEMPLATE.md": VALID.replace("client_safe: confirmed", "client_safe: TODO") });
    const r = runValidate([path.join(workflowsDir, "_TEMPLATE.md")], { contentDir, now: FM_NOW });
    expect(r.exitCode).toBe(1);
    expect(r.stderr.join("\n")).toMatch(/client_safe/);
  });

  it("passes with no workflows at all", () => {
    const { contentDir } = contentSandbox();
    expect(runValidate([], { contentDir, now: FM_NOW }).exitCode).toBe(0);
  });

  it("the real CLI exits 1 on a bad file and 0 on a good one, with no database or env file", async () => {
    const good = contentSandbox({ "good-one.md": VALID });
    const bad = contentSandbox({ "client-safe-yes.md": readFixture("invalid", "client-safe-yes.md") });
    const tsx = path.join(REPO_ROOT, "node_modules/.bin/tsx");
    const env = (contentDir: string) => ({ ...process.env, CONTENT_DIR: contentDir, FM_NOW: FM_NOW.toISOString() });
    const ok = await run(tsx, ["scripts/workflows/validate.ts"], { cwd: REPO_ROOT, env: env(good.contentDir) });
    expect(ok.stdout).toMatch(/valid/);
    await expect(run(tsx, ["scripts/workflows/validate.ts"], { cwd: REPO_ROOT, env: env(bad.contentDir) })).rejects.toMatchObject({ code: 1 });
  }, 30_000);
});

describe("seed and validate agree (WF-2)", () => {
  it("feeds every invalid fixture to validate and to the seed ingest and gets the same failures", async () => {
    const { seedWorkflows } = await import("../../../scripts/seed/lib/workflows");
    const { memoryStore } = await import("./memory-store");
    const { contentDir } = contentSandbox({ ...invalidFixtures(), "good-one.md": VALID });

    const v = runValidate([], { contentDir, now: FM_NOW });
    const store = memoryStore();
    const seeded = await seedWorkflows(store, { contentDir, now: FM_NOW, meta: () => ({ author_name: "A", reviewed_on: null }) });

    const fromValidate = v.stderr.filter((l) => l.startsWith("content/")).sort();
    const fromSeed = seeded.skipped.map(formatWorkflowIssue).sort();
    expect(fromSeed).toEqual(fromValidate);
    expect(fromSeed.length).toBeGreaterThanOrEqual(11);
    expect(store.rows().map((r) => r.slug)).toEqual(["good-one"]);
  });
});
