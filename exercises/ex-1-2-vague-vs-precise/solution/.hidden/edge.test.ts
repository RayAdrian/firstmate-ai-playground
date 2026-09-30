import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDateRange } from "../src/parseDateRange.ts";

// Hidden edge cases for exercise 1.2. Every one of these is stated in SPEC.md.

test("this month spans the first to the last day of today's month", () => {
  assert.deepEqual(parseDateRange("this month", "2026-03-20"), {
    start: "2026-03-01",
    end: "2026-03-31",
  });
});

test("this month knows leap years", () => {
  assert.deepEqual(parseDateRange("this month", "2028-02-10"), {
    start: "2028-02-01",
    end: "2028-02-29",
  });
  assert.deepEqual(parseDateRange("this month", "2027-02-10"), {
    start: "2027-02-01",
    end: "2027-02-28",
  });
});

test("last N days crosses a month boundary", () => {
  assert.deepEqual(parseDateRange("last 7 days", "2026-03-03"), {
    start: "2026-02-25",
    end: "2026-03-03",
  });
});

test("last N days crosses a year boundary", () => {
  assert.deepEqual(parseDateRange("last 3 days", "2026-01-01"), {
    start: "2025-12-30",
    end: "2026-01-01",
  });
});

test("last 1 day is just today, and the singular form works", () => {
  const expected = { start: "2026-03-20", end: "2026-03-20" };
  assert.deepEqual(parseDateRange("last 1 days", "2026-03-20"), expected);
  assert.deepEqual(parseDateRange("last 1 day", "2026-03-20"), expected);
});

test("last 0 days is rejected", () => {
  assert.throws(() => parseDateRange("last 0 days", "2026-03-20"), RangeError);
});

test("input is trimmed, case-insensitive and tolerant of extra spaces", () => {
  assert.deepEqual(parseDateRange("  2026-03-01   TO   2026-03-15  ", "2026-03-20"), {
    start: "2026-03-01",
    end: "2026-03-15",
  });
  assert.deepEqual(parseDateRange("Last 7 Days", "2026-03-20"), {
    start: "2026-03-14",
    end: "2026-03-20",
  });
});

test("impossible calendar dates throw RangeError('invalid date: ...')", () => {
  assert.throws(() => parseDateRange("2026-02-30", "2026-03-20"), {
    name: "RangeError",
    message: "invalid date: 2026-02-30",
  });
  assert.throws(() => parseDateRange("2026-03-01 to 2026-13-01", "2026-03-20"), {
    name: "RangeError",
    message: "invalid date: 2026-13-01",
  });
  assert.throws(() => parseDateRange("2027-02-29", "2026-03-20"), RangeError);
});

test("29 February exists only in leap years", () => {
  assert.deepEqual(parseDateRange("2028-02-29", "2028-03-01"), {
    start: "2028-02-29",
    end: "2028-02-29",
  });
});

test("a range whose start is after its end throws RangeError('start is after end')", () => {
  assert.throws(() => parseDateRange("2026-03-15 to 2026-03-01", "2026-03-20"), {
    name: "RangeError",
    message: "start is after end",
  });
});

test("a range with equal start and end is allowed", () => {
  assert.deepEqual(parseDateRange("2026-03-15 to 2026-03-15", "2026-03-20"), {
    start: "2026-03-15",
    end: "2026-03-15",
  });
});

test("unrecognized input throws RangeError('unrecognized range: ...')", () => {
  assert.throws(() => parseDateRange("next tuesday", "2026-03-20"), {
    name: "RangeError",
    message: "unrecognized range: next tuesday",
  });
  assert.throws(() => parseDateRange("", "2026-03-20"), RangeError);
});
