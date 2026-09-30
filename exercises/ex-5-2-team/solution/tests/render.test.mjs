// Part C acceptance tests. Frozen: do not edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/render.mjs";

const c = (type, subject, scope = null) => ({ type, scope, breaking: false, subject });
const meta = { version: "1.2.0", date: "2026-09-30" };

test("renders a header, titled sections and bullets", () => {
  const out = renderMarkdown(
    [
      { type: "breaking", commits: [c("feat", "drop v1 API", "api")] },
      { type: "feat", commits: [c("feat", "add dark mode", "ui"), c("feat", "add export")] },
      { type: "fix", commits: [c("fix", "handle empty input")] },
    ],
    meta,
  );
  assert.equal(
    out,
    [
      "## v1.2.0 (2026-09-30)",
      "",
      "### Breaking changes",
      "- api: drop v1 API",
      "",
      "### Features",
      "- ui: add dark mode",
      "- add export",
      "",
      "### Fixes",
      "- handle empty input",
      "",
    ].join("\n"),
  );
});

test("every group type has its title", () => {
  const titles = {
    perf: "Performance",
    refactor: "Refactors",
    docs: "Docs",
    test: "Tests",
    chore: "Chores",
    other: "Other",
  };
  for (const [type, title] of Object.entries(titles)) {
    const out = renderMarkdown([{ type, commits: [c(type, "x")] }], meta);
    assert.ok(out.includes(`### ${title}\n- x\n`), `missing title ${title}`);
  }
});

test("no groups renders the placeholder line", () => {
  assert.equal(renderMarkdown([], meta), "## v1.2.0 (2026-09-30)\n\nNo user-facing changes.\n");
});

test("output ends with exactly one newline", () => {
  const out = renderMarkdown([{ type: "fix", commits: [c("fix", "a")] }], meta);
  assert.ok(out.endsWith("- a\n"));
  assert.ok(!out.endsWith("\n\n"));
});
