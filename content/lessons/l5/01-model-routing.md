---
slug: l5-model-routing
level: 5
sort: 1
title: "Model routing: strong to plan, fast to build"
objective: "Route each phase of a task to the right model and effort, in both Claude Code (/model, opusplan, subagent model fields) and Codex (-m, profiles, reasoning effort), and measure the cost and latency trade-off."
est_minutes: 40
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code has `opusplan`, one setting that uses Opus in plan mode and Sonnet when executing. Codex has no alias that switches on plan mode: you pick the model with `/model` or start the session with a `--profile`."
  - "A Codex profile is a file (`~/.codex/<name>.config.toml`) that bundles model, reasoning effort, approval policy and sandbox. Claude Code has no named profiles; the closest are a subagent file per role or `claude --settings <file>`."
  - "Subagents pick a model differently. Claude Code uses a `model:` alias in frontmatter (`opus`, `sonnet`, `haiku`, `inherit` or a full ID). A Codex agent file uses a concrete `model` plus `model_reasoning_effort`."
  - "Effort levels are per model in both tools. Claude Code: low, medium, high, xhigh, max (medium is the default on Opus 5.5 and Sonnet 5.5). Codex: whatever `/model` lists for the model you picked."
exercise: ex-5-1-routing
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Plan and review on a strong model, then implement on a faster, cheaper one."
    - "Set model and effort per phase: `/model`, `--effort`, `opusplan`, or a Codex `--profile`."
    - "Time and cost one real task on each setup before you standardize on it."
  try_this:
    claude: { kind: command, text: "claude --model sonnet --effort medium" }
    codex: { kind: prompt, text: "/model" }
---

## Concept

One model for everything is the expensive default. Different phases of a task reward different things.

| Phase | What matters | Route to |
|---|---|---|
| Planning | Judgement. A wrong plan wastes every step after it. | Strong model, high effort |
| Implementation | Volume and speed. The spec and tests already say what "right" is. | Fast model, low to medium effort |
| Review | Judgement again. A missed bug is expensive to find later. | Strong model, high effort, read-only |

The rule: spend reasoning where a mistake is expensive to detect later, and save it where a test will catch the mistake for you.

Three dials, in the order you should reach for them:

1. **Model.** Opus 5.5 (`claude-opus-5-5`) is the strong one, Sonnet 5.5 (`claude-sonnet-5-5`) the fast one, and Haiku 4.5 is cheaper still for mechanical work. Codex has its own list: run `/model` and read what it offers today.
2. **Reasoning effort.** The same model at a lower effort is faster and cheaper. Plans and reviews get high, implementation gets low or medium.
3. **Blast radius.** A reviewer that cannot edit files stays a reviewer. Give planning and review read-only tools or a read-only sandbox.

Cost and latency are trade-offs, not free wins. The fast model is quicker per step but can need more steps when the spec is vague, so routing only works when planning produced a clear task and tests exist. Do not trust a general claim about speed: time your own task, which is what the exercise makes you do.

This is exactly how this app was built (PRD section 12). Opus wrote the plan, the test cases and the reviews, and Sonnet implemented each workstream. Sonnet was cheap enough to run many parallel implementers, and Opus caught what those implementers missed.

Model names and effort levels change every few weeks. Put the current names in one config file per tool so a change is a one-line edit, and re-check them against `/model` when a lesson says it was last verified more than 60 days ago.

### First Mate tip

On a client MVP, write the routing into the repo, not into your head. Commit `.claude/settings.json` with `"model": "opusplan"`, a read-only `reviewer` subagent on Opus, and an `implementer` on Sonnet, and give the Codex users the matching `fm-plan` and `fm-impl` profiles in the project README. Then every engineer on the engagement gets the same cost profile, and the client's bill stops depending on who happened to leave the strongest model on.

## Claude Code

Switch the model in a session, or at launch:

```text
/model opus
/model sonnet
/model claude-opus-5-5
```

```bash
claude --model opus
claude --model sonnet --effort medium
```

In the `/model` picker, `Enter` saves your choice as the default and `s` switches for this session only.

The priority order, highest first: `/model` in the session, `--model` at startup, the `ANTHROPIC_MODEL` environment variable, then `"model"` in settings.

### Plan on Opus, execute on Sonnet, with one setting

```json
{
  "model": "opusplan"
}
```

Save that as `.claude/settings.json`, or pick it in the session with `/model opusplan`. `opusplan` uses the `opus` alias while you are in plan mode and switches to the `sonnet` alias when Claude executes. Start a session in plan mode with:

```bash
claude --permission-mode plan
```

### Effort

```text
/effort high
/effort auto
```

```bash
claude --effort max
```

