---
slug: l4-hooks-skills-commands
level: 4
sort: 4
title: "Hooks, skills and custom commands"
objective: "Automate with hooks, skills and slash commands (Claude Code) and hooks and skills (Codex), and know when a deterministic hook beats an instruction."
est_minutes: 40
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Hook config: Claude Code reads hooks from .claude/settings.json (or ~/.claude/settings.json). Codex reads .codex/hooks.json or inline [hooks] tables in config.toml, and skips a new or changed hook until you review and trust it in /hooks."
  - "Edit events: Claude Code's Edit and Write tools put the path in tool_input.file_path. Codex edits files with apply_patch, so tool_input.command is the patch text and your script must parse the file names out of it. The matcher accepts apply_patch, or the aliases Edit and Write."
  - "Reusable prompts: Claude Code skills are invoked as /name (old .claude/commands/*.md files still work and behave the same). Codex skills are invoked as $name or picked from /skills, and Codex's file-based custom prompts are deprecated in favour of skills."
  - "Skill locations: .claude/skills/<name>/SKILL.md and ~/.claude/skills for Claude Code. .agents/skills/<name>/SKILL.md and ~/.agents/skills for Codex. The name and description frontmatter is shared."
  - "Neither is a security boundary. Codex says tool hooks are a guardrail, not a complete enforcement boundary. Claude Code hooks on Edit|Write do not see files changed through Bash."
exercise: ex-4-4-automation
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

You have three ways to steer an agent, and they differ in how much you can count on them.

| Mechanism | What it is | Guarantee |
|---|---|---|
| **Instructions** (`CLAUDE.md`, `AGENTS.md`, prompts) | Text the model reads and weighs | None. The agent usually follows them. |
| **Skills** | A named, reusable procedure (a `SKILL.md` folder). The agent sees its name and description, and loads the full text only when it uses the skill. | Followed when invoked, but still model-driven. |
| **Hooks** | Your script, run by the CLI at a lifecycle event | Runs every time the event fires. The model cannot skip it. |

**Rule of thumb:** if a rule must hold every single time, and a script can check it, make it a hook. "Always format edited files" and "never run `rm -rf`" are hooks. If it takes judgement, such as "scaffold a route the way this repo does it", make it a skill or an instruction.

**Hooks**

A hook is a command that receives a JSON description of the event on stdin. It can do something (format, log, notify), and at some events it can block the action or push feedback to the model. The events you will use most:

- Before a tool runs (`PreToolUse`): block or rewrite a call, for example refuse `rm -rf` or edits to generated files.
- After a tool runs (`PostToolUse`): format, lint, index.
- When a turn ends (`Stop`): run the test suite and tell the agent to keep going if it fails.
- On session start or user prompt: inject context.

Hook rules that save you pain:

1. Keep them fast. They sit in the agent's loop.
2. A formatter must never block the agent. Exit 0 and log problems to stderr.
3. Use blocking sparingly, for real safety rules, and make the reason clear.
4. A hook runs with your permissions. Read any hook you did not write before you trust it.

**Skills and commands**

A skill is a folder with a `SKILL.md`: `name` and `description` frontmatter, then instructions. The description is what makes it work, because the agent decides from it whether to use the skill. State what the skill does and when to use it, with the words a person would actually type. Keep one skill to one job, and point at files in the repo (a convention doc, an example) instead of copying their content, so there is one source of truth.

A slash command is a skill you invoke on purpose. Use one when a task has side effects or a fixed shape you want to trigger yourself, such as scaffolding, release notes or a PR description.

### First Mate tip

Client repos rotate through engineers and contractors, and every one of them has a different agent setup. Put the repeatable parts in the repo. A format hook and a `new-api-route` skill mean the tenth endpoint on a client MVP looks like the first, whoever (or whichever CLI) wrote it. Keep the deterministic checks in hooks and the "how we do it here" in one skill per task. Review hook scripts in PRs like any other code, because they run on everyone's machine.

## Claude Code

### Hooks

Hooks live in settings JSON: `.claude/settings.json` (commit it, shared), `.claude/settings.local.json` (yours) or `~/.claude/settings.json` (all projects). Structure: an event, a `matcher` that filters it, then one or more handlers.

**Format on edit.** `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

The command receives the event as JSON on stdin. For `Edit` and `Write` the edited path is `tool_input.file_path`. The matcher is a regex on the tool name, so `Edit|Write` fires only for those two tools.

**Block a command.** A `PreToolUse` hook blocks by exiting with code 2 and writing the reason to stderr. Claude sees the reason and can adjust:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-rm-rf.sh" }
        ]
      }
    ]
  }
}
```

Exit codes: `0` means proceed (stdout can carry structured JSON), `2` blocks and feeds stderr back, anything else is a non-blocking error. `$CLAUDE_PROJECT_DIR` points at the project root.

Things to know:

- `/hooks` opens a read-only browser of the hooks Claude Code has loaded. Edit the JSON (or ask Claude to) to change them. Settings changes are picked up without a restart.
- `Edit|Write` does not see files changed through shell commands. If a hook must see every change, add a `Stop` hook that scans the working tree once per turn, or also match `Bash`.
- Hooks can also be attached to a single subagent in its frontmatter, and `mcp_tool` handlers can call an MCP tool instead of a command.

### Skills and commands

A skill is `.claude/skills/<name>/SKILL.md` (project, commit it) or `~/.claude/skills/<name>/SKILL.md` (personal). The folder name becomes the command: `/new-api-route`.

**`.claude/skills/new-api-route/SKILL.md`**

