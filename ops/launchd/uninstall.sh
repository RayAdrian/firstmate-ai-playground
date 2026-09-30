#!/bin/bash
# Remove the First Mate news LaunchAgent (PRD I-5). Safe to run when it is not installed. Keeps the log file.
# Usage: ops/launchd/uninstall.sh [--dry-run]   (or: npm run news:schedule:uninstall [-- --dry-run])
#   --dry-run  print what would be done; change nothing and run nothing.
set -euo pipefail

LABEL="tech.firstmate.playground.news"
LAUNCHCTL="${FM_LAUNCHCTL:-launchctl}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "usage: uninstall.sh [--dry-run]" >&2; exit 1 ;;
  esac
done

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[dry-run] nothing will be removed or executed."
  echo "[dry-run] would run:   $LAUNCHCTL bootout gui/$(id -u)/$LABEL   (errors ignored)"
  if [ -f "$PLIST" ]; then echo "[dry-run] would remove: $PLIST"; else echo "[dry-run] $LABEL is not installed (no plist at $PLIST)"; fi
  echo "[dry-run] the log file $HOME/Library/Logs/fm-playground/news.log is kept"
  exit 0
fi

"$LAUNCHCTL" bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true

if [ -f "$PLIST" ]; then
  rm -f "$PLIST"
  echo "Uninstalled $LABEL (log kept at $HOME/Library/Logs/fm-playground/news.log)"
else
  echo "$LABEL is not installed"
fi
