#!/bin/bash
# Install the First Mate news LaunchAgent (PRD I-5). Idempotent.
# Usage: ops/launchd/install.sh            (or: npm run news:schedule:install)
# Test hooks: HOME (plist + log location), FM_LAUNCHCTL (launchctl replacement).
set -euo pipefail

LABEL="tech.firstmate.playground.news"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE="$SCRIPT_DIR/$LABEL.plist"
LAUNCHCTL="${FM_LAUNCHCTL:-launchctl}"
AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST="$AGENT_DIR/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/fm-playground"
LOG_FILE="$LOG_DIR/news.log"

fail=0
NODE_BIN="$(command -v node || true)"
CLAUDE_BIN="$(command -v claude || true)"
NPM_BIN="$(command -v npm || true)"
if [ -z "$NODE_BIN" ]; then echo "error: node not found on PATH" >&2; fail=1; fi
if [ -z "$CLAUDE_BIN" ]; then echo "error: claude not found on PATH" >&2; fail=1; fi
if [ -z "$NPM_BIN" ]; then echo "error: npm not found on PATH" >&2; fail=1; fi
if [ "$fail" -ne 0 ]; then
  echo "Install node and Claude Code, make sure both are on PATH in this shell, then re-run." >&2
  exit 1
fi
if [ ! -x "$REPO/node_modules/.bin/tsx" ]; then
  echo "error: dependencies are not installed in $REPO (run npm ci first)" >&2
  exit 1
fi
if [ ! -f "$REPO/.env.local" ]; then
  echo "warning: $REPO/.env.local is missing; the scheduled run needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" >&2
fi
case "$REPO" in
  */.claude/worktrees/*|*/.worktrees/*)
    echo "warning: installing from a git worktree ($REPO). If it is deleted the job stops working; install from the primary checkout." >&2 ;;
esac

# Absolute PATH for launchd (it starts with an almost empty one): the directories of the binaries we resolved,
# then the usual system locations. Only directories that exist, no duplicates, no ~ or $.
PATH_VALUE=""
add_dir() {
  local d="$1"
  [ -d "$d" ] || return 0
  case ":$PATH_VALUE:" in *":$d:"*) return 0 ;; esac
  PATH_VALUE="${PATH_VALUE:+$PATH_VALUE:}$d"
}
add_dir "$(dirname "$NODE_BIN")"
add_dir "$(dirname "$CLAUDE_BIN")"
add_dir "$(dirname "$NPM_BIN")"
for d in /opt/homebrew/bin /usr/local/bin /usr/bin /bin /usr/sbin /sbin; do add_dir "$d"; done

xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
# Escape for the sed replacement (delimiter |, and & and \).
sed_escape() { printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'; }

mkdir -p "$AGENT_DIR" "$LOG_DIR"

TMP_PLIST="$(mktemp "${TMPDIR:-/tmp}/$LABEL.XXXXXX")"
trap 'rm -f "$TMP_PLIST"' EXIT
sed \
  -e "s|@NPM@|$(sed_escape "$(xml_escape "$NPM_BIN")")|g" \
  -e "s|@REPO@|$(sed_escape "$(xml_escape "$REPO")")|g" \
  -e "s|@PATH@|$(sed_escape "$(xml_escape "$PATH_VALUE")")|g" \
  -e "s|@HOME@|$(sed_escape "$(xml_escape "$HOME")")|g" \
  -e "s|@LOGFILE@|$(sed_escape "$(xml_escape "$LOG_FILE")")|g" \
  "$TEMPLATE" > "$TMP_PLIST"

if command -v plutil >/dev/null 2>&1; then
  plutil -lint "$TMP_PLIST" >/dev/null || { echo "error: generated plist failed plutil -lint" >&2; exit 1; }
fi
if grep -q '@[A-Z]*@' "$TMP_PLIST"; then echo "error: unreplaced placeholder in plist" >&2; exit 1; fi

cp "$TMP_PLIST" "$PLIST"
chmod 644 "$PLIST"

UID_NUM="$(id -u)"
# bootout first so re-installing never fails with "already loaded"; ignore "not loaded".
"$LAUNCHCTL" bootout "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 || true
"$LAUNCHCTL" bootstrap "gui/$UID_NUM" "$PLIST"

echo "Installed $LABEL"
echo "  plist:    $PLIST"
echo "  repo:     $REPO"
echo "  node:     $NODE_BIN"
echo "  claude:   $CLAUDE_BIN"
echo "  log:      $LOG_FILE"
echo "Runs hourly, gated to once per day at/after 08:00 Asia/Manila (no reinstall needed after a timezone change)."
echo "Reinstall after moving the repo or changing where node or claude live."
