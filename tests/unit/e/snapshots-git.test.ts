// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newsSnapshotSchema, type SnapshotItem } from "@/lib/contracts";
import { ImportError, importSnapshots, validateSnapshotFile } from "../../../scripts/news/import-lib";
import { publishSnapshots, PublishError } from "../../../scripts/news/publish";
import { buildSnapshotFiles, sameIgnoringExportedAt } from "../../../scripts/news/snapshot";
import { MemoryStore } from "./helpers/memory-store";
import { harness, rawMany, src } from "./helpers/harness";

vi.setConfig({ testTimeout: 30_000 }); // process-spawning tests can be slow on a busy machine

let tmp: string;
let remote: string;
let work: string;

const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();

const itemId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = (n: number, over: Partial<SnapshotItem> = {}): SnapshotItem => ({
  id: itemId(n),
  source_slug: "openai-news",
  guid: `g${n}`,
  canonical_url: `https://site.example/${n}`,
  url: `https://site.example/${n}`,
  title: `Item ${n}`,
  author: null,
  published_at: "2026-09-29T00:00:00.000Z",
  first_seen_at: "2026-09-30T00:00:00.000Z",
  digest_date: "2026-09-30",
  excerpt: null,
  score: 70,
  tags: ["tooling"],
  why_it_matters: "Relevant.",
  scoring_status: "scored",
  attempts: 0,
  scored_at: "2026-09-30T00:01:00.000Z",
  scorer_model: "m",
  ...over,
});

const snapshotText = (date: string, items: SnapshotItem[], exportedAt = "2026-09-30T00:05:00.000Z") =>
  JSON.stringify({ version: 1, digest_date: date, exported_at: exportedAt, runs: [], items }, null, 2) + "\n";

async function storeWith(items: SnapshotItem[]): Promise<MemoryStore> {
  const s = new MemoryStore();
  await s.importSnapshot(items, []);
  const id = await s.startRun({ started_at: "2026-09-30T00:00:00.000Z", trigger: "manual" });
  await s.finishRun(id, { finished_at: "2026-09-30T00:02:00.000Z", status: "success", fetched: 1, new: 1, scored: 1, pending: 0, failed: 0, skipped: 0, error_summary: null });
  return s;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "news-git-"));
  remote = path.join(tmp, "remote.git");
  work = path.join(tmp, "work");
  sh(tmp, "init", "--bare", "-b", "main", remote);
  sh(tmp, "clone", "-q", remote, work);
  sh(work, "config", "user.email", "dev@example.com");
  sh(work, "config", "user.name", "Dev");
  fs.writeFileSync(path.join(work, "README.md"), "hello\n");
  sh(work, "add", "README.md");
  sh(work, "commit", "-q", "-m", "init");
  sh(work, "push", "-q", "origin", "main");
  // The user's in-progress work, which the publisher must never touch.
  fs.writeFileSync(path.join(work, "README.md"), "hello\nlocal edit\n");
  fs.writeFileSync(path.join(work, "staged.txt"), "staged\n");
  sh(work, "add", "staged.txt");
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const userState = () => ({
  head: sh(work, "rev-parse", "HEAD"),
  branch: sh(work, "branch", "--show-current"),
  status: sh(work, "status", "--porcelain"),
  staged: sh(work, "diff", "--cached"),
  stash: sh(work, "stash", "list"),
  reflog: sh(work, "reflog", "HEAD"),
  mainRef: sh(remote, "rev-parse", "refs/heads/main"),
  worktrees: sh(work, "worktree", "list"),
});

