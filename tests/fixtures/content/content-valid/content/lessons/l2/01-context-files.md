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

```diagram
type: flow
id: edit-loop
title: The edit, approve, verify loop
summary: Give the agent a check it can run, and it loops on its own failures.
steps:
  - id: ask
    label: Ask
    next: plan
  - id: edit
    label: Edit
    sub: agent proposes
    next: if ok
  - id: approve
    label: Approve
  - id: verify
    label: Verify
    emphasis: true
loops:
  - from: verify
    to: edit
    label: check fails
exits:
  - from: approve
    label: denied
    text: Agent stops
    style: risk
  - from: verify
    label: passes
    text: Merge
    style: ok
```

Nearer files win over farther ones.

```diagram
type: stack
id: context-ladder
title: Where context files are read from
summary: The nearest file wins, so a package can override the repo, and the repo the home folder.
layers:
  - id: home
    label: Home folder
    sub: your defaults
  - id: repo
    label: Repo root
    sub: shared with the team
  - id: package
    label: Package folder
    emphasis: true
axis:
  low: farthest
  high: nearest
```

Keep each file short.

## Claude Code

Write a `CLAUDE.md` at the repo root.

## Codex CLI

Write an `AGENTS.md` at the repo root.
