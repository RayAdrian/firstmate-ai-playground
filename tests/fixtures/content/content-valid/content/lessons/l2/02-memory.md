---
slug: l2-memory
level: 2
sort: 2
title: Memory
objective: Keep knowledge between sessions.
est_minutes: 10
tool_versions:
  claude_code: "2.1.0"
  codex_cli: "0.40.0"
last_verified_on: 2026-09-15
differences:
  - Memory is stored differently in each tool.
  - Both can be edited by hand.
---

## Concept

Raw HTML must stay inert: <script>window.__xss=1</script> and <img src=x onerror="window.__xss=2">

## Claude Code

Use the `#` shortcut to add a memory.

## Codex CLI

Edit `AGENTS.md` by hand.
