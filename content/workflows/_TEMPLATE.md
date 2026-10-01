---
title: "<8-80 chars: what this setup does>"
problem: "<One sentence, 20-200 chars, no full stop in the middle>"
tools: ["claude-code"]
use_cases: ["<1-3 values from _taxonomy.yaml>"]
stacks: ["<1-4 values from _taxonomy.yaml, or any>"]
# related_lesson: "<lesson slug, optional>"
tool_versions:
  claude_code: "0.0.0"
verified_on: "YYYY-MM-DD"
client_safe: "<set to confirmed only after the checklist in CONTRIBUTING.md>"
---

## Result

### Before

<1-600 chars of prose: what went wrong or was slow before.>

### After

<1-600 chars of prose: what is different now.>

## Setup

```markdown path=AGENTS.md kind=context-file
<The file contents. 0-6 blocks. Info string: lang path=<relative path or ~/path> kind=<context-file|hook|skill|subagent|config|script> [tool=claude-code|codex].>
```

## Prompt

```text
<The prompt that made it work. If both tools are listed and the prompts differ, use "### Claude Code" and "### Codex CLI" subsections.>
```

## Steps

1. <Step one. Between 1 and 5 steps.>

## Why it works

<40-800 chars: the mechanism, so a reader can adapt it. If anything above turns off permissions or pipes curl into a shell, start a line with "Warning:" and explain the risk.>
