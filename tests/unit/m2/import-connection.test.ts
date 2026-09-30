// @vitest-environment node
// Backlog: `news:import` exited 0 when Supabase dropped mid-import (every item became a "skipped" warning).
import { describe, expect, it } from "vitest";
import type { SnapshotItem } from "@/lib/contracts";
import { isConnectionFailure } from "@/lib/db/errors";
import { createSupabaseStore } from "../../../scripts/news/store-supabase";

type Result = { data: unknown; error: { message: string } | null };

/** A chainable stand-in for the supabase-js query builder: every call returns the chain, awaiting yields `resolve(table, op)`. */
function fakeClient(resolve: (table: string, op: string) => Result) {
  const from = (table: string) => {
    let op = "select";
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            return (ok: (r: Result) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(resolve(table, op)).then(ok, bad);
          }
          return (...args: unknown[]) => {
            if (prop === "upsert" || prop === "insert" || prop === "update") op = prop;
            void args;
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return { from } as never;
}

const item: SnapshotItem = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  source_slug: "src",
  guid: null,
  canonical_url: "https://example.test/1",
  url: "https://example.test/1",
  title: "Item 1",
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
};

const reads = (table: string): Result =>
  table === "news_sources" ? { data: [{ id: "s1", slug: "src" }], error: null } : { data: [], error: null };

describe("importSnapshot when the database drops mid-import", () => {
  it("throws a connection failure instead of skipping every item", async () => {
    const store = createSupabaseStore(
      fakeClient((table, op) =>
        table === "news_items" && op === "upsert" ? { data: null, error: { message: "TypeError: fetch failed" } } : reads(table),
      ),
    );
    const err = await store.importSnapshot([item], []).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(isConnectionFailure(err)).toBe(true);
  });

  it("still degrades a genuinely bad item to a warning", async () => {
    const store = createSupabaseStore(
      fakeClient((table, op) =>
        table === "news_items" && op === "upsert"
          ? { data: null, error: { message: 'new row violates check constraint "x"' } }
          : reads(table),
      ),
    );
    const result = await store.importSnapshot([item], []);
    expect(result.itemsInserted).toBe(0);
    expect(result.warnings.some((w) => w.startsWith("skipped https://example.test/1"))).toBe(true);
  });
});
