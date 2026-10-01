---
title: Opus plans and reviews, Sonnet builds
problem: One model for everything is either slow and costly or too weak at planning and review.
tools: [claude-code]
use_cases: [planning, review]
stacks: [any]
related_lesson: l5-model-routing
tool_versions:
  claude_code: 2.1.286
verified_on: 2026-10-01
client_safe: confirmed
---

## Result

### Before
Everything ran on one model. Using the strongest model for every file edit made long builds slow and expensive. Using the fast model for planning and review let a plan gap or a missing test reach the PR.

### After
Planning, test-case design and code review run on Opus; implementation and test execution run on Sonnet, each as its own subagent with a pinned model. In this project that split built five workstreams in parallel, each one handed to an implementer with a written plan and reviewed by a separate Opus pass before merge.

## Setup

```markdown path=.claude/agents/implementer.md kind=subagent tool=claude-code
---
name: implementer
description: Builds a planned change test-first in its own worktree. Use after a plan exists.
model: sonnet
---
You implement exactly the plan you are given. Write the tests first and watch them fail.
Edit only the paths your workstream owns (see AGENTS.md). If you need a change outside them,
stop and say so in your final report. Run typecheck, lint and tests before you report.
Final report under 200 words: what changed, test counts, anything outside your paths.
```

```markdown path=.claude/agents/reviewer.md kind=subagent tool=claude-code
---
name: reviewer
description: Reviews a diff against the spec and AGENTS.md. Use before merge, never to write code.
model: opus
tools: Read, Grep, Glob, Bash
---
Review the diff for correctness against the acceptance criteria, security, contract adherence,
edits outside owned paths, and whether the tests really assert the criteria.
Report findings as BLOCKING or NON-BLOCKING with file:line. Do not fix code.
```

```markdown path=AGENTS.md kind=context-file
### Model routing
- Opus: planning, orchestration, test-case design, code review.
- Sonnet: implementation and test execution.
Spawn builders with the `implementer` subagent and reviewers with `reviewer`.
```

## Prompt

```text
Plan <feature> first: list the acceptance criteria, the files each workstream owns, and the tests per criterion.
Show me the plan and stop. After I approve it, hand each workstream to the `implementer` subagent
with its slice of the plan, and when each returns, run the `reviewer` subagent on its diff.
```

## Steps

1. Create the two subagent files and the routing rule in `AGENTS.md`; run `/agents` to confirm both load.
2. Start the session on Opus (`claude --model opus`) and ask for the plan first.
3. Approve or edit the plan, then let the session delegate each slice to `implementer`.
4. Run `reviewer` on every returned diff and send blocking findings back to a fresh `implementer`.
5. Merge only after the reviewer reports no blocking findings.

## Why it works

Planning and review are where a wrong judgement is expensive and where extra reasoning pays off, while implementation against a written plan is bounded and checked by tests. Pinning the model in each subagent's frontmatter makes the split repeatable instead of depending on whoever started the session. A reviewer with no write tools cannot quietly fix what it finds.
