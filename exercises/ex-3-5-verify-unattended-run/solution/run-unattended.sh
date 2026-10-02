#!/usr/bin/env bash
# Run one agent task unattended, on a throwaway branch of the repo in $WORKDIR, and say PASS
# only when the evidence supports it. Nothing is ever merged or pushed: a person reviews the branch.
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
# Exit codes: 0 PASS, 1 test gate failed, 2 stopped at MAX_SECONDS, 3 agent exited non-zero,
#             4 agent changed nothing, 5 agent changed a protected path.
#
# Evidence in RUN_DIR: run.log (steps and exit codes), agent.log (the agent's output),
# tests.log (the test gate's output), diff.stat, diff.patch, files.txt and verdict.

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

log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$RUN_DIR/run.log"; }

BASE=$(git rev-parse HEAD)
BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BASE_BRANCH" = "HEAD" ] && BASE_BRANCH=$BASE
BRANCH=agent/$(basename "$RUN_DIR")

# One exit path, so every outcome writes a verdict and leaves the repo on the branch you started from.
finish() { # finish <exit code> <reason>
  if [ "$1" -eq 0 ]; then echo "PASS" > "$RUN_DIR/verdict"; else echo "FAIL: $2" > "$RUN_DIR/verdict"; fi
  log "VERDICT: $(cat "$RUN_DIR/verdict")"
  git checkout -q "$BASE_BRANCH"
  log "Review with: git diff $BASE..$BRANCH   (nothing was merged or pushed)"
  exit "$1"
}

git checkout -q -b "$BRANCH"
log "START branch=$BRANCH base=$BASE max_seconds=$MAX_SECONDS"
log "AGENT_CMD: $AGENT_CMD"

# 1. Run the agent with a stop condition. Job control (set -m) gives it its own process group,
#    so a stop also takes down anything the agent started.
set -m
bash -c "$AGENT_CMD" > "$RUN_DIR/agent.log" 2>&1 < /dev/null &
agent=$!
timed_out=0
started=$SECONDS
while kill -0 "$agent" 2>/dev/null; do
  if [ $((SECONDS - started)) -ge "$MAX_SECONDS" ]; then
    timed_out=1
    log "STOP: agent still running after ${MAX_SECONDS}s, killing it"
    kill -TERM -- "-$agent" 2>/dev/null
    sleep 1
    kill -KILL -- "-$agent" 2>/dev/null
    break
  fi
  sleep 1
done
{ wait "$agent"; } 2>/dev/null
agent_rc=$?
set +m
log "AGENT_EXIT=$agent_rc"

# 2. Snapshot what the agent did, before judging it. The branch keeps the evidence for review.
git add -A
git diff --cached --stat "$BASE" > "$RUN_DIR/diff.stat"
git diff --cached "$BASE" > "$RUN_DIR/diff.patch"
git diff --cached --name-only "$BASE" > "$RUN_DIR/files.txt"
if [ -s "$RUN_DIR/files.txt" ]; then
  git commit -qm "agent run $(basename "$RUN_DIR"): unreviewed"
fi
log "FILES_CHANGED=$(wc -l < "$RUN_DIR/files.txt" | tr -d ' ')"

# 3. Judge it. Order matters: the cheapest, hardest evidence first.
[ "$timed_out" -eq 1 ] && finish 2 "stopped after ${MAX_SECONDS}s without finishing"
[ "$agent_rc" -ne 0 ] && finish 3 "agent exit code $agent_rc"
[ -s "$RUN_DIR/files.txt" ] || finish 4 "agent changed nothing"
for prefix in $PROTECTED; do
  if grep -q "^$prefix" "$RUN_DIR/files.txt"; then finish 5 "protected path changed: $prefix"; fi
done

# 4. The test gate: this script runs the tests. The agent's own claim that they pass is not evidence.
log "TEST_CMD: $TEST_CMD"
bash -c "$TEST_CMD" > "$RUN_DIR/tests.log" 2>&1 < /dev/null
test_rc=$?
log "TEST_EXIT=$test_rc"
[ "$test_rc" -eq 0 ] || finish 1 "test gate failed (exit $test_rc)"

finish 0
