#!/usr/bin/env bash
# Usage: npm run ci:local -- <pr-number>
# GitHub Actions is off for this account, so CI is run by hand. This runs exactly the steps of
# .github/workflows/ci.yml (and workflows-content.yml for workflow PRs) against ONE pinned commit:
#   1. resolve the PR head SHA FIRST (gh);
#   2. create a temp worktree at THAT SHA (never the branch tip), `npm ci` there;
#   3. classify the lane like gate-merge.sh (scripts/gate-lane.ts); content lane runs only the
#      content checks (workflows:validate + gitleaks), the code lane runs ci.yml (a code PR that also
#      touches content/workflows/** additionally runs the content checks);
#   4. e2e (seed, db:reset:test, e2e, then E2E_PROD=1 e2e) runs under the shared DB lock, and the
#      user's data is ALWAYS restored afterwards (`npm run seed && npm run news:import`, via a trap);
#   5. posts commit status `ci/local` (success or failure) on THAT SHA; success is refused if the PR
#      head moved during the run (same rule as gate-status.sh).
# Log: /private/tmp/ci-local-pr<PR>-<sha7>.log. Env overrides: CI_LOCAL_DB_LOCK (lock script),
# CI_LOCAL_ENV_FILE (.env.local to copy into the worktree), CI_LOCAL_PORT_START (default 3490).
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

# ---------------------------------------------------------------------------------------------
# Inner mode: runs while the DB lock is held. Seeds fixtures, runs e2e, always restores user data.
# ---------------------------------------------------------------------------------------------
if [[ "${CI_LOCAL_DB_BLOCK:-}" == 1 ]]; then
  restore() {
    echo "==> restoring user data: npm run seed && npm run news:import (in $ROOT)"
    (cd "$ROOT" && npm run seed && npm run news:import) || echo "WARNING: data restore failed; run it by hand" >&2
  }
  trap restore EXIT
  cd "$CI_LOCAL_WT" || exit 1
  export CI=1 PLAYWRIGHT_PORT="$CI_LOCAL_PORT"
  step() {
    echo "==> $*"
    "$@" || { echo "FAILED: $*" >&2; exit 1; }
  }
  step npm run seed
  step npm run db:reset:test
  step npx playwright install chromium
  step npm run e2e
  if [[ "$CI_LOCAL_LANE" == code ]]; then
    echo "==> E2E_PROD=1 npm run e2e"
    E2E_PROD=1 npm run e2e || { echo "FAILED: E2E_PROD=1 npm run e2e" >&2; exit 1; }
  fi
  exit 0
fi

PR="${1:-}"
if [[ -z "$PR" || ! "$PR" =~ ^[0-9]+$ ]]; then
  echo "usage: npm run ci:local -- <pr-number>" >&2
  exit 2
fi

cd "$ROOT" || exit 1
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)" || exit 1

# 1. Resolve the head SHA FIRST. Everything below runs against this commit.
SHA="$(gh pr view "$PR" --json headRefOid --jq .headRefOid)"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "could not resolve the PR head SHA (got '$SHA')" >&2
  exit 1
fi

LOG="/private/tmp/ci-local-pr${PR}-${SHA:0:7}.log"
exec > >(tee -a "$LOG") 2>&1
echo "ci-local: PR #$PR at $SHA  (log: $LOG)  $(date)"

WT=""
RESULT=failure
SUMMARY="ci-local aborted before finishing"
post_status() { # <state> <desc>
  gh api "repos/$REPO/statuses/$SHA" -f state="$1" -f context="ci/local" -f description="${2:0:140}" >/dev/null
}

finish() {
  local rc=$?
  trap - EXIT
  if [[ -n "$WT" && -d "$WT" ]]; then
    git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"
  fi
  if [[ "$RESULT" == success ]]; then
    local now
    now="$(gh pr view "$PR" --json headRefOid --jq .headRefOid 2>/dev/null || true)"
    if [[ "$now" != "$SHA" ]]; then
      echo "Refusing to post success: PR #$PR head is now ${now:0:7}, not ${SHA:0:7}. Re-run." >&2
      RESULT=failure
      SUMMARY="head moved during the run; not posting success"
      post_status failure "$SUMMARY" 2>/dev/null || true
      echo "ci/local=failure (head moved) on $SHA" >&2
      exit 1
    fi
  fi
  if post_status "$RESULT" "$SUMMARY"; then
    echo "ci/local=$RESULT on $SHA: $SUMMARY"
  else
    echo "WARNING: could not post ci/local status" >&2
    rc=1
  fi
  [[ "$RESULT" == success ]] && exit 0
  exit $((rc == 0 ? 1 : rc))
}
trap finish EXIT
post_status pending "ci:local running on ${SHA:0:7}" || true

# 2. Worktree at THAT SHA.
if ! git fetch --quiet origin main "refs/pull/$PR/head"; then
  SUMMARY="could not fetch origin/main and refs/pull/$PR/head"
  exit 1
fi
if ! git cat-file -e "${SHA}^{commit}" 2>/dev/null; then
  SUMMARY="head commit not present after fetching refs/pull/$PR/head (head moved?)"
  exit 1
fi
# Not under /tmp: tests/unit/m2/install-temp-claude.test.ts assumes the checkout is outside a temp dir.
WT_BASE="${CI_LOCAL_WT_BASE:-$HOME/.cache/firstmate-ci-local}"
mkdir -p "$WT_BASE"
WT="$(mktemp -d "$WT_BASE/wt.XXXXXX")"
if ! git worktree add --detach --quiet "$WT" "$SHA"; then
  SUMMARY="could not create worktree at ${SHA:0:7}"
  WT=""
  exit 1
