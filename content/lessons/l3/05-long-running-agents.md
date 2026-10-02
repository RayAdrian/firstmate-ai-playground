---
slug: l3-long-running-agents
level: 3
sort: 5
title: Long-running and unsupervised agents
objective: Steer a multi-hour session without losing the thread, run agents while you are away on a schedule or in the background, and decide what evidence an unattended run must produce before you trust it.
est_minutes: 40
tool_versions:
  claude_code: "2.1.287"
  codex_cli: "0.154.0"
last_verified_on: "2026-10-02"
differences:
  - "Undo mid-session: Claude Code has `/rewind` (or `Esc` twice on an empty prompt), which restores code, conversation or both, but only for edits made by its file tools. Codex CLI has no undo command (`/undo` was removed), so in Codex, and as the portable habit in both tools, a git commit (or stash) is the checkpoint you roll back to."
  - "Scheduling: Claude Code has `/loop` (needs the session open), cloud routines created with `/schedule` (no machine needed, research preview) and `claude --bg` background sessions. Codex CLI has no scheduler of its own: its Automations live in the ChatGPT desktop app and web, so CLI jobs run from cron, launchd or CI."
  - "Cloud runs: Codex CLI submits and collects cloud tasks with `codex cloud exec --env <ENV_ID>`, then `status`, `diff` and `apply`. Claude Code's cloud side is routines and `claude --cloud`, managed from claude.ai/code."
  - "Unattended permissions: Claude Code uses `--permission-mode dontAsk` plus an `--allowedTools` allowlist. `codex exec` is read-only by default and you widen it with `--sandbox workspace-write`. Each has a bypass flag meant only for an already-isolated machine."
  - "Checking in from your phone: Claude Code has Remote Control (`claude remote-control`, `claude --remote-control` or `/remote-control`) for claude.ai/code and the Claude mobile app. Codex has an experimental `codex remote-control` command (`start`, `stop`, `pair`) that manages a local app-server daemon."
exercise: ex-3-5-verify-unattended-run
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Commit before a long run, so a git checkpoint is always one command away."
    - "Give every unattended run a stop condition and a cap on turns, time or spend."
    - "Decide what evidence a run must leave (log, diff, test output) before you trust it."
  try_this:
    all: { kind: command, text: "git add -A && git commit -m \"checkpoint before agent run\"" }
---

## Concept

[Headless mode](/lessons/l3-headless-agents) gave you one agent call in a script. This lesson is about the long version: a task that runs for hours, or while you are asleep. Three things change when nobody is watching.

- **It drifts.** Over a long session the context fills with old attempts, and the agent starts solving a problem you no longer have.
- **It stalls or overspends.** There is no one to answer a permission prompt, notice a hung command or stop a retry loop.
- **It says it is done.** An agent's summary tells you what it believes. It is not evidence.

**Steer a long session in checkpoints.** Break the work into steps that each end in something checkable: a commit, a green test run, a short note. Read the output as it goes and interrupt early, because a wrong turn is cheap in the first minute and expensive after an hour. Redirect with a specific correction ("stop, use the existing `parseRange` helper in `src/lib/`"), not a restart. Keep context healthy the way [lesson 2.2](/lessons/l2-memory-context) taught: compact or start fresh at a natural boundary, and write a handoff note to a file so the next session starts from disk, not from memory. Commit before every risky step. Session undo covers only part of what an agent can change, and git covers all of it.

**Run work while you are away.** There are four ways, and they differ in what must stay switched on:

- **A background session** on your machine. It keeps running with no terminal attached, but stops if the machine shuts down.
- **A recurring prompt inside a session** (`/loop`). It needs that session open and idle.
- **A cloud run.** It needs nothing of yours, but it works on a fresh clone and cannot see your local files or services.
- **cron, launchd or CI running a headless call.** You own the schedule, the environment and the logging. This app's own daily news digest works this way: launchd starts it each morning, and failures show up in the app as unscored or stale items instead of vanishing.

**Verify before you trust.** A run you did not watch has to produce its own evidence. Require all of these:

1. **Tests you ran**, not tests the agent says it ran. The script runs the test command after the agent exits.
2. **A diff summary.** Which files changed, and are they the ones the task should touch?
3. **A log of the commands the agent ran**, so you can see installs, network calls and deletes.
4. **A stop condition.** A wall-clock limit, a budget or a turn cap, and a record of whether the run finished or was cut off.
5. **Untouched tests.** If the agent can edit the tests, a green gate means nothing (see [lesson 3.2](/lessons/l3-tdd-with-agents)).

```diagram
type: flow
id: unattended-run-gates
title: What an unattended run must pass
summary: The script, not the agent, runs the checks. Any failed check leaves the work on a branch for you to inspect, and only you merge.
steps:
  - id: run
    label: Run
    sub: time-boxed
  - id: gate
    label: Checks
    sub: by script
    emphasis: true
  - id: review
    label: Review
    sub: you read it
  - id: merge
    label: Merge
    sub: you only
exits:
  - from: gate
    label: any fails
    text: FAIL, kept on branch
    style: risk
```

