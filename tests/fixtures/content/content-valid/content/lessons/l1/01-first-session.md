---
slug: l1-first-session
level: 1
sort: 1
title: Your first agent session
objective: Run an interactive session in both tools.
est_minutes: 20
tool_versions:
  claude_code: "2.1.0"
  codex_cli: "0.40.0"
last_verified_on: 2026-09-20
differences:
  - Claude Code starts with `claude`, Codex CLI with `codex`.
  - Claude Code asks before edits by default; Codex uses an approval mode.
  - Each tool keeps its own session history.
exercise: ex-fx-auto
---

## Concept

An agent session is a loop: you describe a goal, the agent reads and edits files.

```bash
npm i -g @anthropic-ai/claude-code
claude --version
```

```json title="settings.json"
{ "permissions": { "allow": ["Bash(npm test)"] } }
```

```
echo "plain block"
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

See [the docs](https://docs.anthropic.com/) and [permissions](/lessons/l1-permissions).

## Claude Code

Run `claude` in your repo and ask for a small change.

## Codex CLI

Run `codex` in your repo and ask for a small change.
