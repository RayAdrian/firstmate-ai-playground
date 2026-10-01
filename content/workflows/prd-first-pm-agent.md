---
title: PRD first with a product-manager subagent
problem: Agents build the wrong thing when the spec is a chat message.
tools: [claude-code]
use_cases: [planning]
stacks: [any]
related_lesson: l3-plan-first
tool_versions:
  claude_code: 2.1.286
verified_on: 2026-10-01
client_safe: confirmed
---

## Result

### Before
Features started from a paragraph in chat. Each implementer filled the gaps differently, so two workstreams disagreed about a data shape and a "done" check existed only in someone's head.

### After
A PM subagent writes `docs/PRD.md` before any build starts: numbered acceptance criteria with priorities (P0, P1), ownership per workstream and non-goals. Every P0 criterion got its test in the same PR, and later addenda (one new section per feature) kept the scope reviewable instead of drifting.

## Setup

```markdown path=.claude/agents/pm.md kind=subagent tool=claude-code
---
name: pm
description: Turns a feature idea into a PRD with acceptance criteria. Use before any build work.
model: opus
tools: Read, Grep, Glob, Write
---
You write specs, not code. Ask the clarifying questions that block a decision, then write one
section of docs/PRD.md containing: problem, goal, non-goals, target users, success metrics,
user stories with IDs (P0/P1/P2) and testable acceptance criteria, path ownership per workstream,
phases, and open questions. Every P0 criterion must be checkable by an automated test or an
explicit manual check. Mark assumptions as ASSUMPTION. Do not reopen decisions marked fixed.
```

```markdown path=AGENTS.md kind=context-file
### Spec first
The spec is docs/PRD.md. Acceptance criteria IDs (for example L-2) refer to it.
Test-first: each P0 criterion has its test in the same PR. Edit only the paths your workstream owns.
```

## Prompt

```text
Use the `pm` subagent to write a new PRD section for <feature>.
Fixed decisions: <list>. Out of scope: <list>.
When it returns, list its open questions and every ASSUMPTION so I can answer them before any building starts.
```

## Steps

1. Add `.claude/agents/pm.md` and the "Spec first" rule; run `/agents` to confirm `pm` is listed.
2. Give the PM subagent the idea plus the decisions that are already fixed.
3. Read the PRD section, answer its open questions and edit the criteria yourself.
4. Commit the PRD on its own docs PR so the spec merges before the first build branch.
5. Hand each build agent only its workstream's criteria and owned paths.

## Why it works

A written spec with stable criterion IDs gives builders, test writers and reviewers the same definition of done, so disagreements surface in the doc instead of in a merged PR. Keeping the PM subagent write-only on docs and forbidden from reopening fixed decisions stops the planning step from drifting into design debates already settled.
