# ex-5-1-routing: route strong and fast models

Configure both tools so planning and review use the strong model and implementation uses the fast one, then time one small task.

## Setup

```bash
cp -r exercises/ex-5-1-routing/starter ~/fm-ex/ex-5-1-routing && cd ~/fm-ex/ex-5-1-routing && npm i
npm test    # fails on purpose
```

## The task

The starter repo has a tiny function to build, `titleCase` in `src/text.mjs`, with tests in `test/text.test.mjs`. It is only there to give you something to time. The real work is the routing config:

| File | What to fix |
|---|---|
| `.claude/settings.json` | Default model should route plan mode to Opus and execution to Sonnet |
| `.claude/agents/reviewer.md` | Strong model, read-only tool allowlist |
| `.claude/agents/implementer.md` | Fast model, can edit |
| `codex/fm-plan.config.toml` | Codex profile for planning: strong model, high effort, read-only sandbox |
| `codex/fm-impl.config.toml` | Codex profile for implementing: fast model, low effort, workspace-write |
| `.codex/agents/reviewer.toml` | Codex project subagent for review: strong model, high effort, read-only |
| `timings.md` | One measured row per phase (plan, implement, review) per tool, plus a Decision paragraph |

Do the timing run yourself, not from the reference numbers:

1. Plan (strong model, no edits): ask the tool for a plan to implement `titleCase`. Note the seconds.
2. Implement (fast model): approve the plan, let the tool implement it, and get `npm test` green for `test/text.test.mjs`. Note the seconds.
3. Review (strong model, read-only): ask for a review of the diff. Note the seconds.

Copy the two Codex profiles into `~/.codex/` (they are additive, named `fm-*`) so `codex --profile fm-plan` works:

```bash
cp codex/fm-plan.config.toml codex/fm-impl.config.toml ~/.codex/
```

Codex model names change often. Open `/model` in Codex and use two models it actually lists. The verify script only requires that the effort and sandbox differ the right way, not a specific model name.

## Verify

```bash
npm test
```

It checks the config files and `timings.md`. It cannot check your judgement, so the checklist covers that.
