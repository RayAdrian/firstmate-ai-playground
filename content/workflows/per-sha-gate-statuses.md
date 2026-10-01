---
title: Per-SHA gate statuses for agent reviews
problem: An approval given on one commit silently covers a later push.
tools: [claude-code]
use_cases: [ci-and-gates, review]
stacks: [github-actions]
related_lesson: l5-gated-merge-pipelines
tool_versions:
  claude_code: 2.1.286
verified_on: 2026-10-01
client_safe: confirmed
---

## Result

### Before
A review agent said "looks good" in a PR comment, then a fix was pushed and the PR merged on the old approval. Nothing tied the verdict to the code that was actually read.

### After
Every gate verdict is a GitHub commit status (`gate/browser`, `gate/review`, `gate/uiux`) posted on the exact SHA the agent reviewed. The poster refuses `success` if the PR head has moved. A rebase or push leaves the new head with no statuses until the gates re-run.

## Setup

Rule for the repo's context file, so every agent knows the contract.

```markdown path=AGENTS.md kind=context-file
### Merge gates, all required on the exact head commit
1. `gate/browser`: Playwright and axe pass on fixtures.
2. `gate/review`: code-review agent, no blocking findings.
3. `gate/uiux`: UI/UX agent, or "N/A: no UI changes".
Any push invalidates earlier approvals: re-run the gates and post new statuses.
Gate agents post verdicts with `scripts/gate-status.sh`. Never merge with `gh pr merge` directly.
```

The poster script. It needs `gh` authenticated with repo access.

```bash path=scripts/gate-status.sh kind=script
#!/usr/bin/env bash
# Usage: scripts/gate-status.sh <pr#> <browser|review|uiux> <success|failure> <sha> "<description>"
set -euo pipefail
(($# == 5)) || { echo 'usage: gate-status.sh <pr#> <gate> <state> <sha> "<desc>"' >&2; exit 2; }
PR="$1"; GATE="$2"; STATE="$3"; REVIEWED="$4"; DESC="$5"

[[ "$REVIEWED" =~ ^[0-9a-f]{40}$ ]] || { echo "sha must be a full 40-char commit SHA" >&2; exit 2; }
case "$GATE" in browser | review | uiux) ;; *) echo "bad gate" >&2; exit 2 ;; esac
case "$STATE" in success | failure) ;; *) echo "bad state" >&2; exit 2 ;; esac

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
HEAD="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
SHA="$(gh api "repos/$REPO/commits/$REVIEWED" --jq .sha)"
if [[ "$STATE" == success && "$SHA" != "$HEAD" ]]; then
  echo "Refusing: PR #$PR head is ${HEAD:0:7}, not reviewed commit ${SHA:0:7}. Re-review the new head." >&2
  exit 1
fi
gh api "repos/$REPO/statuses/$SHA" \
  -f state="$STATE" -f context="gate/$GATE" -f description="${DESC:0:140}" >/dev/null
echo "gate/$GATE=$STATE on $SHA"
```

## Prompt

```text
You are the review gate for PR <N>. Review exactly the commit <SHA>.
First run `gh pr view <N> --json headRefOid`; if it differs from <SHA>, stop and report.
Check out <SHA> in a fresh worktree and review it against AGENTS.md and the spec.
Post a PR comment with findings marked BLOCKING or NON-BLOCKING, with file:line.
Verdict: if there are no blocking findings run
  bash scripts/gate-status.sh <N> review success <SHA> "<short reason>"
otherwise use `failure`. Do not fix code and do not merge.
```

## Steps

1. Add the gate rule to `AGENTS.md` and commit `scripts/gate-status.sh`.
2. Start each gate agent with the PR number and the full head SHA it must review (`gh pr view <N> --json headRefOid`).
3. The agent reviews that SHA in its own worktree and posts its verdict with the script.
4. After any push or rebase, read the new head SHA and repeat step 2 for every gate.
5. Merge only when all three statuses are `success` on the current head (`gh api repos/<owner>/<repo>/commits/<SHA>/status`).

## Why it works

A commit status belongs to a SHA, not to a PR, so a push cannot inherit it. The script re-reads the head at post time, which closes the gap where the head moves while the agent is still reviewing. Requiring a full 40-character SHA stops an agent passing a branch name that later points elsewhere.