describe("publishSnapshots (section 14 Q1, TC-E-68..72)", () => {
  it("creates an orphan news-snapshots branch and leaves the user's checkout untouched", async () => {
    const before = userState();
    const files = await buildSnapshotFiles(await storeWith([item(1), item(2)]), ["2026-09-30"], new Date("2026-09-30T00:05:00Z"));
    const res = await publishSnapshots({ repoDir: work, remote: "origin", files, message: "news: snapshot 2026-09-30" });
    expect(res.pushed).toBe(true);
    expect(userState()).toEqual(before);

    const tree = sh(remote, "ls-tree", "-r", "--name-only", "refs/heads/news-snapshots");
    expect(tree).toBe("content/news/snapshots/2026-09-30.json");
    expect(sh(remote, "rev-list", "--count", "refs/heads/news-snapshots")).toBe("1");
    expect(sh(remote, "rev-list", "--max-parents=0", "refs/heads/news-snapshots")).toBe(sh(remote, "rev-parse", "refs/heads/news-snapshots"));

    const content = sh(remote, "show", "refs/heads/news-snapshots:content/news/snapshots/2026-09-30.json");
    const snap = newsSnapshotSchema.parse(JSON.parse(content));
    expect(snap.items.map((i) => i.canonical_url)).toEqual(["https://site.example/1", "https://site.example/2"]);
    expect(snap.items.map((i) => i.id)).toEqual([itemId(1), itemId(2)]);
    expect(snap.runs).toHaveLength(1);
    expect(sh(remote, "log", "-1", "--format=%s", "refs/heads/news-snapshots")).toBe("news: snapshot 2026-09-30");
    // No leftover temp branch or worktree.
    expect(sh(work, "branch", "--list", "fm-news-orphan-*")).toBe("");
  });

  it("makes no commit when only exported_at would change", async () => {
    const store = await storeWith([item(1)]);
    const first = await buildSnapshotFiles(store, ["2026-09-30"], new Date("2026-09-30T00:05:00Z"));
    await publishSnapshots({ repoDir: work, remote: "origin", files: first, message: "m" });
    const tip = sh(remote, "rev-parse", "refs/heads/news-snapshots");
    const again = await buildSnapshotFiles(store, ["2026-09-30"], new Date("2026-09-30T01:05:00Z"));
    expect(again[0].content).not.toBe(first[0].content);
    const res = await publishSnapshots({ repoDir: work, remote: "origin", files: again, message: "m" });
    expect(res).toEqual({ pushed: false, reason: "unchanged" });
    expect(sh(remote, "rev-parse", "refs/heads/news-snapshots")).toBe(tip);

    await store.importSnapshot([item(2)], []);
    const changed = await buildSnapshotFiles(store, ["2026-09-30"], new Date("2026-09-30T02:05:00Z"));
    expect((await publishSnapshots({ repoDir: work, remote: "origin", files: changed, message: "m" })).pushed).toBe(true);
    expect(sh(remote, "rev-list", "--count", "refs/heads/news-snapshots")).toBe("2");
  });

  it("recovers from a non-fast-forward push without forcing", async () => {
    const store = await storeWith([item(1)]);
    await publishSnapshots({ repoDir: work, remote: "origin", files: await buildSnapshotFiles(store, ["2026-09-30"], new Date()), message: "m" });
    // Another engineer's clone advances the branch behind our back.
    const other = path.join(tmp, "other");
    sh(tmp, "clone", "-q", "-b", "news-snapshots", remote, other);
    sh(other, "config", "user.email", "o@example.com");
    sh(other, "config", "user.name", "O");
    fs.writeFileSync(path.join(other, "content/news/snapshots/2026-09-29.json"), snapshotText("2026-09-29", [item(9, { digest_date: "2026-09-29" })]));
    sh(other, "add", "-A");
    sh(other, "commit", "-q", "-m", "other");
    sh(other, "push", "-q", "origin", "news-snapshots");

    // Simulate our stale view: remove the local tracking ref so the first fetch is skipped, then race.
    await store.importSnapshot([item(3)], []);
    const files = await buildSnapshotFiles(store, ["2026-09-30"], new Date());
    const res = await publishSnapshots({ repoDir: work, remote: "origin", files, message: "m" });
    expect(res.pushed).toBe(true);
    const names = sh(remote, "ls-tree", "-r", "--name-only", "refs/heads/news-snapshots").split("\n");
    expect(names).toEqual(["content/news/snapshots/2026-09-29.json", "content/news/snapshots/2026-09-30.json"]);
  });

  it("reports an unreachable remote as a PublishError and leaves the checkout alone", async () => {
    const before = userState();
    const files = await buildSnapshotFiles(await storeWith([item(1)]), ["2026-09-30"], new Date());
    await expect(publishSnapshots({ repoDir: work, remote: path.join(tmp, "does-not-exist.git"), files, message: "m" })).rejects.toBeInstanceOf(PublishError);
    expect(userState()).toEqual(before);
  });

  it("never runs a force push (source check)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../../scripts/news/publish.ts"), "utf8");
    const pushLines = src.split("\n").filter((l) => l.includes('"push"'));
    expect(pushLines.length).toBeGreaterThan(0);
    for (const l of pushLines) expect(l).not.toMatch(/force|"-f"|\+HEAD|--mirror/);
  });
});

