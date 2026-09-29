---
slug: l1-permissions
level: 1
sort: 2
title: Permissions and sandboxing
objective: Control what the agent may run.
est_minutes: 15
tool_versions:
  claude_code: "2.1.0"
  codex_cli: "0.40.0"
last_verified_on: 2026-07-31
differences:
  - Codex has no per-command allowlist in this fixture.
codex_no_equivalent: true
---

## Concept

Permissions decide which commands run without asking.

## Claude Code

Add allow rules to `.claude/settings.json`.

## Codex CLI

Workaround: use a sandbox profile
