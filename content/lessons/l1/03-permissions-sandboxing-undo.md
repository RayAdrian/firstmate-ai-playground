---
slug: l1-permissions
level: 1
sort: 3
title: Permissions, sandboxing and undo
objective: Configure Claude Code permission modes and allow/deny rules, and Codex sandbox and approval modes. Recover from bad edits with checkpoints or rewind, or with git.
est_minutes: 35
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Rules vs sandbox: Claude Code gates individual tool calls with `allow` / `ask` / `deny` rules in `settings.json` (for example `Bash(npm test)`), and has a separate optional Bash sandbox. Codex has no per-command allow list for in-sandbox work. It sets a sandbox mode (what commands can touch) plus an approval policy (when to ask), and uses `.rules` files only for commands that run outside the sandbox."
  - "Network: Claude Code controls it through tool rules (`WebFetch`, `Bash(curl *)`) and, once you enable the sandbox, by prompting on the first use of each new domain. Codex's workspace-write sandbox has network off by default, and you turn it on with `sandbox_workspace_write.network_access = true`."
  - "Undo: Claude Code checkpoints file edits per prompt and `/rewind` (alias `/undo`) restores code, conversation or both, but not changes made through Bash. Codex has no file rewind. Use git checkpoints, and note that Esc-Esc only forks the conversation."
  - "Where config lives: Claude Code uses `.claude/settings.json` (shared) and `.claude/settings.local.json` (personal). Codex uses `.codex/config.toml`, which loads only when you trust the project, plus `~/.codex/config.toml`."
  - "Deny is absolute in Claude Code (deny, then ask, then allow; the first match wins). Codex applies the most restrictive rule (`forbidden` over `prompt` over `allow`)."
exercise: ex-1-3-safe-config
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

Two separate questions control how much an agent can hurt you:

1. **When does it ask?** (permission mode, approval policy, allow and deny rules.) This is about your attention.
2. **What can it reach?** (the sandbox: which paths it can write, which hosts it can contact.) This is about blast radius.

Rules and modes are enforced by the tool, not by the model. A line in your prompt or in `CLAUDE.md` saying "never run curl" shapes what the agent tries. It is not a boundary. To actually block something, use a deny rule, a sandbox or a hook.

Think in three postures:

| Posture | Use it for | Trade-off |
|---|---|---|
| **Ask about everything** | Unfamiliar code, anything touching secrets or infrastructure | Safe, but after ten prompts you approve without reading |
| **Pre-approve the boring, confine the rest** | Daily work: allow `npm test` and `npm run lint`, keep the network and the rest of the disk off-limits | Best default. Takes 5 minutes to set up once per repo |
| **Skip all checks** | Only inside a disposable container or VM | One bad command has no guardrail. Never on your laptop or a client repo |

Undo is your safety net for when configuration is not enough. The order of preference is:

1. **git.** Commit before you start a task. `git diff` shows what changed, `git restore .` discards unstaged edits, and `git switch -` gets you back. It covers everything, including changes made by shell commands.
2. **The tool's own checkpoints**, where they exist. Fast, but partial.
3. **Ask the agent to revert.** Least reliable, since it works from memory of what it did.

### First Mate tip

Commit the shared config, not just the code. A `.claude/settings.json` and `.codex/config.toml` in the client repo mean every engineer on the project, and every new joiner, gets the same guardrails: tests and lint run silently, `.env` and production credentials are unreadable, and nothing reaches the network unasked. Treat a client's `.env` and cloud credentials as untouchable by default and open specific things deliberately.

## Claude Code

### Permission modes

Cycle modes with `Shift+Tab`, or set one at launch with `--permission-mode`. Config values are what you put in `settings.json`.

| Mode | Runs without asking | Use for |
|---|---|---|
| `default` (labelled **Manual**; the CLI also accepts `manual`) | Reads only | Sensitive work, unfamiliar code |
| `acceptEdits` | Reads, file edits, common filesystem commands (`mkdir`, `mv`, `cp`) in the working directory | Iterating on code you are reviewing |
| `plan` | Reads; edits blocked until you approve a plan | Exploring before changing anything |
| `auto` | Most actions; a classifier checks them in the background | Long tasks. The starting mode in terminal sessions from v2.1.283 when available |
| `dontAsk` | Reads and pre-approved tools only; everything else is denied | Locked-down CI and scripts |
| `bypassPermissions` | Everything except a short list of always-prompted actions | Isolated containers and VMs only |

