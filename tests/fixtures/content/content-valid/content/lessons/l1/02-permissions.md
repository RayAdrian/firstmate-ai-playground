---
slug: l1-permissions
level: 1
sort: 2
title: Permissions and sandboxing
objective: Control what the agent may run.
est_minutes: 15
tool_versions:
  claude_code: "2.1.0"
  codex_cli: "0.40.0"
last_verified_on: 2026-07-31
differences:
  - Codex has no per-command allowlist in this fixture.
codex_no_equivalent: true
---

## Concept

Permissions decide which commands run without asking.

```diagram
type: boundary
id: trust-zones
title: Who can reach the agent
summary: Untrusted text can reach the agent from a web page or a server, and only one of those paths is meant to.
zones:
  - id: machine
    label: Your machine
    items:
      - id: agent
        label: Agent
        emphasis: true
      - id: shell
        label: Shell
        sub: runs your commands
  - id: remote
    label: Remote
    items:
      - id: mcp-server
        label: MCP server
      - id: web-page
        label: Web page
crossings:
  - from: web-page
    to: agent
    label: tool results
  - from: mcp-server
    to: agent
    label: injected text
    style: risk
```

Rules apply per command.

```diagram
type: lanes
id: gate-race
title: Review A, push B
summary: A status posted on commit A does not carry over to commit B.
lanes:
  - id: author
    label: Author
  - id: reviewer
    label: Reviewer
steps:
  - id: commit-a
    label: Commit A
    lane: author
    col: 1
  - id: review-a
    label: Review A
    lane: reviewer
    col: 2
  - id: push-b
    label: Push B
    lane: author
    col: 3
  - id: success
    label: |-
      Success
      refused
    lane: reviewer
    col: 4
    emphasis: true
handoffs:
  - from: commit-a
    to: review-a
    label: review
  - from: push-b
    to: success
    label: head moved
    style: risk
marker:
  col: 3
  label: Head moves
  style: risk
```

Ask once, then remember.

## Claude Code

Add allow rules to `.claude/settings.json`.

## Codex CLI

Workaround: use a sandbox profile
