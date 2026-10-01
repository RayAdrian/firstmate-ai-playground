---
title: Fixture workflow for Claude Code only
problem: A fixture that covers Claude Code alone, with no tabs on the page
tools:
  - claude-code
use_cases:
  - planning
stacks:
  - any
related_lesson: l1-permissions
tool_versions:
  claude_code: 2.1.0
verified_on: 2026-09-22
client_safe: confirmed
---

## Result

### Before

Plans lived in chat messages and were lost between sessions.

### After

Every plan is a file in the repo that the next session reads first.

## Setup

```markdown path=docs/PLAN.md kind=context-file
# Plan

1. Write the failing test.
2. Make it pass.
```

## Prompt

```text
Read docs/PLAN.md and continue with the first unchecked step.
```

## Steps

1. Write the plan to a file.
2. Start each session by reading it.

## Why it works

A file survives the end of a session, so the next session starts from the plan instead of from memory.
