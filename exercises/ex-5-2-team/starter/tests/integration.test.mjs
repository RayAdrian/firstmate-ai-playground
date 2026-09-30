// Integration acceptance test. Frozen: do not edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseNotes } from "../src/index.mjs";

test("commit log in, release notes out", () => {
  const log = [
    "chore: bump deps",
    "feat(ui)!: replace the sidebar",
    "fix(api): return 404 for unknown ids",
    "",
    "Merge branch 'main'",
    "feat: add CSV export",
    "wip: half done",
  ].join("\n");
  assert.equal(
    releaseNotes(log, { version: "2.0.0", date: "2026-10-01" }),
    [
      "## v2.0.0 (2026-10-01)",
      "",
      "### Breaking changes",
      "- ui: replace the sidebar",
      "",
      "### Features",
      "- add CSV export",
      "",
      "### Fixes",
      "- api: return 404 for unknown ids",
      "",
      "### Chores",
      "- bump deps",
      "",
      "### Other",
      "- Merge branch 'main'",
      "- half done",
      "",
    ].join("\n"),
  );
});
