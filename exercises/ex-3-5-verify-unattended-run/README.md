# ex-3-5: Verify an unattended run

`run-unattended.sh` runs an agent task on a throwaway branch with nobody watching. As shipped it believes whatever the agent says: it has no stop condition, no test gate and no evidence, and it merges the result into your branch. You add the verification.

This is the script you would put behind cron or CI for an overnight run. The point is what you can trust when you read its result in the morning.

## Setup

```bash
cp -r exercises/ex-3-5-verify-unattended-run/starter ~/fm-ex/ex-3-5-verify-unattended-run
cd ~/fm-ex/ex-3-5-verify-unattended-run
```

Needs Node 22 or newer, `bash` and `git`. No dependencies to install, and no model calls in the tests.

## What is already there

- `run-unattended.sh`: the script you edit. Its header lists the settings (`WORKDIR`, `AGENT_CMD`, `MAX_SECONDS`, `TEST_CMD`, `PROTECTED`, `RUN_DIR`).
- `task.md`: the prompt the default `AGENT_CMD` hands to `claude -p`.
- `fixtures/app/`: a tiny repo with a bug and two failing tests. The tests copy it to a temp directory for every run.
- `tests/`: the tests, plus small fake agents in `tests/agents/` (one fixes the bug, one lies, one edits the tests, one does nothing, one crashes, one hangs) and shims for `git` and `gh` in `tests/bin/` that record what your script calls. Don't edit `tests/`.

## Your work

Make the script behave like this, for any agent:

1. **Stop condition.** If the agent is still running after `MAX_SECONDS`, kill it, record `STOP` in `run.log` and finish with exit code **2**.
2. **Agent exit code.** If the agent exits non-zero, finish with exit code **3**, even if its work looks fine.
3. **Visible failure on no change.** If nothing changed, finish with exit code **4**. A run that did nothing is not a quiet success.
4. **Protected paths.** If the agent changed a file under any `PROTECTED` prefix (default `test/`), finish with exit code **5**. An agent that edits the tests to make them pass has not fixed anything.
5. **Test gate.** Run `TEST_CMD` yourself in `WORKDIR` after the agent finishes and record `TEST_EXIT=<code>` in `run.log`. Non-zero means exit code **1**. What the agent says about its own tests is not evidence.
6. **Evidence.** Every run leaves these in `RUN_DIR`: `run.log` (steps with exit codes), `agent.log` (the agent's output), `tests.log` (the gate's output), `diff.stat`, `diff.patch` and a `verdict` file that holds `PASS` or `FAIL: <reason>`. Write the diff before you judge the run, so a failed run can still be reviewed.
7. **Never ship.** Remove the merge. The agent's work stays on its `agent/<run>` branch, committed, for a person to review. The script must not push, merge, pull, rebase or call `gh`, and the branch you started on must not move.

Exit code **0** means PASS: the agent finished, changed something, left the protected paths alone, and the gate you ran is green.

Tips:

- Use one `finish <code> <reason>` function so every outcome writes a verdict. It is easy to forget one.
- macOS has no `timeout` command. Poll for the process to end in a loop, and `kill` it when the time is up.
- Run the agent with `< /dev/null`. A script under cron has no terminal, and an agent that waits for input waits forever.

Then run `npm test` until it passes.

## Try it for real

This makes a real, small model call. Use a scratch repo, never a client repo.

```bash
cp -r fixtures/app ~/fm-ex/slugify-app && cd ~/fm-ex/slugify-app
git init -q -b main && git add -A && git commit -qm baseline && cd -

# Claude Code (the default AGENT_CMD)
WORKDIR=~/fm-ex/slugify-app ./run-unattended.sh

# Codex CLI
WORKDIR=~/fm-ex/slugify-app \
AGENT_CMD='codex exec --sandbox workspace-write --json "$(cat "$TASK_FILE")"' \
./run-unattended.sh
```

Then read the evidence the way you would in the morning: `cat <RUN_DIR>/verdict`, `cat <RUN_DIR>/diff.stat`, and `git diff main..agent/<run>`. The default `AGENT_CMD` asks Claude Code for `stream-json`, so `agent.log` holds one JSON event per line, including every shell command the agent ran:

```bash
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | "\(.name): \(.input | tostring)"' <RUN_DIR>/agent.log
```

## Verify

```bash
npm test
```

On the starter it fails: nothing is stopped, tested or recorded, and the result is merged. It passes when every outcome in the list above holds. Each test also checks that your script never merged or pushed.

## Reference

`solution/run-unattended.sh` is the finished script.
