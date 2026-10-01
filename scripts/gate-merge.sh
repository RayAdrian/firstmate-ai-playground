#!/usr/bin/env bash
# Usage: npm run gate:merge -- <pr-number>
# Squash-merges a PR, working on ONE pinned commit (PRD §16.7 WF-22):
#   1. resolve the head SHA first (headRefOid);
#   2. compute the changed files for THAT SHA (git diff --name-status --find-renames --find-copies
#      origin/main...SHA, not the PR files API) and classify the lane with scripts/gate-lane.ts;
#   3. CI: require EITHER every GitHub check run on SHA completed and successful (pending means refuse)
#      OR the `ci/local` commit status on SHA to be `success` (posted by scripts/ci-local.sh; GitHub
#      Actions is off, so CI is run manually);
#   4. re-read headRefOid and refuse if it moved;
#   5. merge with --match-head-commit SHA.
# Lanes:
#   content (only content/workflows/** direct children with allowlisted names): needs green CI plus
#     the `validate` and `gitleaks` check runs. No gate statuses, labels, approval or up-to-date-ness.
#   code (everything else, including mixed PRs): all three gate statuses (gate/browser, gate/review,
#     gate/uiux) `success` on SHA, the three gate labels, and not behind main. A code-lane PR that
#     also touches content/workflows/** additionally needs the content checks.
# Run from the primary checkout (gh deletes the branch after merging).
set -euo pipefail

PR="${1:-}"
if [[ -z "$PR" ]]; then
  echo "usage: npm run gate:merge -- <pr-number>" >&2
  exit 2
fi
if [[ ! "$PR" =~ ^[0-9]+$ ]]; then
  echo "pr number must be numeric" >&2
  exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TSX="$HERE/../node_modules/.bin/tsx"
[[ -x "$TSX" ]] || TSX="npx tsx"

refuse() {
  echo "Refusing to merge PR #$PR at ${SHA:0:7}:" >&2
  printf '  - %s\n' "$@" >&2
  exit 1
}

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

# 1. Resolve the head SHA FIRST. Everything below is evaluated against this commit.
SHA="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "could not resolve the PR head SHA (got '$SHA')" >&2
  exit 1
fi

# 2. Changed files for that SHA, from git (the PR files API reports the current head and caps at 3000).
if ! git fetch --quiet origin main "refs/pull/$PR/head"; then
  refuse "could not fetch origin/main and refs/pull/$PR/head"
fi
if ! git cat-file -e "${SHA}^{commit}" 2>/dev/null; then
  refuse "head commit is not present after fetching refs/pull/$PR/head (head moved?); re-run"
fi
if ! NAME_STATUS="$(git diff --name-status --find-renames --find-copies "origin/main...$SHA")"; then
  refuse "git diff failed for origin/main...${SHA:0:7}"
fi

# 3. Classify the lane (a pure function; renames and copies count both old and new paths).
if ! LANE_OUT="$(printf '%s\n' "$NAME_STATUS" | $TSX "$HERE/gate-lane.ts" 2>&1)"; then
  refuse "lane classification failed: $LANE_OUT"
fi
LANE="${LANE_OUT#lane=}"
LANE="${LANE%% *}"
TOUCHES="${LANE_OUT##*touches_workflows=}"

# Content lane only holds regular files (mode 100644). Symlinks (120000), gitlinks (160000) and
# executables (100755) are code. Fail closed: capture the whole listing first (no `grep -q` on a pipe,
# which can die of SIGPIPE under pipefail and read as "clean"); any error or odd line means code lane.
if [[ "$LANE" == content ]]; then
  if ! RAW="$(git diff --raw --no-abbrev --find-renames --find-copies "origin/main...$SHA")"; then
    LANE=code
  else
    while IFS= read -r rawline; do
      [[ -z "$rawline" ]] && continue
      if [[ ! "$rawline" =~ ^:[0-7]{6}\ ([0-7]{6})\  ]]; then
        LANE=code
        break
      fi
      newmode="${BASH_REMATCH[1]}"
      if [[ "$newmode" != 100644 && "$newmode" != 000000 ]]; then
        LANE=code
        break
      fi
    done <<<"$RAW"
  fi
