#!/usr/bin/env bash
# Usage: npm run gate:merge -- <pr-number>
# Squash-merges a PR only if all three gate labels are present (PRD section 12).
set -euo pipefail

PR="${1:-}"
if [[ -z "$PR" ]]; then
  echo "usage: npm run gate:merge -- <pr-number>" >&2
  exit 2
fi

REQUIRED=(gate:browser-green gate:review-green gate:uiux-green)
LABELS="$(gh pr view "$PR" --json labels --jq '.labels[].name')"

MISSING=()
for label in "${REQUIRED[@]}"; do
  if ! grep -qxF "$label" <<<"$LABELS"; then
    MISSING+=("$label")
  fi
done

if (( ${#MISSING[@]} > 0 )); then
  echo "Refusing to merge PR #$PR. Missing gate labels: ${MISSING[*]}" >&2
  exit 1
fi

echo "All gates green for PR #$PR. Merging (squash)."
gh pr merge "$PR" --squash --delete-branch