**Design the task so failure is visible.** State one measurable end state ("`npm test` exits 0"), not "make it good". Tell the agent to stop and write a `BLOCKED.md` when it cannot proceed, because an honest stop is better than a confident guess. Put the work on a throwaway branch. Make the script exit non-zero and say why on every failure path. Silent failure is the one outcome you cannot recover from by reading the logs in the morning.

**Choose the permission mode for the run you will not watch.** Nobody can answer a prompt, so the options are to deny what is not allowed, to let a classifier decide, or to allow everything. The first is the safe default: an allowlist of the exact commands the task needs. Allowing everything is only for a throwaway container or VM with nothing valuable inside it, because it also removes the protection against prompt injection (a README or issue that tells the agent to do something else). Claude Code's docs say this about its bypass mode, and Codex's `--help` calls its bypass flag extremely dangerous.

### First Mate tip

Overnight runs on a client MVP are for bounded, checkable work: a refactor with good tests, a dependency bump, the first draft of a test suite. They are not for anything that touches a client's production data or credentials. Use a dev database and a fresh checkout, with only the keys the task needs.

In the morning, in this order: read the verdict and exit code, read the diff summary for files that should not be there (lockfiles, CI config, `.env`, migrations), skim the command log for installs and network calls, run the tests yourself, then read the diff like any other PR. Open a PR only after that, and review it as you would a teammate's. **Never auto-merge and never let an unattended run push to `main`.** Whoever opens the PR owns it, and the client does not care that an agent wrote it.

## Claude Code

**Steer and undo.**

- `Esc` interrupts the current response or tool call. Claude keeps the work done so far, and you can redirect.
- Type while it works and press `Enter` to queue a message. It reaches Claude when the current tool calls finish. `Ctrl+Enter` sends it right away.
- `/rewind` (or `Esc` twice on an empty prompt) opens a menu of your earlier prompts. Pick one, then choose **Restore code and conversation**, **Restore conversation**, **Restore code**, or **Summarize from here** / **Summarize up to here** to free context without losing the instructions.
- Limits: checkpoints cover only Claude's file-editing tools. Changes made through Bash (`rm`, `mv`, `cp`) and edits from most subagents are not restored. It keeps snapshots for the 100 most recent checkpoints. It is not version control, so commit.
- `/btw <question>` asks a side question without adding to the conversation. `/compact`, `/context` and `/clear` work as in [lesson 2.2](/lessons/l2-memory-context).

**Keep it working toward a stop condition with `/goal`.**

```text
/goal all tests in test/auth pass and npm run lint is clean, or stop after 20 turns
```

After each turn a small, fast model (Haiku by default) checks whether the condition holds. If not, Claude starts another turn. The goal clears when it is met or judged impossible, and `/goal` shows status and `/goal clear` removes it. Two things to know for unattended use. The evaluator only reads what is in the conversation, so write a condition Claude's own output can prove ("`npm test` exits 0"). And `/goal` does not change the permission mode, so pair it with an allowlist. It also works non-interactively, and then it loops until done in one invocation:

```bash
claude -p "/goal CHANGELOG.md has an entry for every PR merged this week" \
  --permission-mode dontAsk --allowedTools "Read,Edit,Bash(git log *)"
```

**Run while you are away.**

```bash
claude --bg "investigate the flaky checkout test and report"   # background session, prints an id
claude agents                    # list background sessions and their state
claude logs <id>                 # recent output
claude attach <id>               # open it in this terminal
claude stop <id>                 # stop it (the conversation is kept)
```

Inside a session, `/bg` (or `/background`) moves the current conversation to the background. By default each background session gets its own git worktree, so it does not touch your checkout. If it needs a permission decision it shows **Needs input** and waits, so for unattended work set the mode and allowlist first. A background session started with `claude --bg` uses the directory's `permissions.defaultMode` setting. These sessions run on your machine and stop on shutdown.

In a running session, `Ctrl+B` moves a long Bash command to the background (30 minutes by default, 2 hours at most), and `/tasks` lists them.

**Recurring prompts.** `/loop 5m check if the deploy finished` runs a prompt on an interval while the session is open. Leave the interval out and Claude picks one each time (1 minute to 1 hour). Tasks only fire when Claude Code is running and idle, recurring ones expire after 7 days, and a self-paced loop is not restored on `--resume`.

**Cloud routines.** Run `/schedule daily PR review at 9am` and Claude walks you through saving a routine to your claude.ai account. A routine runs on Anthropic's cloud (research preview), against a fresh clone of the repositories you pick, on a schedule, an API call or GitHub events. The minimum interval is 1 hour. It runs without a permission-mode picker and without stopping for approval, and it pushes to `claude/`-prefixed branches. So scope its repositories, environment and connectors tightly. A green status on a run only means the session ran: open the run and read what happened. `/schedule` needs a claude.ai login, not an API key.

**cron or launchd plus headless.** The classic overnight shape is one script, one schedule:

