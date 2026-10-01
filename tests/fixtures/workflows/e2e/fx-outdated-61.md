---
title: Fixture workflow verified 61 days ago
problem: A fixture whose verification is 61 days old and so shows May be outdated
tools:
  - claude-code
use_cases:
  - debugging
stacks:
  - node
tool_versions:
  claude_code: 2.0.0
verified_on: 2026-07-31
client_safe: confirmed
---

## Result

### Before

Debugging sessions restarted from scratch whenever the context ran out.

### After

A short notes file carries the findings from one session to the next.

## Setup

```markdown path=docs/DEBUG_NOTES.md kind=context-file
# Debug notes

- Reproduced with `npm test -- --run`.
```

## Prompt

```text
Read docs/DEBUG_NOTES.md, then continue the investigation.
```

## Steps

1. Write what you learned to the notes file.
2. Start the next session from it.

## Why it works

The notes hold only findings, so the next session spends its context on new work instead of re-deriving old facts.
