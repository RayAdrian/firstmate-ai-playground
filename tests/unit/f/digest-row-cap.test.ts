import { beforeEach, describe, expect, it, vi } from "vitest";

// A store that mimics PostgREST: a 1,000-row response cap, skipped rows returned first.
type Row = Record<string, unknown>;
const CAP = 1000;
let items: Row[] = [];
const itemQueries: { cols: string; eq: [string, unknown][]; in: [string, unknown[]][] }[] = [];

function builder(table: string) {
  const eq: [string, unknown][] = [];
  const inn: [string, unknown[]][] = [];
  let cols = "*";
  let from = 0;
  let to = CAP - 1;
  const q: Record<string, unknown> = {
    select: (c: string) => ((cols = c), q),
    eq: (k: string, v: unknown) => (eq.push([k, v]), q),
    in: (k: string, v: unknown[]) => (inn.push([k, v]), q),
    lte: () => q,
    gte: () => q,
    lt: () => q,
    order: () => q,
    limit: (n: number) => ((to = from + n - 1), q),
    range: (a: number, b: number) => ((from = a), (to = Math.min(b, a + CAP - 1)), q),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let data: Row[];
      if (table === "ingest_runs") {
        data = [
          {
            id: "r1",
            status: "success",
            started_at: "2026-10-02T06:00:00+08:00",
            finished_at: "2026-10-02T06:05:00+08:00",
          },
        ];
      } else if (table === "news_sources") {
        data = [{ id: "s1", name: "Src" }];
      } else {
        itemQueries.push({ cols, eq, in: inn });
        data = items.filter(
          (r) => eq.every(([k, v]) => r[k] === v) && inn.every(([k, vs]) => vs.includes(r[k])),
        );
      }
      return Promise.resolve({ data: data.slice(from, to + 1), error: null }).then(resolve, reject);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getReadClient: () => ({ from: builder }) }));

import { getDigest } from "@/components/news/queries";

const row = (n: number, status: string, score: number | null): Row => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  source_id: "s1",
  title: `Item ${n}`,
  url: `https://example.com/${n}`,
  published_at: "2026-10-02T01:00:00+08:00",
  score,
  tags: [],
  why_it_matters: null,
  scoring_status: status,
  digest_date: "2026-10-02",
});

const NOW = new Date("2026-10-02T12:00:00+08:00");

beforeEach(() => {
  itemQueries.length = 0;
  // 3,787 skipped rows first, then 56 scored (16 of them >= 60) and 2 pending.
  items = [
    ...Array.from({ length: 3787 }, (_, i) => row(i, "skipped", null)),
    ...Array.from({ length: 56 }, (_, i) => row(10000 + i, "scored", i < 16 ? 92 - i : 30 + i)),
    row(20000, "pending", null),
    row(20001, "pending", null),
  ];
});

describe("getDigest under the PostgREST row cap", () => {
  it("shows the top items even when the day is mostly skipped backfill rows", async () => {
    const d = await getDigest(NOW, { withUnscored: true });
    if (d.kind !== "digest") throw new Error("expected a digest");
    expect(d.scoredCount).toBe(56);
    expect(d.ranked).toHaveLength(10);
    expect(d.ranked[0]!.score).toBe(92);
    expect(d.ranked.every((r) => (r.score ?? 0) >= 60)).toBe(true);
    expect(d.scoredAll).toHaveLength(56);
    expect(d.unscored).toHaveLength(2);
  });

  it("never asks for skipped rows or select(*)", async () => {
    await getDigest(NOW);
    const q = itemQueries[0]!;
    expect(q.cols).not.toBe("*");
    expect(q.in).toEqual([["scoring_status", ["scored", "pending", "failed"]]]);
  });

  it("pages through when more than 1,000 non-skipped rows exist", async () => {
    items = Array.from({ length: 2300 }, (_, i) => row(i, "scored", i % 100));
    const d = await getDigest(NOW);
    if (d.kind !== "digest") throw new Error("expected a digest");
    expect(d.scoredCount).toBe(2300);
    expect(itemQueries).toHaveLength(3);
  });
});
