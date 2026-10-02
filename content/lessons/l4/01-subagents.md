---
slug: l4-subagents
level: 4
sort: 1
title: "Subagents: delegate without polluting your context"
objective: "Define scoped subagents (Claude Code .claude/agents, Codex .codex/agents) and know when delegating beats one long session."
est_minutes: 30
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Format: Claude Code subagents are Markdown files with YAML frontmatter (the body is the system prompt). Codex custom agents are standalone TOML files with a `developer_instructions` field."
  - "Limiting power: Claude Code takes a `tools` allowlist (and `disallowedTools`) per subagent. Codex's documented lever is `sandbox_mode`, for example `read-only`, plus `mcp_servers`."
  - "Delegation: Claude Code can delegate on its own from a subagent's description, or you force it with an `@-mention`. In Codex you ask for it explicitly, for example 'spawn one agent per point'."
  - "Models: Claude Code sets `model` per subagent (sonnet, opus, haiku, `inherit`). Codex sets `model` and `model_reasoning_effort` per agent file, with defaults under `[agents]`."
  - "Watching them: Claude Code shows a subagent panel below the prompt and lists them in `/tasks`. Codex uses `/agent` (or `/subagents`) to switch between active agent threads."
exercise: ex-4-1-subagents
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Hand noisy work, like test runs, to a subagent that returns a short summary."
    - "Scope each subagent: a `tools` allowlist in Claude Code, `sandbox_mode` in Codex."
    - "Stay in one session for small tasks; delegate when output would flood your context."
  try_this:
    claude: { kind: prompt, text: "Use the test-runner subagent to run the suite" }
    codex: { kind: prompt, text: "Spawn the test-runner agent to run the suite." }
---

## Concept

A **subagent** is a second agent that your main session starts for one job. It gets its own context window, its own instructions and a limited set of tools. It works, then hands back one summary. Everything it read and every log line it saw stays in its own context, not yours.

That is the whole point. A long session fills up with test output, search results and dead ends, and the agent gets slower and vaguer as it fills. Delegation moves the noisy work out of the way.

```diagram
type: boundary
id: subagent-context
title: What crosses the subagent boundary
summary: Only your brief goes in and only a summary comes back. The logs, search hits and dead ends stay in the subagent's context.
zones:
  - id: main
    label: Your main session
    items:
      - id: lead
        label: Main agent
        sub: your long-lived context
  - id: worker
    label: Subagent context
    items:
      - id: sub
        label: Subagent
        sub: own prompt and tools
      - id: noise
        label: Logs and dead ends
        sub: stay in here
        emphasis: true
crossings:
  - from: lead
    to: sub
    label: brief
  - from: sub
    to: lead
    label: summary
```

**Delegate when:**

- The task produces a lot of output you will not reuse: running a test suite, reading logs, fetching docs.
- You want hard limits on what the worker can do: a reviewer that cannot edit, a researcher that cannot run shell commands.
- The work is self-contained and can come back as a short report.
- Several investigations are independent and can run side by side.

**Stay in one session when:**

- You are iterating with the agent, back and forth, on the same code.
- Planning, implementing and testing share a lot of context.
- The change is small. A fresh subagent has to gather context again, and that costs time.

Two costs to keep in mind. Each subagent spends its own tokens, so five parallel subagents cost roughly five sessions. And the summary it returns is all you get: if it is vague, you have lost the detail. Tell the subagent exactly what to report.

**Design rules that hold in both tools**

1. One narrow job per subagent. "Runs tests and reports failures" beats "helps with quality".
2. Give it only the capability its job needs. A reviewer that can edit will eventually "just fix it", and then nobody has reviewed anything.
3. Write the description for the delegator. It is how the main agent decides when to hand work over, so say when to use it.
4. Keep the fix in the main session. Subagents report, the main agent decides.

An independent reviewer is the highest-value subagent. It reads the diff with fresh eyes and no memory of why you wrote it that way.

### First Mate tip

On a client MVP the clock is the constraint, and long sessions rot fastest in the last week, when the suite is big and the diffs are large. Check a `test-runner` and a `reviewer` into every client repo on day one. Then every engineer gets the same short "what failed" report and the same second opinion before a PR goes to the client, whichever CLI they prefer. Commit `.claude/agents/` and `.codex/agents/` together so both stay in sync.

## Claude Code

Subagents are Markdown files with YAML frontmatter. Project subagents go in `.claude/agents/` (commit them), personal ones in `~/.claude/agents/`. Only `name` and `description` are required. Claude Code watches these folders and picks up edits within seconds. The one exception: after you create the first agent file in a folder that did not exist when the session started, restart it.

**`.claude/agents/test-runner.md`**

```markdown
---
name: test-runner
description: Runs the test suite and reports only the failing tests with their error messages. Use proactively after any code change.
tools: Bash, Read, Grep, Glob
model: haiku
---

You run the project's tests and report back. You never edit files.

1. Run `npm test`.
2. Reply with PASS or FAIL, the counts, and for each failing test its name,
   file and line, and the assertion message.
3. Keep the reply under 20 lines. Never paste the full test output.
```

