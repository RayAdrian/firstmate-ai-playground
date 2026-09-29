// The context files. The agent can only follow conventions it has been told about.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("AGENTS.md exists and states all four conventions", () => {
  assert.ok(existsSync("AGENTS.md"), "write AGENTS.md at the repo root");
  const text = readFileSync("AGENTS.md", "utf8");
  assert.match(text, /Cents/, "mention the integer-cents / Cents suffix rule");
  assert.match(text, /AppError/, "mention AppError and E_ codes");
  assert.match(text, /log\.js/, "mention src/log.js instead of console");
  assert.match(text, /kebab-case/, "mention kebab-case handler files");
  assert.match(text, /npm test/, "mention how to run the tests");
});

test("one source of truth: CLAUDE.md, if present, imports AGENTS.md", () => {
  if (!existsSync("CLAUDE.md")) return; // Claude Code reads AGENTS.md itself when there is no CLAUDE.md
  const text = readFileSync("CLAUDE.md", "utf8");
  assert.match(text, /^@AGENTS\.md\s*$/m, "CLAUDE.md must contain a line `@AGENTS.md`");
  assert.ok(text.split("\n").length < 30, "keep CLAUDE.md thin; put shared rules in AGENTS.md");
});