fi

# 3. Lane (same classification as gate-merge.sh).
TSX="$ROOT/node_modules/.bin/tsx"
[[ -x "$TSX" ]] || TSX="npx tsx"
NAME_STATUS="$(git diff --name-status --find-renames --find-copies "origin/main...$SHA")" || {
  SUMMARY="git diff failed"
  exit 1
}
if ! LANE_OUT="$(printf '%s\n' "$NAME_STATUS" | $TSX "$ROOT/scripts/gate-lane.ts" 2>&1)"; then
  SUMMARY="lane classification failed: $LANE_OUT"
  exit 1
fi
LANE="${LANE_OUT#lane=}"
LANE="${LANE%% *}"
TOUCHES="${LANE_OUT##*touches_workflows=}"
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
echo "Lane: $LANE (touches_workflows=$TOUCHES)"

DONE=()
step() { # <label> <cmd...>
  local label="$1"
  shift
  echo "==> [$label] $*"
  if ! "$@"; then
    SUMMARY="FAILED at $label (lane $LANE); done: ${DONE[*]:-none}. Log $LOG"
    echo "$SUMMARY" >&2
    exit 1
  fi
  DONE+=("$label")
}

cd "$WT" || exit 1
ENV_SRC="${CI_LOCAL_ENV_FILE:-$ROOT/.env.local}"
if [[ ! -f "$ENV_SRC" ]]; then
  # In a linked worktree, fall back to the primary checkout's .env.local.
  PRIMARY="$(cd "$ROOT" && cd "$(git rev-parse --git-common-dir)/.." && pwd)"
  ENV_SRC="$PRIMARY/.env.local"
fi
[[ -f "$ENV_SRC" ]] && cp "$ENV_SRC" .env.local
step npm-ci npm ci

# 4a. Content checks (workflows-content.yml): validate + gitleaks over every commit in the range.
content_checks() {
  step workflows-validate npm run workflows:validate
  if ! command -v gitleaks >/dev/null 2>&1; then
    SUMMARY="gitleaks is not installed (required by workflows-content.yml); brew install gitleaks"
    echo "$SUMMARY" >&2
    exit 1
  fi
  local base
  base="$(git -C "$ROOT" merge-base origin/main "$SHA")"
  step gitleaks gitleaks git --redact --verbose --log-opts="${base}..${SHA}" .
}

# 4b. ci.yml `checks` job.
share_skills_identical() {
  local a=.claude/skills/share-workflow/SKILL.md b=.agents/skills/share-workflow/SKILL.md
  if [[ ! -e "$a" && ! -e "$b" ]]; then
    echo "no share-workflow skill yet"
    return 0
  fi
  cmp "$a" "$b"
}

if [[ "$LANE" == content ]]; then
  content_checks
else
  step share-skills share_skills_identical
  step typecheck npm run typecheck
  step lint npm run lint
  step test npm test
  step build npm run build
  step exercises-verify npm run exercises:verify
  [[ "$TOUCHES" == 1 ]] && content_checks
fi

# 4c. ci.yml `e2e` job, under the shared DB lock (code lane only; the content lane has no e2e).
if [[ "$LANE" == code ]]; then
  PORT="${CI_LOCAL_PORT_START:-3490}"
  while [[ "$PORT" == 3000 || "$PORT" == 3100 || "$PORT" == 3457 ]] || nc -z localhost "$PORT" >/dev/null 2>&1 \
    || lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
    PORT=$((PORT + 1))
  done
  echo "e2e port: $PORT"

  LOCK_SH="${CI_LOCAL_DB_LOCK:-/private/tmp/claude-501/-Users-raymundrafael-Desktop-repos-firstmate-firstmate-ai-playground/306262ac-df6b-4239-a527-cb2a8a8b93ce/scratchpad/db-lock.sh}"
  if [[ ! -x "$LOCK_SH" && ! -f "$LOCK_SH" ]]; then
    # Fallback: a repo-local mkdir lock with the same semantics as db-lock.sh.
    LOCK_SH="$WT/.ci-local-db-lock.sh"
    COMMON="$(cd "$ROOT" && git rev-parse --git-common-dir)"
    cat >"$LOCK_SH" <<EOF
#!/usr/bin/env bash
LOCK="$(cd "$ROOT" && cd "$COMMON" && pwd)/fm-db.lock"
for i in \$(seq 1 900); do
  if mkdir "\$LOCK" 2>/dev/null; then
    echo "\$\$ \$(pwd)" >"\$LOCK/owner"
    trap 'rm -rf "\$LOCK"' EXIT INT TERM
    "\$@"; exit \$?
  fi
  pid=\$(cut -d' ' -f1 "\$LOCK/owner" 2>/dev/null); [ -n "\$pid" ] && ! kill -0 "\$pid" 2>/dev/null && rm -rf "\$LOCK"
  sleep 2
done
echo "db-lock: timed out waiting" >&2; exit 75
EOF
    chmod +x "$LOCK_SH"
  fi

  step e2e env CI_LOCAL_DB_BLOCK=1 CI_LOCAL_WT="$WT" CI_LOCAL_PORT="$PORT" CI_LOCAL_LANE="$LANE" \
    bash "$LOCK_SH" bash "$HERE/ci-local.sh"
  DONE+=("e2e-prod")
fi

RESULT=success
SUMMARY="ci:local passed (lane $LANE): ${DONE[*]}"
exit 0
