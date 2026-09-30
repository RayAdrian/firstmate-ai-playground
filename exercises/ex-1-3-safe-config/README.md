# Exercise 1.3: Safe agent config for both tools

Lesson: `l1-permissions`. Time: about 35 minutes.

> **WARNING: the starter config is deliberately unsafe. Do not run an agent under it.**
> `starter/.codex/config.toml` sets `danger-full-access` with `approval_policy = "never"` (no sandbox, no prompts, live web search). `starter/.claude/settings.json` allows `Bash(*)` (every shell command runs without asking).
>
> - Fix both files **by hand in a plain editor** before you launch `claude` or `codex` in this folder.
> - Do not answer "trust" to any folder-trust prompt until the files are fixed.
> - If you must open an agent earlier, override the config on the command line (see "Safe launch flags"), and know that a project `allow` rule such as `Bash(*)` still applies to Claude Code. Prefer not to.

## Goal

Replace the over-permissive config with guardrails:

- Tests and lint (`npm test`, `npm run lint`) run **without prompts**.
- **Network access is blocked** (commands and the web tools).
- **Secrets are unreadable**: `secrets.env` stands in for a real `.env` file.
- **Writes stay inside the repo.**

## Setup

Requires Node.js 22 or later. No dependencies. Work in a copy, in an editor, with no agent running.

```bash
cp -r exercises/ex-1-3-safe-config/starter ~/fm-ex/ex-1-3-safe-config
cd ~/fm-ex/ex-1-3-safe-config
git init && git add -A && git commit -m starter
npm test && npm run lint          # both should pass
node scripts/check-config.mjs     # lists what is wrong with the starter config
```

`secrets.env` is here because the repo-level `.gitignore` in this playground ignores files named `.env`. In a real repo, deny `Read(./.env)` and `Read(./.env.*)`.

## Steps

1. Read `scripts/check-config.mjs`, `.claude/settings.json` and `.codex/config.toml` in your editor. Do not start an agent yet.
2. Edit `.claude/settings.json` by hand: narrow the allow list, add the deny rules, turn on the sandbox. The lesson has the syntax.
3. Edit `.codex/config.toml` by hand: workspace-write sandbox, on-request approvals, no network, web search disabled.
4. Run `node scripts/check-config.mjs` until it says OK.
5. Now test the behavior by hand, launching each tool with the safe flags below so a mistake in your config cannot widen access.
   - Claude Code: ask it to run `npm test`, then `npm run lint`, then `curl https://example.com`. The first two should not prompt. The last should be refused. Use `/permissions` to see the rules it loaded.
   - Codex: ask it to run `npm test` (no prompt), then to write a file in your home directory (blocked, or an approval request you decline). `/status` shows the approval policy and writable roots.
6. Practise recovery. Ask each tool to make a deliberately bad edit to `src/greet.js`. Undo it with `/rewind` in Claude Code, and with `git restore .` in Codex. Then ask Claude to `rm` a file and see what `/rewind` cannot restore.

## Safe launch flags

```bash
claude --permission-mode default
codex --sandbox workspace-write --ask-for-approval on-request
# stricter still, for reading only:
codex --sandbox read-only --ask-for-approval on-request
claude --permission-mode plan
```

CLI flags outrank project config in Codex. `default` is Manual mode in Claude Code: it asks before edits and commands, except for anything a settings `allow` rule already approves.

## Starter prompts (use after your config passes the check)

Claude Code:

```text
Run `npm test` and `npm run lint`. Then try `curl https://example.com` and tell me exactly what happened.
```

Codex CLI:

```text
Run `npm test`. Then try to create ~/outside-repo.txt and tell me exactly what happened.
```

## Verify

```bash
node scripts/check-config.mjs
```

It exits non-zero on the starter and zero on the reference solution. It checks the files only. The behavior checks in step 5 are on the checklist.

## Compare

```bash
git diff --no-index exercises/ex-1-3-safe-config/starter exercises/ex-1-3-safe-config/solution
```

## Notes

- On Linux and WSL2, the Claude Code sandbox needs `bubblewrap` and `socat`. Without them Claude Code warns and runs commands unsandboxed unless you also set `sandbox.failIfUnavailable`.
- Do not test the "bad edit" step on a real client repo.