```markdown
---
name: new-api-route
description: Scaffold a new API route to this repo's conventions (handler, registration, test). Use when the user asks to add an API route or endpoint.
---

Scaffold a new API route named by the user (for example `orders`).

1. Read `CONVENTIONS.md` and `src/routes/health.js`. Copy their shape.
2. Create `src/routes/<name>.js` and `tests/routes/<name>.test.js`.
3. Register the route in `src/routes/index.js`, alphabetical.
4. Run `npm test` and fix anything red.
```

Run it with `/new-api-route orders`, or just ask "add an orders route" and Claude may load it from the description. Extra frontmatter you will use:

| Field | Use |
|---|---|
| `disable-model-invocation: true` | Only you can trigger it. Use for anything with side effects (`/deploy`, `/commit`). |
| `allowed-tools` | Tools pre-approved for the turn that runs the skill, e.g. `Bash(git add *) Bash(git commit *)`. |
| `argument-hint` | Autocomplete hint such as `[route-name]`. |

Arguments: `$ARGUMENTS` in the body is replaced with what you typed after the name, so `/fix-issue 123` gives `Fix GitHub issue 123 ...`. If the body has no placeholder, Claude Code appends `ARGUMENTS: <your input>` so nothing is lost.

**Custom slash commands are skills now.** A file at `.claude/commands/deploy.md` still works and creates `/deploy`, the same as a skill at `.claude/skills/deploy/SKILL.md`. Prefer a skill for new work: it can carry supporting files, and you can control who invokes it. Skills can also inject live output, for example a line ``!`git diff HEAD` `` in the body is replaced by the command's output before Claude reads it.

## Codex CLI

### Hooks

Codex has lifecycle hooks (enabled by default in 0.154.0: `hooks` shows as stable in `codex features list`). It discovers them next to your config layers, in either `hooks.json` or inline `[hooks]` tables in `config.toml`, at `~/.codex/` and in the repo's `.codex/`. Project hooks load only when the project's `.codex/` layer is trusted. Events include `PreToolUse`, `PermissionRequest`, `PostToolUse`, `UserPromptSubmit`, `Stop`, `SessionStart`, `SubagentStart` and `SubagentStop`.

**Format on edit.** `.codex/hooks.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "^apply_patch$",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$(git rev-parse --show-toplevel)/scripts/hook-format.mjs\"",
            "timeout": 30,
            "statusMessage": "Formatting edited files"
          }
        ]
      }
    ]
  }
}
```

The same hook as inline TOML in `.codex/config.toml`:

```toml
[[hooks.PostToolUse]]
matcher = "^apply_patch$"

[[hooks.PostToolUse.hooks]]
type = "command"
command = 'node "$(git rev-parse --show-toplevel)/scripts/hook-format.mjs"'
timeout = 30
statusMessage = "Formatting edited files"
```

Points that differ from Claude Code:

- **File edits are `apply_patch`.** The matcher is a regex on the tool name, and `apply_patch` also matches the aliases `Edit` and `Write`. The event still reports `tool_name: "apply_patch"`, and the patch text is in `tool_input.command`, not a `file_path`. A hook event for a new file looks like this (checked against a real 0.154.0 run):

  ```json
  {
    "hook_event_name": "PostToolUse",
    "cwd": "/path/to/repo",
    "tool_name": "apply_patch",
    "tool_input": { "command": "*** Begin Patch\n*** Add File: hello.js\n+const a = 1;\n*** End Patch" }
  }
  ```

  Your script reads the `*** Add File:` and `*** Update File:` lines and resolves them against `cwd`.
- **Trust review.** Before a non-managed hook runs, Codex requires you to review and trust that exact definition. New or changed hooks are skipped until you do. Open `/hooks` to inspect sources, trust hooks or disable them. For automation that already vets its hooks, `codex --dangerously-bypass-hook-trust` runs enabled hooks without persisted trust.
- **Blocking.** `PreToolUse` can deny with JSON (`"permissionDecision": "deny"`) or exit code 2 with the reason on stderr. A `PostToolUse` block cannot undo a tool that already ran.
- **Concurrency.** Matching hooks from all files run, and several hooks for one event start concurrently. `timeout` is in seconds (default 600).
- Command paths resolve from the session `cwd`. For repo-local hooks, use the git root as above, since Codex may start in a subdirectory.
- The docs call tool hooks a guardrail, not a complete enforcement boundary. Turn hooks off with `[features] hooks = false`.

### Skills

A Codex skill is a folder with a `SKILL.md` that has `name` and `description`. For a repo it goes in `.agents/skills/<name>/SKILL.md`. Codex scans `.agents/skills` from your working directory up to the repo root, plus `~/.agents/skills` for personal skills. Codex detects changes automatically, and if an update does not show up, restart Codex.

**`.agents/skills/new-api-route/SKILL.md`** uses the same file as the Claude Code example above.

Invoke a skill by typing `$` and picking it (`$new-api-route orders`), or run `/skills`. Codex can also pick one itself when your task matches the description. To make a skill explicit-only, add `agents/openai.yaml` next to the `SKILL.md`:

```yaml
policy:
  allow_implicit_invocation: false
```

Need a starting point? `$skill-creator` is built in and asks what the skill does and when it should trigger.

### Custom commands

The Codex docs describe no repo-shared custom slash commands. The old file-based custom prompts (`~/.codex/prompts/<name>.md`, invoked as `/prompts:<name>`) still exist but are deprecated in the docs in favour of skills. They also live in your home directory, so they are not shared through the repo. Use a skill, and invoke it with `$name`.
