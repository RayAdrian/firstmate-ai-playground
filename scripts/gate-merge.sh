#!/usr/bin/env bash
# Usage: npm run gate:merge -- <pr-number>
# Squash-merges a PR only if, for the CURRENT head commit:
#   - all three gate commit statuses (gate/browser, gate/review, gate/uiux) are `success`,
#   - every CI check run succeeded,
# and the PR carries the three gate labels. The merge is pinned to that commit
# (--match-head-commit), so a push after approval cannot slip through.
# Run from the primary checkout (gh deletes the branch after merging).
set -euo pipefail

PR="${1:-}"
if [[ -z "$PR" ]]; then
  echo "usage: npm run gate:merge -- <pr-number>" >&2
  exit 2
fi

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
SHA="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
FAIL=()

# 1. Labels
LABELS="$(gh pr view "$PR" --json labels --jq '.labels[].name')"
for label in gate:browser-green gate:review-green gate:uiux-green; do
  grep -qxF "$label" <<<"$LABELS" || FAIL+=("missing label $label")
done

# 2. Gate commit statuses on this exact SHA (latest state per context)
STATUSES="$(gh api "repos/$REPO/commits/$SHA/status" --jq '.statuses[] | "\(.context)=\(.state)"')"
for ctx in gate/browser gate/review gate/uiux; do
  grep -qxF "$ctx=success" <<<"$STATUSES" || FAIL+=("status $ctx is not success on ${SHA:0:7}")
done

# 3. CI check runs on this SHA: at least one, all successful (skipped/neutral allowed)
CHECKS="$(gh api "repos/$REPO/commits/$SHA/check-runs?per_page=100" \
  --jq '.check_runs[] | "\(.name)=\(.status)/\(.conclusion)"')"
if [[ -z "$CHECKS" ]]; then
  FAIL+=("no CI check runs found on ${SHA:0:7}")
else
  while IFS= read -r line; do
    case "${line#*=}" in
      completed/success | completed/skipped | completed/neutral) ;;
      *) FAIL+=("CI check ${line%%=*}: ${line#*=}") ;;
    esac
  done <<<"$CHECKS"
fi

if ((${#FAIL[@]} > 0)); then
  echo "Refusing to merge PR #$PR at ${SHA:0:7}:" >&2
  printf '  - %s\n' "${FAIL[@]}" >&2
  exit 1
fi

echo "All gates green for PR #$PR at ${SHA:0:7}. Merging (squash)."
gh pr merge "$PR" --squash --delete-branch --match-head-commit "$SHA"