```bash title="terminal"
claude --permission-mode plan
claude --permission-mode default
claude -p "run the test suite" --permission-mode dontAsk --allowedTools "Bash(npm test)" "Read"
```

`bypassPermissions` (and the flag `--dangerously-skip-permissions`) also skips prompts for writes to protected paths such as `.git` and `.claude`. Deny rules still apply in every mode.

### Allow, ask and deny rules

Run `/permissions` to see every rule and which file it came from. Rules are evaluated **deny, then ask, then allow**, and the first match wins. A narrow allow cannot carve an exception out of a broad deny.

```json title=".claude/settings.json"
{
  "permissions": {
    "allow": [
      "Bash(npm test)",
      "Bash(npm run lint)",
      "Bash(git diff *)",
      "Bash(git status)"
    ],
    "ask": [
      "Bash(git push *)"
    ],
    "deny": [
      "Bash(curl *)",
      "Bash(wget *)",
      "WebFetch",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)"
    ]
  }
}
```

Syntax notes:

- `Tool` matches every use. `Tool(specifier)` narrows it. Bash rules match the whole command with `*` as a wildcard: `Bash(npm run *)`, `Bash(git commit *)`.
- Put `*` after the subcommand. `Bash(git log *)` allows `git log` only, while `Bash(git *)` allows every git command. A trailing ` *` also matches the bare command, so `Bash(ls *)` matches `ls`.
- Claude Code understands `&&`, `||`, `;` and pipes. A rule for `safe-cmd` will not approve `safe-cmd && other-cmd`. Each part must match.
- Path rules use gitignore syntax: `./path` and `path` are relative to the current directory, `/path` is relative to the settings file's project, `~/path` is your home, `//path` is absolute. `Edit(...)` rules cover all built-in file-editing tools.
- A bare `WebFetch` deny removes the tool from the model entirely.

A Bash deny rule is not a security boundary. `Bash(curl *)` stops `curl https://example.com` but not `/usr/bin/curl ...` or `sh -c 'curl ...'`. For a boundary that does not depend on the command text, turn on the sandbox.

### Settings files

| File | Scope | Commit it? |
|---|---|---|
| `.claude/settings.json` | Whole project, shared | Yes |
| `.claude/settings.local.json` | You, this project | No (Claude Code adds it to your global gitignore when it writes there) |
| `~/.claude/settings.json` | You, every project | n/a |

When you answer "Yes, and don't ask again" on a Bash prompt, the rule is saved to `.claude/settings.local.json`. A project `defaultMode` of `auto` or `bypassPermissions` is ignored, on purpose. A repo cannot switch itself into those modes.

### Sandbox

The sandbox restricts what Bash commands can do at the OS level, regardless of how they are phrased. Toggle it with `/sandbox`, or set it in settings:

```json title=".claude/settings.json"
{
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false
  }
}
```

By default sandboxed commands can write to the working directory and temp directory (plus directories you add) and read most of the machine. Widen writes with `sandbox.filesystem.allowWrite` and narrow them with `denyWrite` / `denyRead`. No network domain is pre-allowed: the first use of a new host prompts you, and `sandbox.network.allowedDomains` pre-approves specific hosts. In auto-allow mode, sandboxed commands run without prompts, but explicit deny rules and content-scoped ask rules such as `Bash(git push *)` still apply. Setting `allowUnsandboxedCommands` to `false` removes the escape hatch that lets a failed command retry outside the sandbox. On Linux and WSL2 the sandbox needs `bubblewrap` and `socat`.

### Undo

- **`/rewind`** (aliases `/undo`, `/checkpoint`; or press `Esc` twice with an empty prompt). Each prompt you send starts a checkpoint. Pick a point, then choose: restore code and conversation, restore conversation only, restore code only, or summarize from there.
- Checkpoints do **not** cover files changed by Bash commands (`rm`, `mv`, `cp`), edits by most subagents, or changes you made outside the session. The last 100 checkpoints are kept, and checkpoints are cleaned up about 30 days after the session's last save by default.
- Checkpoints are session-level recovery, not version control. Commit before large tasks.

