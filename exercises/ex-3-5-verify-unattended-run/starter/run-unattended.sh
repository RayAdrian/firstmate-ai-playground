#!/usr/bin/env bash
# Run one agent task unattended, on a throwaway branch of the repo in $WORKDIR.
#
#   WORKDIR=~/code/my-app ./run-unattended.sh
#
# Settings (environment variables):
#   WORKDIR      the git repo the agent works in           (default: .)
#   TASK_FILE    the prompt file                           (default: ./task.md)
#   RUN_DIR      where this run's evidence is written      (default: ~/agent-runs/<timestamp>)
#   AGENT_CMD    the command that runs the agent, in $WORKDIR
#   MAX_SECONDS  stop condition: wall-clock limit          (default: 1800)
#   TEST_CMD     the test gate, run in $WORKDIR            (default: npm test)
#   PROTECTED    space-separated path prefixes the agent may not change (default: test/)
#
# STARTER: this script runs the agent and believes whatever happens. It has no stop
# condition, no test gate and no evidence, and it ships the result without a review.
# Fix that. README.md lists exactly what a finished run must do.

set -u

WORKDIR=${WORKDIR:-.}
TASK_FILE=${TASK_FILE:-$PWD/task.md}
RUN_DIR=${RUN_DIR:-$HOME/agent-runs/$(date +%Y%m%d-%H%M%S)}
MAX_SECONDS=${MAX_SECONDS:-1800}
TEST_CMD=${TEST_CMD:-npm test}
PROTECTED=${PROTECTED:-test/}
AGENT_CMD=${AGENT_CMD:-'claude -p "$(cat "$TASK_FILE")" --permission-mode dontAsk --allowedTools "Read,Edit,Bash(npm test *)" --max-budget-usd 5 --output-format stream-json --verbose'}
export TASK_FILE

mkdir -p "$RUN_DIR"
RUN_DIR=$(cd "$RUN_DIR" && pwd)
cd "$WORKDIR" || exit 64

BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BRANCH=agent/$(basename "$RUN_DIR")
git checkout -q -b "$BRANCH"

echo "Starting agent on $BRANCH"
bash -c "$AGENT_CMD" > "$RUN_DIR/agent.log" 2>&1 < /dev/null

git add -A
git commit -qm "agent run"

# Looks good, ship it.
git checkout -q "$BASE_BRANCH"
git merge --ff-only "$BRANCH"

echo "Run finished"
