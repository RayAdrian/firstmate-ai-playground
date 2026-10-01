---
title: Patch-id check before re-attesting gates after a rebase
problem: A pure rebase forces a full re-review even though the diff did not change.
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
A PR with three green gates fell behind main by one unrelated commit. The rebase changed the head SHA, which dropped every status, so three reviewers had to re-read a diff that had not changed.

### After
A script proves the rebase was mechanical (identical patch-id, no file overlap with the new main commits, CI green) and only then re-posts the gate statuses on the new head. The description says "mechanical re-attest" so the audit trail shows it was not a fresh review. Any other change still gets a full re-gate.

## Setup

The repo rule stays strict: any push invalidates approvals. This script is the one narrow exception, and it only automates re-posting statuses a reviewer already gave on the old SHA.

```bash path=scripts/reattest.sh kind=script
#!/usr/bin/env bash
# Usage: scripts/reattest.sh <pr#> <old-approved-sha> <gate>...
set -euo pipefail
PR=$1; OLD=$2; shift 2
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
git fetch -q origin
NEW=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)

BASE_OLD=$(git merge-base "$OLD" origin/main)
P_OLD=$(git diff "$BASE_OLD" "$OLD" | git patch-id --stable | cut -d' ' -f1)
P_NEW=$(git diff origin/main "$NEW" | git patch-id --stable | cut -d' ' -f1)
[ "$P_OLD" = "$P_NEW" ] || { echo "patch-id differs: full re-gate required"; exit 1; }
git merge-base --is-ancestor origin/main "$NEW" || { echo "not rebased on main"; exit 1; }

# Main's new commits must not touch any file the PR touches.
PR_FILES=$(git diff --name-only origin/main "$NEW" | sort -u)
MAIN_FILES=$(git diff --name-only "$BASE_OLD" origin/main | sort -u)
OVERLAP=$(comm -12 <(echo "$PR_FILES") <(echo "$MAIN_FILES") | grep -v '^$' || true)
[ -z "$OVERLAP" ] || { echo "overlap with main: $OVERLAP; full re-gate required"; exit 1; }

# Every CI check run on the new head must be complete and successful.
BAD=$(gh api "repos/$REPO/commits/$NEW/check-runs" \
  --jq '.check_runs[] | select(.status != "completed" or .conclusion != "success") | .name')
[ -z "$BAD" ] || { echo "CI not green on $NEW: $BAD"; exit 1; }

for g in "$@"; do
  bash scripts/gate-status.sh "$PR" "$g" success "$NEW" \
    "mechanical re-attest: identical patch ${P_NEW:0:7} from ${OLD:0:7}, disjoint from main, CI green"
done
```

## Prompt

```text
PR <N> was approved on <OLD_SHA> by gates browser, review and uiux, then rebased onto main.
Run `bash scripts/reattest.sh <N> <OLD_SHA> browser review uiux`.
If it exits non-zero, do NOT post statuses yourself: report its message and ask for a full re-gate.
If it succeeds, show the three status lines it printed.
```

## Steps

1. Record the approved SHA before rebasing (`gh pr view <N> --json headRefOid`).
2. Rebase on `origin/main` and push, then wait for CI on the new head to finish.
3. Run the script with the old SHA and the gates that were green on it.
4. If it refuses (patch-id differs, file overlap, CI red), run all gates again from scratch.
5. Merge only after the three statuses show on the new head.

## Why it works

`git patch-id --stable` hashes the diff content and ignores line numbers and commit metadata, so equal ids mean the reviewers saw the same change. Checking that main's new commits touch none of the PR's files covers the case where an identical patch now behaves differently against changed neighbouring code. CI on the new head covers what neither check can see.
