---
title: Gate statuses pinned to one commit
problem: An approval given on one commit silently covers a later push
tools:
  - claude-code
use_cases:
  - ci-and-gates
  - review
stacks:
  - github-actions
related_lesson: l1-first-session
tool_versions:
  claude_code: 2.1.0
  codex_cli: 0.154.0
verified_on: 2026-09-20
client_safe: confirmed
---

## Result

### Before

A reviewer approved a pull request, the author pushed one more commit, and the merge went through on the stale approval.

### After

Every gate verdict is stored against the exact commit it reviewed, and the merge script refuses when the head has moved.

## Setup

```markdown path=AGENTS.md kind=context-file
Any push invalidates earlier approvals: re-run the gates and post new statuses.
```

```bash path=scripts/gate-status.sh kind=script tool=claude-code
gh api "repos/$REPO/statuses/$SHA" -f state=success -f context="gate/review"
```

## Prompt

### Claude Code

```text
Review PR 12 at its current head commit and post gate/review on that exact SHA.
```

### Codex CLI

```text
Review the diff of PR 12 at its head commit, then post gate/review for that SHA.
```

## Steps

1. Resolve the PR head SHA before reviewing anything.
2. Review that commit and nothing else.
3. Post the verdict as a commit status on the same SHA.
4. Merge only when every required status is green on the current head.

## Why it works

A status belongs to a commit, so a later push starts with no approvals and the merge script has nothing stale to trust.
