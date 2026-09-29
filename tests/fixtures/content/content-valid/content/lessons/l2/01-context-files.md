---
slug: l2-context-files
level: 2
sort: 1
title: Project instructions
objective: Give the agent durable project context.
est_minutes: 25
tool_versions:
  claude_code: "2.1.0"
  codex_cli: "0.40.0"
last_verified_on: 2026-08-01
differences:
  - Claude Code reads CLAUDE.md.
  - Codex CLI reads AGENTS.md.
  - Both support nested files.
  - Claude Code supports imports.
  - Codex CLI has a global file.
exercise: ex-fx-manual
---

## Concept

Context files are read at session start.

## Claude Code

Write a `CLAUDE.md` at the repo root.

## Codex CLI

Write an `AGENTS.md` at the repo root.
