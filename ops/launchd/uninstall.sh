#!/bin/bash
# Remove the First Mate news LaunchAgent (PRD I-5). Safe to run when it is not installed. Keeps the log file.
# Usage: ops/launchd/uninstall.sh            (or: npm run news:schedule:uninstall)
set -euo pipefail

LABEL="tech.firstmate.playground.news"
LAUNCHCTL="${FM_LAUNCHCTL:-launchctl}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

"$LAUNCHCTL" bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true

if [ -f "$PLIST" ]; then
  rm -f "$PLIST"
  echo "Uninstalled $LABEL (log kept at $HOME/Library/Logs/fm-playground/news.log)"
else
  echo "$LABEL is not installed"
fi