fi

if [[ "$LANE" == content ]]; then
  echo "Lane: content (content/workflows/** only)"
else
  echo "Lane: code"
fi

FAIL=()

# 4. CI: either every check run on SHA is green (rules below, unchanged), or the ci/local status on SHA
# is `success` (scripts/ci-local.sh ran the CI steps locally on exactly this commit).
STATUSES="$(gh api "repos/$REPO/commits/$SHA/status" --jq '.statuses[] | "\(.context)=\(.state)"')"
CI_FAIL=()
CHECKS="$(gh api --paginate "repos/$REPO/commits/$SHA/check-runs?per_page=100" \
  --jq '.check_runs[] | "\(.name)=\(.status)/\(.conclusion)"')"
if [[ -z "$CHECKS" ]]; then
  CI_FAIL+=("no CI check runs found on ${SHA:0:7}")
else
  while IFS= read -r line; do
    if [[ "$LANE" == content ]]; then
      # Content lane is strict: every check run must be completed/success.
      case "${line#*=}" in
        completed/success) ;;
        *) CI_FAIL+=("CI check ${line%%=*}: ${line#*=}") ;;
      esac
    else
      # Code lane: unchanged from main (lesson 5.3); neutral/skipped allowed.
      case "${line#*=}" in
        completed/success | completed/skipped | completed/neutral) ;;
        *) CI_FAIL+=("CI check ${line%%=*}: ${line#*=}") ;;
      esac
    fi
  done <<<"$CHECKS"
fi

# Content checks are required in the content lane and whenever a code-lane PR touches content/workflows/**.
if [[ "$LANE" == content || "$TOUCHES" == 1 ]]; then
  for req in validate gitleaks; do
    grep -qxF "$req=completed/success" <<<"$CHECKS" || CI_FAIL+=("required content check '$req' is missing or not successful on ${SHA:0:7}")
  done
fi

if grep -qxF "ci/local=success" <<<"$STATUSES"; then
  echo "CI: ci/local=success on ${SHA:0:7} (local run)"
elif ((${#CI_FAIL[@]} > 0)); then
  FAIL+=("${CI_FAIL[@]}" "status ci/local is not success on ${SHA:0:7} (run: npm run ci:local -- $PR)")
fi

if [[ "$LANE" == code ]]; then
  # Must be rebased on current main (not behind)
  BEHIND="$(gh api "repos/$REPO/compare/main...$SHA" --jq .behind_by)"
  ((BEHIND == 0)) || FAIL+=("branch is $BEHIND commit(s) behind main; rebase on main and re-run the gates")

  LABELS="$(gh pr view "$PR" --json labels --jq '.labels[].name')"
  for label in gate:browser-green gate:review-green gate:uiux-green; do
    grep -qxF "$label" <<<"$LABELS" || FAIL+=("missing label $label")
  done

  for ctx in gate/browser gate/review gate/uiux; do
    grep -qxF "$ctx=success" <<<"$STATUSES" || FAIL+=("status $ctx is not success on ${SHA:0:7}")
  done
fi

if ((${#FAIL[@]} > 0)); then
  refuse "${FAIL[@]}"
fi

# 5. The head must not have moved while we were checking.
NOW="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
if [[ "$NOW" != "$SHA" ]]; then
  echo "head moved from $SHA to $NOW; re-run" >&2
  exit 1
fi

# 6. Merge, pinned to the SHA from step 1.
if [[ "$LANE" == content ]]; then
  echo "Content-lane checks green for PR #$PR at ${SHA:0:7}. Merging (squash)."
else
  echo "All gates green for PR #$PR at ${SHA:0:7}. Merging (squash)."
fi
gh pr merge "$PR" --squash --delete-branch --match-head-commit "$SHA"