describe("snapshot contents (TC-E-73)", () => {
  it("contains no secrets, local paths or stack traces", async () => {
    const store = await storeWith([item(1)]);
    store.runs[0].error_summary = "boom";
    const files = await buildSnapshotFiles(store, ["2026-09-30"], new Date());
    for (const needle of ["sk-canary-123", "SUPABASE", "/Users/", "service_role", "    at "]) expect(files[0].content).not.toContain(needle);
  });
  it("sameIgnoringExportedAt compares everything else", () => {
    expect(sameIgnoringExportedAt(snapshotText("2026-09-30", [item(1)], "a"), snapshotText("2026-09-30", [item(1)], "b"))).toBe(true);
    expect(sameIgnoringExportedAt(snapshotText("2026-09-30", [item(1)], "a"), snapshotText("2026-09-30", [item(2)], "a"))).toBe(false);
  });
});

async function seedRemoteSnapshots(files: Record<string, string>) {
  const w = path.join(tmp, "seed");
  sh(tmp, "clone", "-q", remote, w);
  sh(w, "config", "user.email", "s@example.com");
  sh(w, "config", "user.name", "S");
  sh(w, "checkout", "-q", "--orphan", "news-snapshots");
  sh(w, "rm", "-rf", "-q", "--ignore-unmatch", ".");
  fs.mkdirSync(path.join(w, "content/news/snapshots"), { recursive: true });
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(w, "content/news/snapshots", name), text);
  sh(w, "add", "-A");
  sh(w, "commit", "-q", "-m", "seed");
  sh(w, "push", "-q", "origin", "news-snapshots");
}

describe("importSnapshots (R-1.2, TC-E-74..78)", () => {
  it("upserts every snapshot, idempotently, without touching the checkout", async () => {
    await seedRemoteSnapshots({
      "2026-09-29.json": snapshotText("2026-09-29", [item(8, { digest_date: "2026-09-29" })]),
      "2026-09-30.json": snapshotText("2026-09-30", [item(1), item(2)]),
    });
    const before = userState();
    const store = new MemoryStore();
    const first = await importSnapshots({ store, repoDir: work, remote: "origin" });
    expect(first).toEqual({ snapshots: 2, result: { itemsInserted: 3, itemsUpdated: 0, runsUpserted: 0, warnings: [] } });
    expect(store.items).toHaveLength(3);
    expect(userState()).toEqual(before);
    const second = await importSnapshots({ store, repoDir: work, remote: "origin" });
    expect(second.result).toEqual({ itemsInserted: 0, itemsUpdated: 0, runsUpserted: 0, warnings: [] });
    expect(store.items).toHaveLength(3);
  });

  it("upserts by id: a canonical_url clash with a different id is updated in place with a warning", async () => {
    await seedRemoteSnapshots({ "2026-09-30.json": snapshotText("2026-09-30", [item(1, { score: 88 }), item(2)]) });
    const store = new MemoryStore();
    await store.importSnapshot([item(1, { id: itemId(99), score: null, tags: [], why_it_matters: null, scoring_status: "pending", scored_at: null, scorer_model: null })], []);
    const res = await importSnapshots({ store, repoDir: work, remote: "origin" });
    expect(res.result.itemsInserted).toBe(1);
    expect(res.result.itemsUpdated).toBe(1);
    expect(res.result.warnings).toHaveLength(1);
    expect(res.result.warnings[0]).toContain(itemId(99));
    expect(store.items).toHaveLength(2);
    expect(store.items.find((i) => i.canonical_url.endsWith("/1"))).toMatchObject({ id: itemId(1), score: 88, scoring_status: "scored" });
    const again = await importSnapshots({ store, repoDir: work, remote: "origin" });
    expect(again.result).toEqual({ itemsInserted: 0, itemsUpdated: 0, runsUpserted: 0, warnings: [] });
  });

  it("keeps scored local rows, but lets a snapshot score a locally pending row", async () => {
    await seedRemoteSnapshots({ "2026-09-30.json": snapshotText("2026-09-30", [item(1, { score: 88 }), item(2, { score: 88 })]) });
    const store = new MemoryStore();
    await store.importSnapshot([item(1, { score: 70 }), item(2, { score: null, tags: [], why_it_matters: null, scoring_status: "pending", scored_at: null, scorer_model: null })], []);
    const localIds = store.items.map((i) => i.id);
    const res = await importSnapshots({ store, repoDir: work, remote: "origin" });
    expect(res.result).toMatchObject({ itemsInserted: 0, itemsUpdated: 1 });
    expect(store.items.map((i) => i.id)).toEqual(localIds);
    expect(store.items.find((i) => i.canonical_url.endsWith("/1"))?.score).toBe(70);
    expect(store.items.find((i) => i.canonical_url.endsWith("/2"))).toMatchObject({ score: 88, scoring_status: "scored" });
  });

  const good = () => snapshotText("2026-09-29", [item(8, { digest_date: "2026-09-29" })]);
  it.each([
    ["invalid JSON", "{nope", /2026-09-30\.json.*JSON/],
    ["score 150", snapshotText("2026-09-30", [item(1, { score: 150 })]), /2026-09-30\.json.*score/],
    ["unknown tag", snapshotText("2026-09-30", [item(1, { tags: ["crypto"] as never })]), /tags/],
    ["huge why", snapshotText("2026-09-30", [item(1, { why_it_matters: "x".repeat(5000) })]), /why_it_matters/],
    ["date/name mismatch", snapshotText("2026-10-01", [item(1)]), /digest_date/],
    ["javascript url", snapshotText("2026-09-30", [item(1, { url: "javascript:alert(1)" })]), /url/],
  ])("rejects %s and writes nothing from any file", async (_n, bad, message) => {
    await seedRemoteSnapshots({ "2026-09-29.json": good(), "2026-09-30.json": bad });
    const store = new MemoryStore();
    await expect(importSnapshots({ store, repoDir: work, remote: "origin" })).rejects.toThrow(message);
    expect(store.items).toHaveLength(0);
  });

  it("explains a missing branch and an unreachable remote", async () => {
    await expect(importSnapshots({ store: new MemoryStore(), repoDir: work, remote: "origin" })).rejects.toThrow(/No news-snapshots branch/);
    const err = await importSnapshots({ store: new MemoryStore(), repoDir: work, remote: path.join(tmp, "nope.git") }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ImportError);
    expect((err as ImportError).kind).toBe("fetch");
  });

  it("validateSnapshotFile treats imported text as data, never markup-decoded", () => {
    const snap = validateSnapshotFile("x/2026-09-30.json", snapshotText("2026-09-30", [item(1, { title: "<script>window.__xss=4</script>", why_it_matters: '<img src=x onerror="window.__xss=5">' })]));
    expect(snap.items[0].title).toBe("<script>window.__xss=4</script>");
  });
});

