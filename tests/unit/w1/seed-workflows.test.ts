// @vitest-environment node
import { createHash } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { seedWorkflows, type GitMetaProvider } from "../../../scripts/seed/lib/workflows";
import { FM_NOW, VALID, contentSandbox, readFixture } from "./helpers";
import { memoryStore } from "./memory-store";

const meta: GitMetaProvider = () => ({ author_name: "First Mate Stewards", reviewed_on: "2026-09-25" });
const seed = (store: ReturnType<typeof memoryStore>, contentDir: string, now = FM_NOW, m = meta) => seedWorkflows(store, { contentDir, now, meta: m });
const zero = { inserted: 0, updated: 0, removed: 0, restored: 0, purged: 0 };
const counts = (r: Awaited<ReturnType<typeof seed>>) => ({ inserted: r.inserted, updated: r.updated, removed: r.removed, restored: r.restored, purged: r.purged });

describe("seedWorkflows: upsert by slug (WF-42)", () => {
  it("inserts a row with every §16.8 column, attribution and the related lesson's level", async () => {
    const { contentDir } = contentSandbox({ "gate-status-per-commit.md": VALID });
    const store = memoryStore();
    const r = await seed(store, contentDir);
    expect(counts(r)).toEqual({ ...zero, inserted: 1 });

    const row = store.rows()[0]!;
    expect(row).toMatchObject({
      slug: "gate-status-per-commit",
      title: "Gate statuses pinned to one commit",
      tools: ["claude-code", "codex"],
      setup_kinds: ["context-file", "script"],
      related_lesson_slug: "l1-first-session",
      level: 1,
      verified_on: "2026-09-20",
      author_name: "First Mate Stewards",
      reviewed_on: "2026-09-25",
      removed_at: null,
    });
    expect(row.steps).toHaveLength(4);
    expect(row.setup).toHaveLength(2);
    expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("stores level null when there is no related lesson", async () => {
    const { contentDir } = contentSandbox({ "a-flow.md": VALID.replace("related_lesson: l1-first-session\n", "") });
    const store = memoryStore();
    await seed(store, contentDir);
    expect(store.rows()[0]).toMatchObject({ related_lesson_slug: null, level: null });
  });

  it("is idempotent: a second run writes nothing", async () => {
    const { contentDir } = contentSandbox({ "gate-status-per-commit.md": VALID, "other-flow.md": VALID.replace("Gate statuses pinned", "Gate verdicts pinned") });
    const store = memoryStore();
    await seed(store, contentDir);
    const before = JSON.stringify(store.rows());
    store.log.length = 0;
    const second = await seed(store, contentDir, new Date("2026-10-01T09:00:00+08:00"));
    expect(counts(second)).toEqual(zero);
    expect(store.log).toEqual([]);
    expect(JSON.stringify(store.rows())).toBe(before);
  });

  it("updates when the file changes and when attribution changes", async () => {
    const { contentDir, workflowsDir } = contentSandbox({ "gate-status-per-commit.md": VALID });
    const store = memoryStore();
    await seed(store, contentDir);
    writeFileSync(path.join(workflowsDir, "gate-status-per-commit.md"), VALID.replace("verified_on: 2026-09-20", "verified_on: 2026-09-28"));
    expect(counts(await seed(store, contentDir))).toEqual({ ...zero, updated: 1 });
    expect(store.rows()[0]?.verified_on).toBe("2026-09-28");
    expect(counts(await seed(store, contentDir, FM_NOW, () => ({ author_name: "First Mate Stewards", reviewed_on: "2026-09-29" })))).toEqual({ ...zero, updated: 1 });
  });

  it("an invalid file is skipped with its path and reason, its row is untouched, and the rest still seeds", async () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID, "bad-one.md": VALID });
    const store = memoryStore();
    await seed(store, contentDir);
    const badBefore = JSON.stringify(store.rows().find((r) => r.slug === "bad-one"));

    writeFileSync(path.join(workflowsDir, "bad-one.md"), readFixture("invalid", "client-safe-yes.md"));
    writeFileSync(path.join(workflowsDir, "good-one.md"), VALID.replace("verified_on: 2026-09-20", "verified_on: 2026-09-21"));
    const r = await seed(store, contentDir);

    expect(counts(r)).toEqual({ ...zero, updated: 1 });
    expect(r.skipped.map((i) => [i.file, i.field])).toEqual([["content/workflows/bad-one.md", "client_safe"]]);
    expect(JSON.stringify(store.rows().find((x) => x.slug === "bad-one"))).toBe(badBefore);
    expect(store.rows().find((x) => x.slug === "bad-one")?.removed_at).toBeNull();
    expect(store.rows().find((x) => x.slug === "good-one")?.verified_on).toBe("2026-09-21");
  });

  it("sets removed_at when the file is deleted, keeps the row, and restores it with the same id", async () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID });
    const store = memoryStore();
    await seed(store, contentDir);
    const id = store.rows()[0]!.id;

    rmSync(path.join(workflowsDir, "good-one.md"));
    expect(counts(await seed(store, contentDir))).toEqual({ ...zero, removed: 1 });
    expect(store.rows()[0]?.removed_at).toBe(FM_NOW.toISOString());
    expect(counts(await seed(store, contentDir))).toEqual(zero); // already removed: no second write

    writeFileSync(path.join(workflowsDir, "good-one.md"), VALID);
    expect(counts(await seed(store, contentDir))).toEqual({ ...zero, restored: 1 });
    expect(store.rows()[0]).toMatchObject({ id, removed_at: null });
  });
});

