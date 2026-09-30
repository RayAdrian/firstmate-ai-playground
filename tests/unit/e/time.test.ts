// @vitest-environment node
import { describe, expect, it } from "vitest";
import { digestDate, isOlderThanBackfillWindow, manilaHour, manilaTimestamp } from "../../../scripts/news/time";

describe("digestDate (I-5.4, TC-E-47)", () => {
  it.each([
    ["2026-09-29T15:59:59Z", "2026-09-29"],
    ["2026-09-29T16:00:00Z", "2026-09-30"],
    ["2026-09-30T15:59:59.999Z", "2026-09-30"],
    ["2026-12-31T16:00:00Z", "2027-01-01"],
    ["2028-02-28T16:00:00Z", "2028-02-29"],
  ])("%s -> %s", (iso, expected) => {
    expect(digestDate(iso)).toBe(expected);
  });
});

describe("manila helpers", () => {
  it("formats a Manila-offset timestamp", () => {
    expect(manilaTimestamp(new Date("2026-09-30T00:00:00Z"))).toBe("2026-09-30T08:00:00+08:00");
  });
  it("reports the Manila hour", () => {
    expect(manilaHour(new Date("2026-09-29T23:30:00Z"))).toBe(7);
    expect(manilaHour(new Date("2026-09-30T00:00:00Z"))).toBe(8);
  });
});

describe("7-day backfill guard (I-2.3, TC-E-19)", () => {
  const now = new Date("2026-09-30T08:00:00+08:00");
  it.each([
    ["2026-09-23T08:00:01+08:00", false],
    ["2026-09-23T08:00:00+08:00", false],
    ["2026-09-23T07:59:59+08:00", true],
    ["2025-01-01T00:00:00Z", true],
  ])("%s older? %s", (published, older) => {
    expect(isOlderThanBackfillWindow(published, now)).toBe(older);
  });
});