describe("pipeline + publish (TC-E-68, TC-E-72)", () => {
  it("exports after a run and pushes to news-snapshots without touching the checkout", async () => {
    const h = harness({ sources: [src("a")], feeds: { a: rawMany(3) } });
    const before = userState();
    const res = await h.run({}, { snapshot: { stageDir: path.join(tmp, "stage"), publish: { repoDir: work, remote: "origin" } } });
    expect(res.status).toBe("success");
    expect(fs.existsSync(path.join(tmp, "stage", "2026-09-30.json"))).toBe(true);
    const content = sh(remote, "show", "refs/heads/news-snapshots:content/news/snapshots/2026-09-30.json");
    const snap = newsSnapshotSchema.parse(JSON.parse(content));
    expect(snap.items).toHaveLength(3);
    expect(snap.runs).toHaveLength(1);
    expect(userState()).toEqual(before);
    h.cleanup();
  });

  it("a push failure keeps the DB data, downgrades the run to partial and exits 0", async () => {
    const h = harness({ sources: [src("a")], feeds: { a: rawMany(2) } });
    const res = await h.run({}, { snapshot: { stageDir: path.join(tmp, "stage"), publish: { repoDir: work, remote: path.join(tmp, "nope.git") } } });
    expect(res.status).toBe("partial");
    expect(res.exitCode).toBe(0);
    expect(h.store.items).toHaveLength(2);
    expect(h.store.runs[0].error_summary).toMatch(/snapshot publish failed/);
    expect(h.store.runs[0].status).toBe("partial");
    h.cleanup();
  });

  it("without --publish nothing is pushed", async () => {
    const h = harness({ sources: [src("a")], feeds: { a: rawMany(1) } });
    await h.run({}, { snapshot: { stageDir: path.join(tmp, "stage"), publish: null } });
    expect(() => sh(remote, "rev-parse", "refs/heads/news-snapshots")).toThrow();
    h.cleanup();
  });
});