```bash
# crontab -e : 02:00 on weekdays. cron has a minimal PATH, so use absolute paths.
0 2 * * 1-5  WORKDIR=$HOME/code/client-mvp $HOME/bin/run-unattended.sh >> $HOME/agent-runs/cron.log 2>&1
```

Test the script once under `env -i` so you see what cron will see. This is the script you build in the exercise.

**Check in from your phone: Remote Control.** Start `claude remote-control` (a server for new sessions), `claude --remote-control` (an interactive session) or `/remote-control` inside a session. You then watch and steer it from claude.ai/code or the Claude mobile app. Claude keeps running on your machine, so files and tools stay local. It makes outbound HTTPS connections only. It needs a Pro, Max, Team or Enterprise login (not an API key), and an Owner must enable it on Team and Enterprise. The process must stay up. In server mode it gives up if it loses the network for about 10 minutes. Permission prompts reach your phone, which is useful, but it also means a run stalls until you answer.

**Permission modes for unattended runs.** `--permission-mode` takes `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk` or `plan`.

```bash
# Locked down: anything not on the list is denied, and the run keeps going
claude -p "$(cat task.md)" --permission-mode dontAsk \
  --allowedTools "Read,Edit,Bash(npm test *)" --max-budget-usd 5

# Everything allowed. Only inside a container or VM, as a non-root user.
claude -p "$(cat task.md)" --dangerously-skip-permissions
```

`dontAsk` is the documented choice for locked-down CI and scripts. `bypassPermissions` skips prompts and safety checks, and the docs say it offers no protection against prompt injection or unintended actions. Deny rules still apply in it, but allow rules have no effect. `auto` mode has a classifier review each action, and in a `-p` run repeated blocks stop the action, not the run.

**Evidence from the run.** Add `--output-format stream-json --verbose` and the output is one JSON event per line. The commands the agent ran are the `tool_use` entries:

```bash
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | "\(.name): \(.input | tostring)"' agent.log
```

`--max-budget-usd` caps spend and only works with `-p`.

## Codex CLI

**Unattended runs use `codex exec`** (see [lesson 3.4](/lessons/l3-headless-agents) for the basics). It is read-only by default, so an overnight job that edits files needs `--sandbox workspace-write`. In that mode network access is off unless you turn it on in config. `--dangerously-bypass-approvals-and-sandbox` skips confirmations and the sandbox, and `--help` says to use it only in an environment that is already sandboxed externally. Under cron or CI, close stdin (`< /dev/null`) so `codex exec` does not wait to append piped input to the prompt.

```bash
codex exec --sandbox workspace-write --json "$(cat task.md)" > agent.log < /dev/null
```

**Resume and branch.** A run can be continued after the fact:

```bash
codex exec resume --last "fix the failures from the last run"   # newest session
codex exec resume <SESSION_ID> "continue"
codex exec fork <SESSION_ID> "try the other approach"           # new session from an old one
codex resume --last                                             # interactive; codex fork is the interactive branch
```

**Cloud tasks (experimental).** `codex cloud` submits work to Codex Cloud and brings the result back:

```bash
codex cloud exec --env <ENV_ID> "bump the lodash dependency and fix the fallout"   # --attempts N, --branch <b>
codex cloud list
codex cloud status <TASK_ID>
codex cloud diff <TASK_ID>      # read it first
codex cloud apply <TASK_ID>     # then apply it to your working tree
```

Environments are set up in Codex on the web (repos, dependencies, network settings). By default a cloud task can reach package managers only. Results come back as a diff you apply locally or a pull request you open, which suits the review-before-merge rule.

**Scheduling.** The Codex CLI has no scheduler. The docs say Automations (scheduled tasks) run in the ChatGPT desktop app and web, and are not available in the CLI or IDE extension. For CLI jobs use cron or launchd exactly as in the Claude Code tab, or a scheduled GitHub Actions workflow with the official action, which keeps the API key away from your build steps:

```yaml
on:
  schedule:
    - cron: "0 18 * * 1-5"   # UTC
jobs:
  nightly:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
      - uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          prompt: "Run the test suite and report failing tests with likely causes"
```

**In a long session.** The docs list `/compact`, `/new`, `/resume`, `/fork`, `/diff`, `/status`, `/review` and `/goal` as slash commands. From the shell, `codex resume`, `codex fork`, `codex exec resume` and `codex exec fork` reopen or branch an earlier session. There is no `/undo`: that command was removed. Use git commits as your checkpoints, and the exit code and test gate of your script as the stop condition.

**Check in remotely.** `codex remote-control` is experimental. It manages the app-server daemon with remote control enabled, with `start`, `stop` and `pair` (a short-lived pairing code) subcommands. Because it is experimental, check it with a throwaway task before relying on it for real work.

**Evidence from the run.** `--json` turns stdout into JSONL events. Each shell command is a `command_execution` item, so the same morning review works:

```bash
jq -r 'select(.type=="item.completed" and .item.type=="command_execution") | .item.command' agent.log
```
