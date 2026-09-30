#!/bin/bash
# Install the First Mate news LaunchAgent (PRD I-5). Idempotent.
# Usage: ops/launchd/install.sh [--dry-run]   (or: npm run news:schedule:install [-- --dry-run])
#   --dry-run  print the plist, paths and launchctl commands; change nothing and run nothing.
# Test hooks: HOME (plist + log location), FM_LAUNCHCTL (launchctl replacement).
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "usage: install.sh [--dry-run]" >&2; exit 1 ;;
  esac
done

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

RENDERED="$(sed \
  -e "s|@NPM@|$(sed_escape "$(xml_escape "$NPM_BIN")")|g" \
  -e "s|@REPO@|$(sed_escape "$(xml_escape "$REPO")")|g" \
  -e "s|@PATH@|$(sed_escape "$(xml_escape "$PATH_VALUE")")|g" \
  -e "s|@HOME@|$(sed_escape "$(xml_escape "$HOME")")|g" \
  -e "s|@LOGFILE@|$(sed_escape "$(xml_escape "$LOG_FILE")")|g" \
  "$TEMPLATE")"

if command -v plutil >/dev/null 2>&1; then
  printf '%s\n' "$RENDERED" | plutil -lint - >/dev/null || { echo "error: generated plist failed plutil -lint" >&2; exit 1; }
fi
if printf '%s\n' "$RENDERED" | grep -q '@[A-Z]*@'; then echo "error: unreplaced placeholder in plist" >&2; exit 1; fi

UID_NUM="$(id -u)"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[dry-run] nothing will be written or executed."
  echo "[dry-run] plist path:  $PLIST"
  echo "[dry-run] log file:    $LOG_FILE"
  echo "[dry-run] repo:        $REPO"
  echo "[dry-run] node:        $NODE_BIN"
  echo "[dry-run] claude:      $CLAUDE_BIN"
  echo "[dry-run] npm:         $NPM_BIN"
  echo "[dry-run] would run:   mkdir -p $AGENT_DIR $LOG_DIR"
  echo "[dry-run] would run:   $LAUNCHCTL bootout gui/$UID_NUM/$LABEL   (errors ignored)"
  echo "[dry-run] would run:   $LAUNCHCTL bootstrap gui/$UID_NUM $PLIST"
  echo "[dry-run] plist contents:"
  printf '%s\n' "$RENDERED"
  exit 0
fi

mkdir -p "$AGENT_DIR" "$LOG_DIR"
printf '%s\n' "$RENDERED" > "$PLIST"
chmod 644 "$PLIST"

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
