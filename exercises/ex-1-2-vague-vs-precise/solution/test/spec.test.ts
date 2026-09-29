import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node runs .ts files directly and needs the extension; the playground's tsconfig does not allow it.
import { parseDateRange } from "../src/parseDateRange.ts";

// One test per row of SPEC.md. This is the file the precise prompt asks the agent to write first.

test("range form", () => {
  assert.deepEqual(parseDateRange("2026-03-01 to 2026-03-15", "2026-03-20"), {
    start: "2026-03-01",
    end: "2026-03-15",
  });
});

test("single date form", () => {
  assert.deepEqual(parseDateRange("2026-03-15", "2026-03-20"), {
    start: "2026-03-15",
    end: "2026-03-15",
  });
});

test("last N days, spec example", () => {
  assert.deepEqual(parseDateRange("last 7 days", "2026-03-03"), {
    start: "2026-02-25",
    end: "2026-03-03",
  });
});

test("this month, including a leap February", () => {
  assert.deepEqual(parseDateRange("this month", "2028-02-10"), {
    start: "2028-02-01",
    end: "2028-02-29",
  });
});

test("errors carry the exact messages from the spec", () => {
  assert.throws(() => parseDateRange("2026-02-30", "2026-03-20"), { message: "invalid date: 2026-02-30" });
  assert.throws(() => parseDateRange("2026-03-15 to 2026-03-01", "2026-03-20"), { message: "start is after end" });
  assert.throws(() => parseDateRange("last 0 days", "2026-03-20"), {
    message: "invalid day count: must be at least 1",
  });
  assert.throws(() => parseDateRange("soon", "2026-03-20"), { message: "unrecognized range: soon" });
});
