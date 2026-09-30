// @vitest-environment node
// Integration tests for the real Supabase store. Opt-in: FM_DB_TESTS=1 npx vitest run tests/unit/e/store-supabase.int.test.ts
// (needs the local stack; skipped when FM_DB_TESTS is unset or the DB is unreachable).
// The DB is shared between worktrees: run them under the lock (scratchpad db-lock.sh) and they clean up their own rows
// (canonical_url https://wse-store.test/*, source slugs wse-store-*).
import path from "node:path";
import dotenv from "dotenv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SnapshotItem } from "@/lib/contracts";
import { getServiceClient } from "@/lib/db/service";
import { createSupabaseStore } from "../../../scripts/news/store-supabase";
import type { SourceConfig } from "../../../scripts/news/sources";

vi.setConfig({ testTimeout: 30_000 });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local"), quiet: true });

async function reachable(): Promise<boolean> {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
    const { error } = await getServiceClient().from("news_sources").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
// Opt-in: the shared DB is used by other worktrees, so run with FM_DB_TESTS=1 under the db lock.
const available = process.env.FM_DB_TESTS === "1" && (await reachable());

const SLUG = "wse-store-a";
const SOURCE: SourceConfig = { name: "WSE store test", slug: SLUG, url: "https://wse-store.test/feed", type: "rss", enabled: true, filters: {} };
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const url = (n: number) => `https://wse-store.test/${n}`;

const item = (n: number, over: Partial<SnapshotItem> = {}): SnapshotItem => ({
  id: id(n),
  source_slug: SLUG,
  guid: null,
  canonical_url: url(n),
  url: url(n),
  title: `Item ${n}`,
  author: null,
  published_at: "2030-12-30T00:00:00.000Z",
  first_seen_at: "2030-12-31T00:00:00.000Z",
  digest_date: "2030-12-31",
  excerpt: null,
  score: 70,
  tags: ["tooling"],
  why_it_matters: "Relevant.",
  scoring_status: "scored",
  attempts: 0,
  scored_at: "2030-12-31T00:01:00.000Z",
  scorer_model: "test-model",
  ...over,
});

describe.skipIf(!available)("createSupabaseStore.importSnapshot against the real database (R-1.2)", () => {
  const db = () => getServiceClient();
  const store = () => createSupabaseStore(db());

  async function cleanup() {
    await db().from("news_items").delete().like("canonical_url", "https://wse-store.test/%");
    await db().from("news_sources").delete().like("slug", "wse-store-%");
    await db().from("ingest_runs").delete().gte("started_at", "2030-12-31T00:00:00Z").lt("started_at", "2031-01-01T00:00:00Z").eq("error_summary", "wse-store-test");
  }
  beforeEach(async () => {
    await cleanup();
    await store().upsertSources([SOURCE]);
  });
  afterEach(cleanup);

  const rows = async () => (await db().from("news_items").select("id, canonical_url, score, scoring_status, title").like("canonical_url", "https://wse-store.test/%")).data ?? [];

  it("imports a fresh set with their ids, idempotently", async () => {
    const s = store();
    const r1 = await s.importSnapshot([item(1), item(2)], []);
    expect(r1).toMatchObject({ itemsInserted: 2, itemsUpdated: 0, warnings: [] });
    expect((await rows()).map((r) => r.id).sort()).toEqual([id(1), id(2)]);
    const r2 = await s.importSnapshot([item(1), item(2)], []);
    expect(r2).toMatchObject({ itemsInserted: 0, itemsUpdated: 0 });
    expect(await rows()).toHaveLength(2);
  });

  it("B1: the same canonical_url under two ids across date files no longer breaks the import", async () => {
    const s = store();
    // File 2026-12-30.json (old id) and file 2026-12-31.json (new id, re-fetched after a publisher DB reset).
    const oldFile = [item(1, { id: id(101), canonical_url: url(1), first_seen_at: "2030-12-30T00:00:00.000Z", digest_date: "2030-12-30" }), item(2)];
    const newFile = [item(1, { id: id(102), canonical_url: url(1), first_seen_at: "2030-12-31T00:00:00.000Z", digest_date: "2030-12-31" })];
    const res = await s.importSnapshot([...oldFile, ...newFile], []);
    expect(res.itemsInserted).toBe(2);
    expect(res.warnings.join(" ")).toContain(id(101));
    const all = await rows();
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.canonical_url === url(1))?.id).toBe(id(102)); // newest wins
    // Re-importing converges, still no error.
    const again = await s.importSnapshot([...oldFile, ...newFile], []);
    expect(again.itemsInserted).toBe(0);
    expect(await rows()).toHaveLength(2);
  });

  it("B1: the scored version of a duplicated url wins over a newer unscored one", async () => {
    const pending = item(1, { id: id(201), first_seen_at: "2030-12-31T09:00:00.000Z", score: null, tags: [], why_it_matters: null, scoring_status: "pending", scored_at: null, scorer_model: null });
    const scored = item(1, { id: id(202), first_seen_at: "2030-12-30T09:00:00.000Z", digest_date: "2030-12-30" });
    await store().importSnapshot([pending, scored], []);
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: id(202), scoring_status: "scored" });
  });

  it("a clash with an existing local row under a different id is updated in place with a warning", async () => {
    const s = store();
    await s.importSnapshot([item(1, { id: id(301), score: null, tags: [], why_it_matters: null, scoring_status: "pending", scored_at: null, scorer_model: null })], []);
    const res = await s.importSnapshot([item(1, { id: id(302), score: 88 })], []);
    expect(res).toMatchObject({ itemsInserted: 0, itemsUpdated: 1 });
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0]).toContain(id(301));
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: id(302), score: 88, scoring_status: "scored" });
  });

  it("never overwrites a scored local row, but a pending one takes the snapshot score", async () => {
    const s = store();
    await s.importSnapshot([item(1, { score: 70 }), item(2, { score: null, tags: [], why_it_matters: null, scoring_status: "pending", scored_at: null, scorer_model: null })], []);
    const res = await s.importSnapshot([item(1, { score: 10 }), item(2, { score: 88 })], []);
    expect(res.itemsUpdated).toBe(1);
    const all = await rows();
    expect(all.find((r) => r.id === id(1))?.score).toBe(70);
    expect(all.find((r) => r.id === id(2))).toMatchObject({ score: 88, scoring_status: "scored" });
  });

  it("two different local rows for one id and one url are skipped with a warning, not fatal", async () => {
    const s = store();
    await s.importSnapshot([item(1, { id: id(401) }), item(2, { id: id(402) })], []);
    // Snapshot claims id 401 for url 2: local id-row and local url-row differ.
    const res = await s.importSnapshot([item(2, { id: id(401) }), item(3)], []);
    expect(res.itemsInserted).toBe(1);
    expect(res.warnings.join(" ")).toMatch(/both exist/);
    expect(await rows()).toHaveLength(3);
  });

  it("an unknown source is a clear error and writes nothing", async () => {
    await expect(store().importSnapshot([item(1, { source_slug: "wse-store-missing" })], [])).rejects.toThrow(/unknown source/);
    expect(await rows()).toHaveLength(0);
  });

  it("snapshotFor leaves skipped items out", async () => {
    const s = store();
    await s.importSnapshot([item(1), item(2, { score: null, tags: [], why_it_matters: null, scoring_status: "skipped", scored_at: null, scorer_model: null })], []);
    const snap = await s.snapshotFor("2030-12-31");
    const mine = snap.items.filter((i) => i.canonical_url.startsWith("https://wse-store.test/"));
    expect(mine.map((i) => i.id)).toEqual([id(1)]);
  });

  it("upserts runs by id without duplicating", async () => {
    const run = { id: "bbbbbbbb-0000-4000-8000-000000000001", started_at: "2030-12-31T00:00:00.000Z", finished_at: "2030-12-31T00:01:00.000Z", trigger: "manual" as const, status: "success" as const, fetched: 1, new: 1, scored: 1, pending: 0, failed: 0, skipped: 0, error_summary: "wse-store-test" };
    const s = store();
    expect((await s.importSnapshot([], [run])).runsUpserted).toBe(1);
    expect((await s.importSnapshot([], [run])).runsUpserted).toBe(0);
  });
});
