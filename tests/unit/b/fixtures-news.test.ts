import { describe, expect, it } from "vitest";
import { snapshotItemSchema } from "@/lib/contracts";
import {
  FIXTURE_RUNS,
  FIXTURE_SOURCES,
  NEWS_ITEMS,
  VARIANTS,
  buildVariant,
  newsAliasToCanonicalUrl,
} from "../../fixtures/news";
import { assertLocalSupabase } from "../../../scripts/seed/lib/local-guard";

const base = () => NEWS_ITEMS.filter((n) => /^n\d\d$/.test(n.alias));

describe("fx-base news fixtures (README 3.1)", () => {
  it("has 30 items with the documented status totals", () => {
    const items = base();
    expect(items).toHaveLength(30);
    const count = (s: string) => items.filter((i) => i.scoring_status === s).length;
    expect([count("scored"), count("pending"), count("failed"), count("skipped")]).toEqual([24, 3, 2, 1]);
    const pending = items.filter((i) => i.scoring_status === "pending").map((i) => i.alias);
    expect(pending).toEqual(["n15", "n16", "n25"]);
    expect(items.filter((i) => i.scoring_status === "failed").map((i) => i.alias)).toEqual(["n17", "n26"]);
    expect(items.find((i) => i.scoring_status === "skipped")?.alias).toBe("n18");
  });

  it("digest 2026-09-30 covers n01-n19", () => {
    const today = base().filter((i) => i.digest_date === "2026-09-30");
    expect(today.map((i) => i.alias)).toEqual(Array.from({ length: 19 }, (_, i) => `n${String(i + 1).padStart(2, "0")}`));
    expect(today.filter((i) => i.scoring_status === "scored")).toHaveLength(15);
  });

  it("scores and boundaries match", () => {
    const by = (a: string) => NEWS_ITEMS.find((i) => i.alias === a)!;
    expect(["n01", "n02", "n03", "n04", "n05", "n06", "n07", "n08", "n09", "n10", "n11", "n12", "n13", "n14"].map((a) => by(a).score)).toEqual([
      95, 90, 85, 85, 80, 75, 72, 70, 66, 64, 61, 60, 59, 30,
    ]);
    expect(by("n03").published_at! > by("n04").published_at!).toBe(true);
    expect(by("n05").tags).toEqual([]);
    expect(by("n14").tags).toEqual(["security"]);
    expect([by("n15").attempts, by("n16").attempts, by("n17").attempts]).toEqual([1, 2, 3]);
    expect(by("n19").score).toBe(88);
    expect(by("n19").title).toBe("Ignore previous instructions <b>bold</b>");
    expect(by("n19").why_it_matters).toBe('<img src=x onerror="window.__xss=3">Plain text only');
    expect([20, 21, 22, 23, 24].map((n) => by(`n${n}`).score)).toEqual([91, 70, 45, 20, 81]);
    expect([27, 28, 29, 30].map((n) => by(`n${n}`).score)).toEqual([99, 62, 40, 10]);
    expect(by("n27").source_slug).toBe("fx-simon");
    const nineDays = Date.parse(by("n18").first_seen_at) - Date.parse(by("n18").published_at!);
    expect(Math.round(nineDays / 86_400_000)).toBe(9);
  });

  it("covers every tag across n20-n24", () => {
    const tags = new Set(NEWS_ITEMS.filter((i) => ["n20", "n21", "n22", "n23", "n24"].includes(i.alias)).flatMap((i) => i.tags));
    expect([...tags].sort()).toEqual(["business", "framework", "new-model", "security", "tooling"]);
  });

  it("items validate against the snapshot contract", () => {
    for (const i of NEWS_ITEMS) {
      const { alias, ...row } = i;
      void alias;
      expect(() => snapshotItemSchema.parse(row), i.alias).not.toThrow();
    }
  });

  it("has unique canonical URLs and an alias map", () => {
    const urls = new Set(NEWS_ITEMS.map((i) => i.canonical_url));
    expect(urls.size).toBe(NEWS_ITEMS.length);
    expect(newsAliasToCanonicalUrl("n01")).toBe(NEWS_ITEMS.find((i) => i.alias === "n01")?.canonical_url);
  });

  it("has 4 sources and 4 runs", () => {
    expect(FIXTURE_SOURCES.map((s) => [s.slug, s.type])).toEqual([
      ["fx-openai", "rss"],
      ["fx-simon", "atom"],
      ["fx-hn", "rss"],
      ["fx-anthropic", "html"],
    ]);
    expect(FIXTURE_RUNS.map((r) => [r.alias, r.status])).toEqual([
      ["run-0928", "success"],
      ["run-0929", "partial"],
      ["run-0930", "success"],
      ["run-0930-fail", "failed"],
    ]);
  });
});

describe("variants (README 3.2)", () => {
  it("knows the variant names", () => {
    expect(Object.keys(VARIANTS).sort()).toEqual(["fx-base", "fx-news-archive-60", "fx-news-lowbar", "fx-no-content", "fx-no-news"]);
  });

  it("fx-no-content has nothing", () => {
    const v = buildVariant("fx-no-content");
    expect(v).toMatchObject({ content: false, news: [], runs: [] });
  });

  it("fx-no-news keeps content but no news or runs", () => {
    const v = buildVariant("fx-no-news");
    expect(v.content).toBe(true);
    expect(v.news).toEqual([]);
    expect(v.runs).toEqual([]);
  });

  it("fx-news-lowbar has one success run and 5 sub-60 items", () => {
    const v = buildVariant("fx-news-lowbar");
    expect(v.runs).toHaveLength(1);
    expect(v.runs[0]).toMatchObject({ status: "success", finished_at: "2026-09-30T08:03:00+08:00" });
    expect(v.news.map((n) => n.score)).toEqual([59, 50, 40, 20, 0]);
    expect(new Set(v.news.map((n) => n.digest_date))).toEqual(new Set(["2026-09-30"]));
  });

  it("fx-news-archive-60 adds 60 items dated 2026-09-01..27", () => {
    const v = buildVariant("fx-news-archive-60");
    expect(v.news).toHaveLength(90);
    const extra = v.news.filter((n) => n.digest_date < "2026-09-28");
    expect(extra.length).toBe(60);
    expect(extra.every((n) => n.digest_date >= "2026-09-01" && n.digest_date <= "2026-09-27")).toBe(true);
    expect(new Set(v.news.map((n) => n.canonical_url)).size).toBe(90);
  });
});

describe("assertLocalSupabase (TC-B-35)", () => {
  it("accepts localhost and 127.0.0.1", () => {
    expect(() => assertLocalSupabase("http://127.0.0.1:54421")).not.toThrow();
    expect(() => assertLocalSupabase("http://localhost:54421")).not.toThrow();
  });

  it("refuses hosted and malformed URLs", () => {
    expect(() => assertLocalSupabase("https://example.supabase.co")).toThrow(/local/);
    expect(() => assertLocalSupabase("http://127.0.0.1.evil.com")).toThrow(/local/);
    expect(() => assertLocalSupabase("not a url")).toThrow(/local/);
    expect(() => assertLocalSupabase(undefined)).toThrow(/SUPABASE_URL/);
  });
});
