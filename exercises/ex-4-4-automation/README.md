# ex-4-4: Hooks and skills

Two pieces of automation for a tiny API repo:

1. A **hook** that formats every file the agent edits, deterministically, every time.
2. A **skill** that scaffolds a new route to the conventions in `CONVENTIONS.md`.

## Setup

```bash
cp -r exercises/ex-4-4-automation/starter ~/fm-ex/ex-4-4-automation
cd ~/fm-ex/ex-4-4-automation
git init -b main && git add -A && git commit -m "starter"
npm test        # red
```

No dependencies to install. `scripts/format.mjs` is a tiny formatter that stands in for Prettier.

## What to do

1. **Write `scripts/hook-format.mjs`.** It reads one hook event as JSON on stdin and formats the touched files with `formatFile` from `scripts/format.mjs`. It must handle both shapes:
   - Claude Code `Edit` / `Write`: `{"tool_name":"Write","tool_input":{"file_path":"/abs/a.js"},"cwd":"..."}`
   - Codex `apply_patch`: `{"tool_name":"apply_patch","tool_input":{"command":"*** Begin Patch\n*** Add File: a.js\n+...\n*** End Patch"},"cwd":"..."}` (paths are relative to `cwd`)

   It must exit 0 whatever happens.
2. **Wire the hook.**
   - Claude Code: `.claude/settings.json`, a `PostToolUse` group with matcher `Edit|Write`.
   - Codex: `.codex/hooks.json`, a `PostToolUse` group with matcher `^apply_patch$`. Codex skips a new hook until you trust it: run `/hooks` in the CLI.
3. **Write the skill** `new-api-route`.
   - Claude Code: `.claude/skills/new-api-route/SKILL.md`. Invoke it as `/new-api-route orders`.
   - Codex: `.agents/skills/new-api-route/SKILL.md`. Invoke it as `$new-api-route orders`, or pick it from `/skills`.
   - Use only `name` and `description` in the frontmatter, and keep the description on one line. Say what the skill does and when to use it.
4. **Use the skill** to add `GET /orders?customer=<id>`: it returns that customer's orders and returns `badRequest` when `customer` is missing.

## Verify

```bash
npm test
```

The tests pipe sample Claude Code and Codex events into your hook script, check the hook config and the skill file, and check the orders route and its registration. Whether the hook really fires inside the agent is on the checklist: ask for badly formatted code and look at the file.
