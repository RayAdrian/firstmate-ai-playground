---
title: Fixture workflow verified 181 days ago
problem: A fixture whose verification is 181 days old and so counts as Archived
tools:
  - claude-code
use_cases:
  - refactoring
stacks:
  - react
tool_versions:
  claude_code: 1.0.0
verified_on: 2026-04-02
client_safe: confirmed
---

## Result

### Before

Large refactors landed as one change that nobody could review.

### After

The refactor lands as a series of small commits, each green on its own.

## Setup

```markdown path=AGENTS.md kind=context-file
Refactor in small steps and keep the tests green after each one.
```

## Prompt

```text
Refactor this module in steps of at most one file, running the tests after each.
```

## Steps

1. Ask for a plan of small steps.
2. Run the tests after each step.

## Why it works

Small steps keep every diff reviewable, and a failing test points at the last step instead of the whole change.