Levels are `low`, `medium`, `high`, `xhigh` and `max`. Opus 5.5 and Sonnet 5.5 default to `medium`.

### Route by role with subagents

A subagent file in `.claude/agents/` names its own model. Give review the strong one and take away its edit tools:

```markdown
---
name: reviewer
description: Reviews a diff for correctness bugs and missing tests. Use after an implementation pass.
tools: Read, Grep, Glob, Bash
model: opus
---

Report only findings you can point at with a file and line. You cannot edit files.
```

```markdown
---
name: implementer
description: Implements one well-specified task from an approved plan.
tools: Read, Grep, Glob, Bash, Edit, Write
model: sonnet
effort: medium
---

Implement exactly the task you are given, in the files you own. Run the tests and paste the real output.
```

`model` takes `sonnet`, `opus`, `haiku`, a full ID such as `claude-opus-5-5`, or `inherit` to match the main conversation. The model a subagent runs on is resolved in this order: the per-invocation model, the file's `model`, `CLAUDE_CODE_SUBAGENT_MODEL`, then the main conversation's model. To force every subagent onto one model for a cost cap:

```json
{
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku",
    "CLAUDE_CODE_SUBAGENT_MODEL_FORCE": "1"
  }
}
```

### Measure it

```bash
time claude -p --model sonnet --effort medium "Implement titleCase in src/text.mjs so npm test passes"
time claude -p --model opus --effort high "Review the diff on this branch. Read only, do not edit."
```

`-p` runs one non-interactive turn and exits, which makes it easy to time. Nobody is there to answer a permission prompt, so use it on a task your allow rules already cover (with `--permission-prompts none`, anything that would prompt is denied automatically).

## Codex CLI

Pick the model per run with `-m`, and override effort with `-c`:

```bash
codex -m <frontier-model> -c model_reasoning_effort="high"
codex exec -m <fast-model> -c model_reasoning_effort="low" "Implement titleCase in src/text.mjs"
```

Inside a session, `/model` opens the picker for the model and, when the model supports it, the reasoning effort. `/plan` switches to plan mode.

Do not copy model names from a guide, including this one. Codex fetches its model catalog per account, so the right names depend on your account and the day. Discover them, then substitute them for `<frontier-model>` (the most capable, for planning and review) and `<fast-model>` (a faster or cheaper one, for implementation) in every snippet below:

```bash
codex debug models | jq -r '.models[] | select(.visibility=="list") | "\(.slug)\t\(.description)"'
```

Read the descriptions: the frontier model is described as such, and older generations say so. As of Sep 2026 on our accounts, for example, `gpt-6-astra` was the frontier model and `gpt-5.6-luna` an older, faster one. Yours may differ. The effort levels a model supports are in the same output, and some models offer `ultra`.

### Profiles: named bundles of settings

In Codex 0.154.0 a profile is its own file. Create `~/.codex/<name>.config.toml` with top-level keys, and select it with `--profile` (`-p`). The profile layers on top of `~/.codex/config.toml`, and project settings and CLI flags still win over it.

```toml
# ~/.codex/fm-plan.config.toml
model = "<frontier-model>"
model_reasoning_effort = "high"
approval_policy = "on-request"
sandbox_mode = "read-only"
```

```toml
# ~/.codex/fm-impl.config.toml
model = "<fast-model>"
model_reasoning_effort = "low"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

```bash
codex --profile fm-plan       # plan with the strong model, nothing can be written
codex --profile fm-impl       # implement with the fast one
codex exec --profile fm-plan "Plan the change described in SPEC.md. Do not edit files."
```

Older Codex guides put profiles under `[profiles.<name>]` in `config.toml`. The current docs describe the file-per-profile form above, so use that.

### Route by role with subagents

Project-scoped subagents are TOML files in `.codex/agents/`. Each needs `name`, `description` and `developer_instructions`, and it may also set `model`, `model_reasoning_effort` and `sandbox_mode`:

```toml
# .codex/agents/reviewer.toml
name = "reviewer"
description = "Reviews a diff for correctness bugs and missing tests. Use after an implementation pass."
model = "<frontier-model>"
model_reasoning_effort = "high"
sandbox_mode = "read-only"
developer_instructions = """
Report only findings you can point at with a file and line. You cannot edit files.
"""
```

To set a default for every spawned agent, use `[agents]` in `config.toml`:

```toml
[agents]
default_subagent_model = "<fast-model>"
default_subagent_reasoning_effort = "low"
```

### Measure it

```bash
time codex exec --profile fm-impl "Implement titleCase in src/text.mjs so npm test passes"
time codex exec --profile fm-plan "Review the diff on this branch. Read only."
```
