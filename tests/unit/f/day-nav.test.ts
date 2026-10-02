import { describe, expect, it } from "vitest";
import { digestDayHref, neighborDates, parseDigestDateParam, parseShowParam } from "@/components/news/day-nav";

describe("parseDigestDateParam", () => {
  const today = "2026-09-30";
  it("treats missing or empty as none", () => {
    expect(parseDigestDateParam(undefined, today)).toEqual({ kind: "none" });
    expect(parseDigestDateParam("", today)).toEqual({ kind: "none" });
  });
  it("accepts today and past days", () => {
    expect(parseDigestDateParam("2026-09-30", today)).toEqual({ kind: "date", date: "2026-09-30" });
    expect(parseDigestDateParam("2026-09-28", today)).toEqual({ kind: "date", date: "2026-09-28" });
  });
  it("uses the first value of a repeated param", () => {
    expect(parseDigestDateParam(["2026-09-28", "x"], today)).toEqual({ kind: "date", date: "2026-09-28" });
  });
  it("flags future days", () => {
    expect(parseDigestDateParam("2026-10-01", today)).toEqual({ kind: "future", date: "2026-10-01" });
  });
  it("flags malformed and impossible dates", () => {
    for (const bad of ["yesterday", "2026-13-45", "2026-02-30", "2026-9-3", "2026-09-30'", "1999-01-01"]) {
      expect(parseDigestDateParam(bad, today)).toEqual({ kind: "invalid" });
    }
  });
});

describe("neighborDates", () => {
  const dates = ["2026-09-30", "2026-09-29", "2026-09-25", "2026-09-20"];
  it("skips empty days", () => {
    expect(neighborDates(dates, "2026-09-29")).toEqual({ prev: "2026-09-25", next: "2026-09-30" });
  });
  it("has no next at the latest and no prev at the oldest", () => {
    expect(neighborDates(dates, "2026-09-30")).toEqual({ prev: "2026-09-29", next: null });
    expect(neighborDates(dates, "2026-09-20")).toEqual({ prev: null, next: "2026-09-25" });
  });
  it("works for a day with no digest", () => {
    expect(neighborDates(dates, "2026-09-27")).toEqual({ prev: "2026-09-25", next: "2026-09-29" });
  });
  it("handles no digests", () => {
    expect(neighborDates([], "2026-09-27")).toEqual({ prev: null, next: null });
  });
});

describe("parseShowParam", () => {
  it("is all only for show=all", () => {
    expect(parseShowParam("all")).toBe("all");
    expect(parseShowParam(["all", "x"])).toBe("all");
    for (const v of [undefined, "", "relevant", "ALL", "everything"]) expect(parseShowParam(v)).toBe("relevant");
  });
});

describe("digestDayHref", () => {
  it("builds the URL and omits defaults", () => {
    expect(digestDayHref("2026-09-29")).toBe("/news?date=2026-09-29");
    expect(digestDayHref("2026-09-29", "all")).toBe("/news?date=2026-09-29&show=all");
    expect(digestDayHref(null, "all")).toBe("/news?show=all");
    expect(digestDayHref(null)).toBe("/news");
  });
});