**`.claude/agents/reviewer.md`**

```markdown
---
name: reviewer
description: Read-only code reviewer. Use after a change is written and before committing.
tools: Read, Grep, Glob, Bash
model: sonnet
---

You review a change you did not write. Never edit files.
Read `git diff`, then report findings as `file:line`, what is wrong, why it matters.
Lead with anything that could be a bug. If there is nothing, say "No findings".
```

The useful frontmatter fields:

| Field | What it does |
|---|---|
| `tools` | Allowlist, as `Read, Grep, Bash` or a YAML list. Leave it out and the subagent inherits every tool. |
| `disallowedTools` | Removed from whatever it would otherwise have. |
| `model` | `sonnet`, `opus`, `haiku`, `inherit`, or a full model ID. |
| `permissionMode` | For example `plan` or `acceptEdits`. |
| `skills`, `mcpServers`, `hooks` | Preload skills, scope MCP servers, or attach hooks to this subagent only. |
| `maxTurns` | Stop the subagent after this many turns. |
| `isolation` | `worktree` runs it in a temporary git worktree (see the next lesson). |

The reviewer keeps `Bash` so it can run `git diff`. That means "no Edit or Write tool" guards against accidents, but it is not a sandbox: a shell can still write files. If you need a hard guarantee, drop `Bash` and hand the reviewer the diff in your prompt.

Watch the spelling. Multi-word fields are camelCase (`maxTurns`, `disallowedTools`), and Claude Code silently ignores a field name it does not recognise.

**Using them**

```text
Use the test-runner subagent to run the suite and tell me what is failing
```

```text
@"reviewer (agent)" review my changes before I commit
```

- Naming a subagent in plain language lets Claude decide. An `@`-mention guarantees that subagent runs.
- `claude --agent reviewer` makes the whole session run as that subagent: its prompt, tools and model. Set `"agent": "reviewer"` in `.claude/settings.json` to make it the project default.
- `--agents '<json>'` defines subagents for one session without writing files.
- Built in: `Explore` (fast, read-only search) and `Plan` (research during plan mode).
- As of v2.1.198 the `/agents` command no longer opens a creation wizard. Ask Claude to write the file, or write it yourself.
- Subagents can run in the background. Press **Ctrl+B** to background a running task and use `/tasks` to see them.

Subagents can spawn subagents up to three layers deep by default. Leave `Agent` out of a reviewer's `tools` so it stays a leaf.

## Codex CLI

Codex calls them **custom agents**. Each one is a standalone TOML file: `.codex/agents/` for the project, `~/.codex/agents/` for you. Every file must define `name`, `description` and `developer_instructions`. It can also set `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers` and `skills.config`. Anything you leave out is inherited from the parent session. The `name` field is what Codex uses, and matching the filename to it is just a convention.

**`.codex/agents/test-runner.toml`**

```toml
name = "test-runner"
description = "Runs the test suite and reports only the failing tests with their error messages. Use after any code change."
developer_instructions = """
You run the project's tests and report back. You never edit files.

1. Run `npm test`.
2. Reply with PASS or FAIL, the counts, and for each failing test its name,
   file and line, and the assertion message.
3. Keep the reply under 20 lines. Never paste the full test output.
"""
```

**`.codex/agents/reviewer.toml`**

```toml
name = "reviewer"
description = "Read-only code reviewer. Use after a change is written and before committing."
sandbox_mode = "read-only"
developer_instructions = """
You review a change you did not write. Never edit files.
Read `git diff`, then report findings as `file:line`, what is wrong, why it matters.
Lead with anything that could be a bug. If there is nothing, say "No findings".
"""
```

**Using them.** Ask for them in the prompt. Codex spawns agents when you request it:

```text
Spawn the test-runner agent to run the suite and tell me what is failing.
```

```text
Have the reviewer agent review my changes before I commit.
```

- Built-in agents: `default` (general purpose), `worker` (implementation and fixes) and `explorer` (read-heavy exploration). A custom agent with the same name as a built-in wins.
- In the CLI, `/agent` (or `/subagents`) switches between active agent threads so you can inspect one.
- Global settings live under `[agents]` in `config.toml`: `enabled`, `max_concurrent_threads_per_session` (`max_threads` still works as an alias), `default_subagent_model` and `default_subagent_reasoning_effort`.

```toml
# .codex/config.toml
[agents]
max_concurrent_threads_per_session = 4
```

**Permissions.** Subagents inherit your current sandbox and approval settings, and Codex re-applies any live overrides you set in the session (`/permissions`, or `--yolo`, which turns off approvals and the sandbox) even if the agent file says something different. Set `sandbox_mode` in a file to narrow one agent, as the reviewer does. In interactive sessions an approval request can come from a background agent thread. The overlay names the thread, and pressing `o` opens it. In non-interactive runs, an action that needs a fresh approval fails and the error goes back to the parent.

Multi-agent support is listed as stable and on by default in `codex features list` for 0.154.0. Turn it off with `agents.enabled = false`.
