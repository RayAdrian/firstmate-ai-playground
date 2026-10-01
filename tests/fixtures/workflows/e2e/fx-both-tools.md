---
title: Fixture workflow for both tools
problem: A fixture that covers Claude Code and Codex CLI with tabs
tools:
  - claude-code
  - codex
use_cases:
  - review
  - testing
stacks:
  - nextjs
  - typescript
related_lesson: l1-first-session
tool_versions:
  claude_code: 2.1.0
  codex_cli: 0.154.0
verified_on: 2026-09-25
client_safe: confirmed
---

## Result

### Before

The reviewer had to remember which checks to run and in which order every time.

### After

The checks live in one file, and both tools run them the same way.

## Setup

```markdown path=AGENTS.md kind=context-file
Run `npm test` before you open a pull request.
```

```bash path=.claude/hooks/pre-push.sh kind=hook tool=claude-code
npm test
```

```toml path=.codex/config.toml kind=config tool=codex
approval_policy = "on-request"
```

## Prompt

### Claude Code

```text
Run the checks in AGENTS.md and report any failure.
```

### Codex CLI

```text
Run the checks listed in AGENTS.md and summarise failures.
```

## Steps

1. Add the checks to the context file.
2. Ask the tool to run them.
3. Read the failures it reports.

## Why it works

The context file is the single source of truth, so both tools read the same list and cannot drift apart.
