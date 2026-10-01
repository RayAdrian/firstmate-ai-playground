---
title: A pass/fail rubric for the agent UI/UX review gate
problem: UI review by an agent is vague without a pass/fail rubric.
tools: [claude-code]
use_cases: [review, ci-and-gates]
stacks: [nextjs, react]
related_lesson: l3-ai-code-review
tool_versions:
  claude_code: 2.1.286
verified_on: 2026-10-01
client_safe: confirmed
---

## Result

### Before
A UI review agent returned "looks clean, consider improving spacing". No one could tell whether that was a pass, and a tab control that keyboard users could not reach still merged to a branch.

### After
The agent judges against a design spec with a fixed rubric and must return BLOCKING or NON-BLOCKING findings with a concrete fix. On a placeholder shell it returned RED with 2 blocking items (an unreachable inactive tab, a missing database-down message) and 8 non-blocking ones, and the blocking items were fixed before the verdict turned green.

## Setup

```markdown path=.claude/agents/uiux-gate.md kind=subagent tool=claude-code
---
name: uiux-gate
description: UI/UX merge gate. Judges a PR's UI against docs/design/DESIGN.md with a fixed rubric.
model: opus
tools: Read, Grep, Glob, Bash
---
You judge; you do not fix code. Review exactly the commit you are given.
Rubric. Each item is pass or fail with evidence (file:line or a screenshot name):
1. Tokens: colours, type and spacing come from the design tokens, no raw hex or px values.
2. Components: shared primitives are used, not re-implemented.
3. Selector contract: roles and accessible names match the spec's selector table.
4. States: loading, empty, error and success each exist and are reachable.
5. Responsive: no horizontal scroll and nothing clipped at 360, 768 and 1440 px.
6. Accessibility: one h1 per page, landmarks, visible focus, keyboard reach for every control,
   labels on inputs, status and alert roles for messages, contrast.
7. Copy: matches the spec's wording for errors and empty states.
Output: a verdict (GREEN or RED), then BLOCKING items (each with a one-line fix) and NON-BLOCKING
items. Anything that makes a user unable to complete a task, or breaks the selector contract, is BLOCKING.
```

## Prompt

```text
You are the uiux gate for PR <N> at commit <SHA>. Check that the PR head is still <SHA>.
Use the screenshots at <path> or take your own at 360, 768 and 1440 px.
Apply the rubric and return GREEN or RED with the findings.
If GREEN run: bash scripts/gate-status.sh <N> uiux success <SHA> "<short desc>".
If RED run it with `failure`. If the PR has no UI changes, say "N/A: no UI changes" and post success.
```

## Steps

1. Write or point to the design spec the agent judges against, including a table of expected roles and names.
2. Add `.claude/agents/uiux-gate.md` and confirm it loads with `/agents`.
3. Give the agent the PR number, the head SHA and the screenshot folder.
4. Fix every BLOCKING item and push, then re-run the agent on the new head.
5. Record NON-BLOCKING items as follow-ups in the PR so they are not lost.

## Why it works

A fixed list of seven checks turns taste into evidence, so two runs on the same commit reach the same verdict. Defining BLOCKING as "a user cannot finish a task or the selector contract breaks" gives the agent a line to hold instead of flagging everything. Pinning the review to one SHA means a later push cannot ride on an earlier green.