```bash title="terminal"
git status                # start clean
git switch -c try-agent   # throwaway branch for the experiment
# ... run the session ...
git diff                  # what did it change?
git restore .             # discard unstaged edits, if it went wrong
git switch -              # go back where you were
```

## Codex CLI

### Sandbox mode and approval policy

Codex splits the problem in two. **Sandbox mode** is what commands can technically do. **Approval policy** is when Codex must stop and ask.

| `sandbox_mode` / `--sandbox` | Meaning |
|---|---|
| `read-only` | Read files and run commands, no edits |
| `workspace-write` | Write inside the workspace and temp dirs. Network off by default |
| `danger-full-access` | No sandbox |

| `approval_policy` / `--ask-for-approval` | Meaning |
|---|---|
| `on-request` | The model decides when to ask, for example to leave the sandbox or use the network |
| `never` | Never ask. Failures go back to the model |
| `{ granular = { ... } }` | Keep some prompt categories interactive and auto-reject others |

`untrusted` is retired and can stop Codex from starting if it is still in your config. `on-failure` is deprecated.

Common combinations:

```bash title="terminal"
# Auto preset (the default in a git repo): edits and commands in the workspace, asks to go outside it
codex --sandbox workspace-write --ask-for-approval on-request

# Read and discuss only
codex --sandbox read-only --ask-for-approval on-request

# Non-interactive, read-only (CI)
codex exec --sandbox read-only "summarize the failing tests"

# No sandbox, no prompts. Only inside a disposable container or VM
codex --dangerously-bypass-approvals-and-sandbox
```

In the Auto preset, `npm test` and `npm run lint` already run without prompts, because they run inside the sandbox. You do not write an allow list for them. Switch mid-session with `/permissions`, and check the active policy and writable roots with `/status`.

### Config

```toml title=".codex/config.toml"
sandbox_mode    = "workspace-write"
approval_policy = "on-request"
web_search      = "disabled"       # "cached" is the default

[sandbox_workspace_write]
network_access = false             # the default
```

Codex reads `~/.codex/config.toml` for your defaults, and `.codex/config.toml` in the repo for project overrides. Project layers load only when you trust the project. Precedence, highest first: CLI flags and `-c key=value` overrides, project config, profile files (`codex --profile name` layers `~/.codex/name.config.toml`), user config, then built-in defaults.

Do not mix this with the newer named permission profiles (`default_permissions` and `[permissions.<name>]`, in beta). They do not compose with `sandbox_mode` and `[sandbox_workspace_write]`. Pick one style per config.

Inside a writable root, `.git`, `.codex` and `.agents` stay read-only. Expect commands that write to `.git`, such as `git commit`, to ask for approval rather than run silently.

### Network and rules

The workspace-write sandbox has no network unless you set `sandbox_workspace_write.network_access = true`. Web search is separate: it defaults to a cached index, and `web_search = "disabled"` removes the tool. To restrict enabled network access to named hosts, use the `network_proxy` feature with `domains` allow and deny rules. It does nothing while network access is off.

Rules govern commands that need to run **outside** the sandbox. Put them in `~/.codex/rules/default.rules` (or `<repo>/.codex/rules/`, trusted projects only) and restart Codex:

```python title="~/.codex/rules/default.rules"
prefix_rule(
    pattern = ["gh", "pr", "view"],
    decision = "prompt",           # allow | prompt | forbidden
    justification = "Viewing PRs is allowed with approval",
    match = ["gh pr view 7888"],
    not_match = ["gh pr --repo openai/codex view 7888"],
)
```

Test a rules file before you rely on it:

```bash title="terminal"
codex execpolicy check --pretty --rules ~/.codex/rules/default.rules -- gh pr view 7888
```

When several rules match, the most restrictive decision wins (`forbidden`, then `prompt`, then `allow`). Codex splits simple `bash -lc "a && b"` chains and checks each command. Anything with redirection, substitution or globs is checked as one opaque command.

### Undo

Codex has no checkpoint or rewind for file edits, so git is the undo. The docs recommend creating Git checkpoints before and after a task.

```bash title="terminal"
git status
git switch -c try-agent      # throwaway branch
codex
# ... afterwards ...
git diff
git restore .                # discard unstaged edits
```

`Esc` twice in the composer lets you edit a previous message and fork the chat from that point, but it changes only the conversation, not your files.
