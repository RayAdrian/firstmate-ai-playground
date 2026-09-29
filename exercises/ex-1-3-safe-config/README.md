# Exercise 1.3: Safe agent config for both tools

Lesson: `l1-permissions`. Time: about 35 minutes.

## Goal

The starter repo ships with config someone copied from a blog post: Claude Code allows every Bash command, and Codex runs with no sandbox and no approvals. Replace both with guardrails:

- Tests and lint (`npm test`, `npm run lint`) run **without prompts**.
- **Network access is blocked** (commands and the web tools).
- **Secrets are unreadable**: `secrets.env` stands in for a real `.env` file.
- **Writes stay inside the repo.**

## Setup

Requires Node.js 22 or later. No dependencies.

```bash
cp -r exercises/ex-1-3-safe-config/starter ~/fm-ex/ex-1-3-safe-config
cd ~/fm-ex/ex-1-3-safe-config
git init && git add -A && git commit -m starter
npm test && npm run lint          # both should pass
node scripts/check-config.mjs     # lists what is wrong with the starter config
```

`secrets.env` is here because the repo-level `.gitignore` in this playground ignores files named `.env`. In a real repo, deny `Read(./.env)` and `Read(./.env.*)`.

## Steps

1. Read `scripts/check-config.mjs` and the two config files: `.claude/settings.json` and `.codex/config.toml`.
2. Fix `.claude/settings.json`. You can write it by hand, or ask Claude Code to do it. If you ask, note that it is editing its own permission config, so read the diff carefully. Use `/permissions` inside a session to see the rules Claude Code actually loaded.
3. Fix `.codex/config.toml`. Config layers in `.codex/` load only for trusted projects, so if Codex ignores your file, trust the project when it asks.
4. Run `node scripts/check-config.mjs` until it says OK.
5. Test the behavior by hand. The script checks the files, but only a session shows the config working:
   - In Claude Code: ask it to run `npm test`, then `npm run lint`, then `curl https://example.com`. The first two should not prompt. The last should be refused.
   - In Codex: ask it to run `npm test`. Then ask it to write a file in your home directory. Use `/status` to see the active approval policy and writable roots.
6. Practise recovery. Ask each tool to make a deliberately bad edit to `src/greet.js`. Undo it with `/rewind` in Claude Code, and with `git restore .` in Codex. Then try `/rewind` on a change made through a Bash command (for example, ask Claude to `rm` a file) and see what it cannot restore.

## Starter prompts

Claude Code:

```text
Read scripts/check-config.mjs to see what the config must contain. Then rewrite
.claude/settings.json so that `npm test` and `npm run lint` are allowed without
prompts, curl, wget and WebFetch are denied, reading secrets.env is denied, and
the Bash sandbox is enabled with no unsandboxed escape hatch. Do not touch
.codex/. Run `node scripts/check-config.mjs` and show me its output.
```

Codex CLI:

```text
Read scripts/check-config.mjs to see what the config must contain. Then rewrite
.codex/config.toml as a workspace-write sandbox with on-request approvals,
network access off and web search disabled. Do not touch .claude/. Run
`node scripts/check-config.mjs` and show me its output.
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
