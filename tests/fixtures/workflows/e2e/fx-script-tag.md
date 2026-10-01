---
title: Fixture workflow with a script tag
problem: A fixture whose body contains a script tag that must render as escaped text
tools:
  - claude-code
use_cases:
  - security
stacks:
  - any
tool_versions:
  claude_code: 2.1.0
verified_on: 2026-09-27
client_safe: confirmed
---

## Result

### Before

Pasted markup in shared content ran in the reader's browser.

### After

Markup in shared content shows up as plain text and never runs.

## Setup

No setup files.

## Prompt

```text
Render this page and confirm that no script runs.
```

## Steps

1. Open the page.
2. Check that the markup is shown as text.

## Why it works

<script>window.__xss=1</script> The renderer escapes raw markup, so the tag above is displayed rather than executed.
