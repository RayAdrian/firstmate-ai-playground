---
slug: l1-first-session
level: 1
sort: 1
title: Your first agent session
objective: Install and authenticate both CLIs, run an interactive session, understand the edit, approve and verify loop, and resume a session later.
est_minutes: 25
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Starting posture differs. Claude Code 2.1.283+ starts terminal sessions in auto mode when it is available (a classifier reviews actions), and falls back to Manual. Codex starts in the Auto preset (workspace-write sandbox plus on-request approvals) in a git repo, and in read-only until you trust a non-git folder."
  - "Resume commands differ. Claude Code uses `claude --continue`, `claude --resume [name]` and `/resume`. Codex uses `codex resume`, `codex resume --last` and `/resume`. Both scope the picker to the current directory by default."
  - "Undo differs. Claude Code snapshots file edits per prompt and offers `/rewind`. Codex has no file rewind, so commit before you start and use `git` to recover."
  - "Instruction files differ: Claude Code reads `CLAUDE.md`, Codex reads `AGENTS.md`. Lesson 2.1 covers keeping them in sync."
exercise: ex-1-1-failing-test
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

A coding agent is a model in a loop with tools. You give it a goal. It reads files, edits them, runs commands, looks at the output and repeats until it thinks it is done. Claude Code and Codex CLI both work this way, and both run in your terminal against your local repo.

The whole skill at this level is the **edit, approve, verify loop**:

1. **Ask.** Say what you want, in the repo where the code lives.
2. **Edit.** The agent proposes or makes changes to files.
3. **Approve.** Some actions (file writes, shell commands, network) stop and wait for you, depending on the permission mode. Lesson 1.3 covers tuning this.
4. **Verify.** A test, a build, or a diff you read yourself. The agent stops when the work "looks done", so give it something that returns pass or fail. Then check the evidence, not the agent's summary.

Habits worth building from day one:

- Start each task from a clean `git status`. Commit or stash first, so `git diff` shows only what the agent did.
- Read the diff before you accept anything. The agent is fast, not infallible.
- One task per session. When the goal changes, start a new session.
- Sessions are saved locally. You can leave and come back, so closing the terminal does not lose the conversation.

### First Mate tip

On client MVP work, the failure mode is a large, plausible diff nobody read. Keep the first session small: point the agent at one failing test, get it green, read the diff, commit. Do that a few times before you hand it anything with a client deadline attached. Every First Mate engineer has both tools, so try the same small task in each and learn which one you reach for.

## Claude Code

### Install and sign in

```bash title="terminal"
# macOS, Linux, WSL (native installer, auto-updates)
curl -fsSL https://claude.ai/install.sh | bash

# or Homebrew
brew install --cask claude-code

# or npm (needs Node.js 22+)
npm install -g @anthropic-ai/claude-code

claude --version    # prints e.g. "2.1.284 (Claude Code)"
claude doctor       # read-only install and settings check
```

Start `claude` once and follow the browser login. You can use a Claude subscription (Pro, Max, Team, Enterprise) or a Console account. Re-authenticate any time with `/login` inside a session, and check the current state from the shell:

```bash title="terminal"
claude auth status
```

### Run a session

```bash title="terminal"
cd path/to/your/repo
claude                          # interactive session
claude "why is the slugify test failing?"   # interactive, with a first prompt
```

Try these in order:

```text title="claude prompts"
what does this project do?
run the tests and tell me which one fails and why
fix the failing test without editing the test file, then run the tests again
```

While Claude works:

- Press `Shift+Tab` to cycle permission modes. The status bar shows the current one (`manual mode`, `accept edits`, `plan mode`, `auto mode`).
- With v2.1.283 or later, terminal sessions start in **auto mode** when it is available to your account. A classifier reviews actions instead of you. If auto mode is unavailable, or your settings say otherwise, you start in **Manual**, where Claude asks before file edits and shell commands. Check the status bar before you assume either.
- Press `Esc` to interrupt a turn. Claude keeps the work done so far.
- Run `/diff` to review the working tree changes without leaving the session.
- Run `/help` for the command list.

### Undo and resume

```text title="inside a session"
/rewind      # or press Esc twice on an empty prompt: restore code, conversation, or both
/rename first-session
/resume      # switch to another saved conversation
```

Each prompt you send creates a checkpoint. `/rewind` does not track files changed by Bash commands (`rm`, `mv`, `cp`), so it is not a replacement for git. Lesson 1.3 covers recovery in detail.

Resume from the shell:

```bash title="terminal"
claude --continue            # most recent conversation in this directory
claude --resume              # session picker
claude --resume first-session   # by name, if it matches one session
claude -n auth-refactor      # name a session at startup
```

A resumed terminal session restores its permission mode, with a few exceptions (see the sessions docs). Flags such as `--add-dir` and `--mcp-config` are not remembered, so pass them again.

## Codex CLI

### Install and sign in

```bash title="terminal"
# macOS, Linux
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# or npm
npm install -g @openai/codex

# or Homebrew
brew install --cask codex

codex --version     # prints e.g. "codex-cli 0.154.0"
```

Run `codex` once in a project. On first launch choose **Sign in with ChatGPT** (subscription) or sign in with an API key. From the shell:

```bash title="terminal"
codex login status                              # shows the current login
printenv OPENAI_API_KEY | codex login --with-api-key   # API-key login, key read from stdin
codex login --device-auth                       # for a machine without a local browser
```

### Run a session

```bash title="terminal"
cd path/to/your/repo
codex                                    # interactive TUI
codex "why is the slugify test failing?" # interactive, with a first prompt
```

Use the same three prompts as the Claude Code tab. What you will see differs:

- In a git repo, Codex recommends the **Auto** preset: `--sandbox workspace-write --ask-for-approval on-request`. It reads files, edits and runs commands inside the workspace on its own, and asks before editing outside the workspace or using the network. In a folder that is not under version control, or one you have not trusted yet, it may start in `read-only`.
- `/status` shows the model, the approval policy, the writable roots and the remaining context.
- `/permissions` switches between presets such as Auto and Read Only mid-session.
- `/diff` shows the git diff, including files git does not track yet.
- `/review` asks Codex to review your working tree.
- Prefix a line with `!` to run a local shell command under the current approval and sandbox settings, for example `!npm test`.
- Press `Esc` twice with an empty composer to edit your previous message and fork the chat from that point. This changes the conversation, not your files.

### Undo and resume

Codex has no checkpoint or rewind for file edits. The docs recommend creating Git checkpoints before and after a task. Commit first, then `git restore` or `git switch` if the result is wrong.

```bash title="terminal"
codex resume             # picker of recent sessions in this directory
codex resume --last      # most recent session in this directory
codex resume --last --all   # most recent session from any directory
codex fork --last        # branch a previous session into a new chat
```

Inside a session, `/resume` opens the saved-chat picker and `/fork` clones the current chat. `/new` starts a fresh chat without leaving the CLI, and `/clear` clears the screen and starts a new chat.

`codex resume` accepts the same global flags as `codex`, including model and sandbox overrides, so you can resume with different settings.
