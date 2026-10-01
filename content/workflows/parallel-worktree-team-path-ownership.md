---
title: Parallel worktree team with path ownership
problem: Parallel agents collide on the same files.
tools: [claude-code]
use_cases: [parallel-work, planning]
stacks: [any]
related_lesson: l5-multi-agent-teams
tool_versions:
  claude_code: 2.1.286
verified_on: 2026-10-01
client_safe: confirmed
---

## Result

### Before
Two agents edited the same shared config and test helper on different branches. The second PR had merge conflicts in files neither agent was meant to change, and one overwrote a fix from the other.

### After
Each workstream owns named paths (source folders, its own `tests/<ws>/` directory) and runs in its own git worktree on its own branch. Shared files such as `package.json`, contracts and test helpers are frozen after a foundation milestone and change only in a dedicated PR. Five workstreams ran side by side, and a reviewer can reject any diff that touches a path outside its owner's list.

## Setup

```markdown path=AGENTS.md kind=context-file
### Path ownership
- Edit only the paths your workstream owns. Ownership table: docs/PRD.md, "Workstreams".
- Frozen after the foundation milestone (change only in a dedicated foundation PR):
  package.json, src/lib/contracts/, migrations, src/lib/db/, tests/support/.
- Each workstream owns tests/e2e/<ws>/ and tests/unit/<ws>/.
- If you need something outside your paths, say so in your final report instead of editing it.
- One git worktree per branch. Branch names: ws-<letter>/<desc>. Rebase on main before review.
```

## Prompt

```text
You are workstream <letter>. Create your worktree with
`git worktree add .claude/worktrees/ws-<letter> -b ws-<letter>/<desc> origin/main`, then work only there.
You own: <paths>. Everything else is read-only for you.
Write tests first, edit only your paths, and use only port <port> for dev servers.
Final report: PR URL, head SHA, criteria done and deferred, and anything you needed outside your paths.
```

## Steps

1. List workstreams and the paths each owns in the spec, plus the frozen shared files.
2. Merge the foundation PR (contracts, shared helpers, config) first so everyone builds on the same base.
3. Spawn one agent per workstream with the Prompt above and a unique port.
4. Have the reviewer reject any diff touching paths outside the author's list, then rebase on main before the gates.
5. Merge in dependency order and re-run the next PR's checks after each merge.

## Why it works

Conflicts come from two writers on one file, so giving every file one owner removes the cause instead of resolving it afterwards. Freezing the shared surface after a foundation milestone makes cross-cutting changes deliberate and reviewable. A path list also gives the reviewer a mechanical check that does not need to understand the feature.
