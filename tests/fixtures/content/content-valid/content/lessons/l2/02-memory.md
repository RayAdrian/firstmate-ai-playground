---
slug: l2-memory
level: 2
sort: 2
title: Memory
objective: Keep knowledge between sessions.
est_minutes: 10
tool_versions:
  claude_code: "2.1.0"
  codex_cli: "0.40.0"
last_verified_on: 2026-09-15
differences:
  - Memory is stored differently in each tool.
  - Both can be edited by hand.
---

## Concept

Raw HTML must stay inert: <script>window.__xss=1</script> and <img src=x onerror="window.__xss=2">

```diagram
type: lanes
id: pinned-approval
title: An approval covers one commit
summary: The review checked A. Once the head moves to B, success on A is refused, so B needs its own review.
lanes:
  - { id: author, label: Author }
  - { id: reviewer, label: Reviewer }
steps:
  - { id: review-a, lane: reviewer, col: 1, label: Review A }
  - { id: push-b, lane: author, col: 2, label: Push B }
  - { id: post-a, lane: reviewer, col: 3, label: Post success on A, sub: "refused: A not head", emphasis: true, style: risk }
handoffs:
  - { from: review-a, to: post-a, label: stale result }
marker: { col: 3, label: head moves to B, style: risk }
```

Six columns use the timeline form.

```diagram
type: lanes
id: six-columns
title: Six steps across three lanes
summary: Six time columns are too narrow for the grid, so every size shows the numbered timeline.
lanes:
  - { id: author, label: Author }
  - { id: reviewer, label: Reviewer }
  - { id: head, label: Head }
steps:
  - { id: s1, lane: author, col: 1, label: Commit A }
  - { id: s2, lane: reviewer, col: 2, label: Review A }
  - { id: s3, lane: head, col: 3, label: Head is A }
  - { id: s4, lane: author, col: 4, label: Push B }
  - { id: s5, lane: head, col: 5, label: Head is B }
  - { id: s6, lane: reviewer, col: 6, label: Success refused, emphasis: true, style: risk }
handoffs:
  - { from: s1, to: s2, label: asks }
  - { from: s2, to: s6, label: stale result, style: risk }
marker: { col: 4, label: head moves to B, style: risk }
```

## Claude Code

Use the `#` shortcut to add a memory.

## Codex CLI

Edit `AGENTS.md` by hand.
