import { describe, expect, it } from "vitest";
import { activeFilterCount, archiveHref, parseArchiveParams } from "@/components/news/archive-params";
import { formatDigestDay, formatFullStamp, formatShortStamp, formatTime, isIsoDate } from "@/components/news/dates";
import { manilaDate } from "@/lib/time/now";
import { compareRanked, selectDigest } from "@/components/news/rank";

describe("Manila dates (N-1.1, N-3.1)", () => {
  it("uses the Manila calendar day, not UTC", () => {
    expect(manilaDate(new Date("2026-09-30T23:59:00+08:00"))).toBe("2026-09-30");
    expect(manilaDate(new Date("2026-10-01T00:00:00+08:00"))).toBe("2026-10-01");
    // 16:30Z on the 29th is 00:30 on the 30th in Manila.
    expect(manilaDate(new Date("2026-09-29T16:30:00Z"))).toBe("2026-09-30");
  });

  it("formats day, time and stamps in Manila", () => {
    expect(formatDigestDay("2026-09-30")).toBe("Wed 30 Sep");
    expect(formatDigestDay("2026-09-29")).toBe("Tue 29 Sep");
    expect(formatTime("2026-09-30T08:03:00+08:00")).toBe("08:03");
    expect(formatTime("2026-09-30T00:03:00Z")).toBe("08:03");
    expect(formatShortStamp("2026-09-29T22:01:00Z")).toBe("Wed 30 Sep, 06:01");
    expect(formatFullStamp("2026-09-29T22:01:00Z")).toBe("Wed 30 Sep 2026, 06:01");
  });

  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-09-30")).toBe(true);
    expect(isIsoDate("2026-13-45")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("yesterday")).toBe(false);
    expect(isIsoDate("2026-09-01'")).toBe(false);
  });
});

describe("digest ranking (N-1.2, TC-F-06)", () => {
  const item = (id: string, score: number | null, published_at: string | null, scoring_status = "scored") => ({
    id,
    score,
    published_at,
    scoring_status,
  });
  const n03 = item("n03", 85, "2026-09-30T07:00:00+08:00");
  const n04 = item("n04", 85, "2026-09-30T06:00:00+08:00");

  it("breaks score ties by published_at descending, in either input order", () => {
    expect([n04, n03].sort(compareRanked).map((i) => i.id)).toEqual(["n03", "n04"]);
    expect([n03, n04].sort(compareRanked).map((i) => i.id)).toEqual(["n03", "n04"]);
  });

  it("falls back to id so the order is total, and puts null dates last", () => {
    const a = item("a", 70, "2026-09-30T06:00:00+08:00");
    const b = item("b", 70, "2026-09-30T06:00:00+08:00");
    const c = item("c", 70, null);
    expect([c, b, a].sort(compareRanked).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps score 60 and drops 59, only scored rows, capped at 10", () => {
    const rows = [
      item("s60", 60, "2026-09-30T06:00:00+08:00"),
      item("s59", 59, "2026-09-30T06:00:00+08:00"),
      item("pending99", 99, "2026-09-30T06:00:00+08:00", "pending"),
      item("failed", null, null, "failed"),
    ];
    expect(selectDigest(rows).map((i) => i.id)).toEqual(["s60"]);
    const many = Array.from({ length: 11 }, (_, i) => item(`x${i}`, 90 - i, "2026-09-30T06:00:00+08:00"));
    expect(selectDigest(many)).toHaveLength(10);
    expect(selectDigest(many).at(-1)?.id).toBe("x9");
  });
});

describe("archive URL state (N-4.1)", () => {
  it("parses a full filter set", () => {
    const p = parseArchiveParams({ tag: ["security", "tooling"], min: "60", source: "fx-simon", from: "2026-09-01", to: "2026-09-30", page: "3" });
    expect(p).toEqual({ tags: ["tooling", "security"], min: 60, source: "fx-simon", from: "2026-09-01", to: "2026-09-30", page: 3, dateError: false });
    expect(activeFilterCount(p)).toBe(6);
  });

  it("degrades bad input to defaults instead of failing", () => {
    for (const raw of [{ min: "55" }, { min: "abc" }, { min: "-40" }]) expect(parseArchiveParams(raw).min).toBe(0);
    for (const page of ["0", "-1", "abc", "1.5"]) expect(parseArchiveParams({ page }).page).toBe(1);
    expect(parseArchiveParams({ from: "2026-13-45" }).from).toBeNull();
    expect(parseArchiveParams({ to: "yesterday" }).to).toBeNull();
    expect(parseArchiveParams({ tag: "not-a-tag" }).tags).toEqual([]);
    expect(parseArchiveParams({ tag: "' OR 1=1--" }).tags).toEqual([]);
    expect(parseArchiveParams({ source: "<script>window.__xss=5</script>" }).source).toBe("");
  });

  it("flags an inverted range and applies neither bound", () => {
    const p = parseArchiveParams({ from: "2026-09-30", to: "2026-09-28" });
    expect(p).toMatchObject({ from: null, to: null, dateError: true });
  });

  it("serialises without defaults and preserves filters when paging", () => {
    expect(archiveHref({})).toBe("/news/archive");
    expect(archiveHref({ min: 0, page: 1, tags: [] })).toBe("/news/archive");
    const p = parseArchiveParams({ tag: ["security"], min: "80", from: "2026-09-29", to: "2026-09-30" });
    expect(archiveHref({ ...p, page: 2 })).toBe("/news/archive?tag=security&min=80&from=2026-09-29&to=2026-09-30&page=2");
  });
});
