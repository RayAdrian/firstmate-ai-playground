#!/usr/bin/env bash
# Usage: scripts/gate-status.sh <pr#> <browser|review|uiux> <success|failure> "<description>"
# Posts a commit status (context gate/<gate>) on the PR's CURRENT head SHA and prints that SHA.
# A later push moves the head, so an approval never carries over to unreviewed code.
set -euo pipefail

if (($# != 4)); then
  echo 'usage: scripts/gate-status.sh <pr#> <browser|review|uiux> <success|failure> "<description>"' >&2
  exit 2
fi

PR="$1"
GATE="$2"
STATE="$3"
DESC="$4"

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
SHA="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"

# GitHub limits descriptions to 140 characters.
gh api "repos/$REPO/statuses/$SHA" \
  -f state="$STATE" -f context="gate/$GATE" -f description="${DESC:0:140}" >/dev/null

echo "gate/$GATE=$STATE on $SHA"