describe("seedWorkflows: takedown purge (WF-43)", () => {
  const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

  it("stores the sha-256 of the file text as content_hash", async () => {
    const { contentDir } = contentSandbox({ "good-one.md": VALID });
    const store = memoryStore();
    await seed(store, contentDir);
    expect(store.rows()[0]?.content_hash).toBe(hashOf(VALID));
  });

  it("hard-deletes a row whose content_hash is listed in _takedowns.txt", async () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID, "keep-me.md": VALID.replace("Gate statuses", "Gate verdicts") });
    const store = memoryStore();
    await seed(store, contentDir);
    expect(store.rows()).toHaveLength(2);

    rmSync(path.join(workflowsDir, "good-one.md"));
    writeFileSync(path.join(workflowsDir, "_takedowns.txt"), `# runbook entry\n\n${hashOf(VALID)}\n`);
    const r = await seed(store, contentDir);

    expect(r.purged).toBe(1);
    expect(store.rows().map((x) => x.slug)).toEqual(["keep-me"]);
    expect(store.log).toContain("delete good-one");
  });

  it("purges the row and does not re-insert a file that still carries a listed hash", async () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID });
    const store = memoryStore();
    await seed(store, contentDir);
    const v2 = VALID.replace("2026-09-20", "2026-09-22");
    writeFileSync(path.join(workflowsDir, "good-one.md"), v2);
    await seed(store, contentDir);

    writeFileSync(path.join(workflowsDir, "_takedowns.txt"), `${hashOf(v2)}\n`);
    const r = await seed(store, contentDir);
    expect(r.purged).toBe(1);
    expect(store.rows()).toEqual([]); // and the listed file is not re-inserted
    expect(r.warnings.join("\n")).toMatch(/good-one\.md.*takedown/i);
  });

  it("matches the hash of the LF-normalised text, so a CRLF checkout is still purged", async () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID });
    const store = memoryStore();
    await seed(store, contentDir);
    writeFileSync(path.join(workflowsDir, "good-one.md"), VALID.replace(/\n/g, "\r\n"));
    writeFileSync(path.join(workflowsDir, "_takedowns.txt"), `${hashOf(VALID)}\n`);
    expect((await seed(store, contentDir)).purged).toBe(1);
  });

  it("warns on a malformed line and ignores it, upper-case hashes are accepted", async () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID });
    const store = memoryStore();
    await seed(store, contentDir);
    writeFileSync(path.join(workflowsDir, "_takedowns.txt"), `acme-deploy\n${hashOf(VALID).toUpperCase()}\n`);
    const r = await seed(store, contentDir);
    expect(r.warnings.join("\n")).toMatch(/_takedowns\.txt:1: not a sha-256/);
    expect(r.purged).toBe(1);
  });
});

describe("seedWorkflows: taxonomy trouble never blocks anything else", () => {
  it("skips every workflow, leaves rows alone and removes nothing when _taxonomy.yaml is broken", async () => {
    const { contentDir, workflowsDir } = contentSandbox({ "good-one.md": VALID });
    const store = memoryStore();
    await seed(store, contentDir);
    writeFileSync(path.join(workflowsDir, "_taxonomy.yaml"), "use_cases: [\n");
    const r = await seed(store, contentDir);
    expect(counts(r)).toEqual(zero);
    expect(r.skipped.length).toBeGreaterThan(0);
    expect(store.rows()[0]?.removed_at).toBeNull();
  });
});
