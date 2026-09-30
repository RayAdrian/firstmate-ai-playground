import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error TS5097 without allowImportingTsExtensions. Node runs .ts directly and needs the extension.
import { parseDateRange } from "../src/parseDateRange.ts";

const TODAY = "2026-03-20";

test("parses an explicit range", () => {
  assert.deepEqual(parseDateRange("2026-03-01 to 2026-03-15", TODAY), {
    start: "2026-03-01",
    end: "2026-03-15",
  });
});

test("a single date is a one-day range", () => {
  assert.deepEqual(parseDateRange("2026-03-15", TODAY), {
    start: "2026-03-15",
    end: "2026-03-15",
  });
});

test("last 7 days counts today as day one", () => {
  assert.deepEqual(parseDateRange("last 7 days", TODAY), {
    start: "2026-03-14",
    end: "2026-03-20",
  });
});
