#!/usr/bin/env bash
# Usage: scripts/gate-status.sh <pr#> <browser|review|uiux> <success|failure> <sha> "<description>"
# Posts commit status gate/<gate> on <sha>, the commit that was actually reviewed.
# Refuses to post `success` unless <sha> is still the PR head, so an approval can't cover unreviewed code.
set -euo pipefail

if (($# != 5)); then
  echo 'usage: scripts/gate-status.sh <pr#> <browser|review|uiux> <success|failure> <sha> "<description>"' >&2
  exit 2
fi

PR="$1"
GATE="$2"
STATE="$3"
REVIEWED="$4"
DESC="$5"

if [[ ! "$REVIEWED" =~ ^[0-9a-f]{40}$ ]]; then
  echo "sha must be a full 40-character lowercase hex commit SHA, not a branch or abbreviated ref" >&2
  exit 2
fi

case "$GATE" in browser | review | uiux) ;; *)
  echo "gate must be browser, review or uiux" >&2
  exit 2
  ;;
esac
case "$STATE" in success | failure) ;; *)
  echo "state must be success or failure" >&2
  exit 2
  ;;
esac

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
HEAD="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
SHA="$(gh api "repos/$REPO/commits/$REVIEWED" --jq .sha)"
if [[ "$STATE" == success && "$SHA" != "$HEAD" ]]; then
  echo "Refusing: PR #$PR head is ${HEAD:0:7}, not reviewed commit ${SHA:0:7}. Re-review the new head." >&2
  exit 1
fi

# GitHub limits descriptions to 140 characters.
gh api "repos/$REPO/statuses/$SHA" \
  -f state="$STATE" -f context="gate/$GATE" -f description="${DESC:0:140}" >/dev/null

echo "gate/$GATE=$STATE on $SHA"
