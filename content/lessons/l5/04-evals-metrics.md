---
slug: l5-evals-metrics
level: 5
sort: 4
title: "Evals and metrics: prove the agents help"
objective: "Test your prompts, skills, CLAUDE.md and subagents with a small eval set (deterministic checks first, a judge only where needed), run it headless in CI, and measure whether agents help a team with lead time, review rounds, escaped defects and cost per merged PR."
est_minutes: 60
tool_versions:
  claude_code: "2.1.287"
  codex_cli: "0.154.0"
last_verified_on: "2026-10-02"
differences:
  - "Eval runner: Claude Code 2.1.269 and later has `claude plugin eval`, which runs case folders against a plugin or skills-directory plugin, grades them, compares with a no-plugin baseline and exits non-zero under a threshold. Codex 0.154.0 has no eval command, so you run `codex exec` from your own harness (the exercise builds one)."
  - "Cost cap: `claude -p --max-budget-usd <n>` stops a headless run at a dollar figure, and `claude plugin eval --max-cost-usd <n>` caps a whole suite. `codex exec` has no budget flag, so you bound spend with the number of cases, a cheap model and a CI timeout."
  - "Per-run numbers: `claude -p --output-format json` returns one object with `total_cost_usd`, per-model `modelUsage` and `is_error`. `codex exec --json` streams JSONL events, and the `turn.completed` event carries token counts only, with no dollar figure."
  - "Telemetry for team metrics: Claude Code exports OpenTelemetry metrics (`claude_code.cost.usage`, `claude_code.token.usage`, `claude_code.pull_request.count`, `claude_code.commit.count`) once `CLAUDE_CODE_ENABLE_TELEMETRY=1`. Codex exports OpenTelemetry log events from an `[otel]` table in `config.toml`, with token counts on its `codex.sse_event` completion events and no cost metric."
exercise: ex-5-4-evals-metrics
claude_no_equivalent: false
codex_no_equivalent: false
tldr:
  points:
    - "Test prompts, skills and `CLAUDE.md` against a small set of real tasks."
    - "Check outcomes in code first: tests pass, only expected files change, cost stays under a cap."
    - "Track lead time, review rounds, escaped defects and cost per merged PR."
  try_this:
    all: { kind: command, text: "gh pr list --state merged --limit 100 --json number,createdAt,mergedAt,additions,deletions" }
---

## Concept

A prompt, a skill, a `CLAUDE.md` or `AGENTS.md`, a subagent definition, a hook: all of these change what an agent does, and you edit them as often as code. You would not ship a code change with no test. Without evals you ship these on a feeling, and a feeling is how a "small tweak" to a rules file quietly makes every run worse. This lesson has two halves. The first tests your agent setup. The second checks, with numbers, whether the agents are helping a team or a client at all.

### Half one: evals for your agent setup

An eval is a small, fixed set of cases. Each case is a task, a known starting state and a way to decide whether the result is acceptable. You run the same cases before and after you change the setup, and you compare.

**The case.** Write down what the agent gets and what "good" looks like:

| Part | Example |
|---|---|
| Task | "Add `slugify(input)` in `src/slug.js` with a test." |
| Starting state | A fixture repo, copied fresh for every run |
| Checks | The new test passes, `src/slug.js` exists, the diff touches only `src/` and `tests/`, the diff is under 80 changed lines |

**Check with code first, a judge second.** Order the checks by cost and by how much you can trust them:

| Check | Cost | Use it for |
|---|---|---|
| Tests, type check or lint pass | Free, exact | "Did it work?" |
| A file exists or contains a pattern | Free, exact | "Did it follow the structure we asked for?" |
| The diff touches only allowed paths, stays under a size | Free, exact | "Did it stay in scope?" |
| A tool or skill was invoked | Free, from the transcript | "Did the skill trigger on natural phrasing?" |
| A rubric graded by a second model (LLM-as-judge) | A model call, and it can vary between runs | Quality that code cannot check: "Is the explanation correct and clear?" |

Run the free checks first. If any fails, the case has failed and the judge call is wasted, so skip it. When you do use a judge, write the rubric as concrete PASS and FAIL conditions, keep it to short outputs, and spot-check its verdicts against your own: a judge that nobody has compared with a human is a number you cannot trust.

```diagram
type: flow
id: eval-case-run
title: What one eval case does
summary: Every case starts from the same fixture. The free code checks run first, and a failure there ends the case before any judge call is paid for.
steps:
  - id: task
    label: Fixture
    sub: same start
  - id: run
    label: Agent run
    sub: cheap model
  - id: code
    label: Code checks
    sub: free, exact
    emphasis: true
  - id: judge
    label: Judge
    sub: last, if needed
exits:
  - from: code
    label: any fail
    text: Fail, skip judge
    style: risk
```

**Keep it small and keep the cost bounded.**

- Start with 5 to 15 cases. Take them from real work: the task the agent got wrong last week, the file it should never touch, the skill that did not trigger. A short set you run on every change beats a big one you run twice.
- Pin the model. A model update during your experiment looks exactly like a regression in your prompt.
- Run once with a cheap model for routine changes, and three times (agents are not deterministic) with the model you ship for the changes that matter, such as a `CLAUDE.md` rewrite.
- Always compare with a baseline: the same cases without your change. A case that scores 100% with and without your skill says the skill did nothing.
- Never let an eval run unattended without a ceiling: a dollar budget where the tool has one, otherwise a case count and a timeout.

**Run it in CI when the setup changes.** The files that steer the agent are the trigger, not the application code:

```yaml
on:
  pull_request:
    paths:
      - "CLAUDE.md"
      - "AGENTS.md"
      - ".claude/**"
      - ".agents/**"
      - "evals/**"
```

The job runs the cases headless, reads the exit code and fails the build when the score drops below the threshold you set. A threshold of 1.0 on a non-deterministic agent will flake; start at 0.8 and tighten it as the cases prove stable. Keep API keys in `secrets`, and remember that a pull request from a fork gets no secrets.

### Half two: metrics that show whether agents help

An eval tells you the setup works on your cases. A metric tells you whether the team ships better. The numbers that matter are the same ones you would use without AI. Measure them before the agents arrive, because a baseline you did not take cannot be taken later.

| Metric | Question it answers | Where it comes from | Trap |
|---|---|---|---|
| Lead time to merge | Do changes reach `main` faster? | PR `createdAt` to `mergedAt` | Report the median, not the mean: one stalled PR ruins a mean |
| PR size | Are changes still reviewable? | Additions plus deletions, files changed | Agents make big PRs cheap; big PRs get shallow reviews |
| Review rounds | How often does a change come back? | Number of times a reviewer or gate sent it back | A falling number is only good if the review is still real |
| Escaped defects | Do bugs reach users? | Bugs found after merge, linked to the PR that caused them | Needs a convention (a label or a link) from day one |
| Rework or revert rate | Does merged work get redone? | Reverts, and follow-up fixes within a few days of a merge | Looks fine for a month, then not |
| Cost per merged PR | What does a change cost? | Agent spend divided by merged PRs | Counts retries and abandoned runs, which is the point |

Most of the first three come straight from your Git host:

```bash
gh pr list --state merged --limit 100 --json number,createdAt,mergedAt,additions,deletions \
  | jq '[.[] | {hours: (((.mergedAt|fromdateiso8601) - (.createdAt|fromdateiso8601)) / 3600),
                size: (.additions + .deletions)}]
        | {prs: length, median_hours: (map(.hours) | sort | .[length/2|floor]),
           median_size: (map(.size) | sort | .[length/2|floor])}'
```

**Cost per merged PR.** Spend is the numerator and you have to collect it. Both tools expose usage, and neither number is an invoice: Claude Code computes its dollar figure locally from token counts at list price, and Codex reports tokens, so you apply a price you looked up yourself. Treat every cost as an estimate and say so. Divide by merged PRs, not by sessions, so failed attempts and retries stay in the cost.

**The anti-metric: do not measure lines of code.** Lines written or accepted is the easiest number to get (Claude Code's analytics and its telemetry both report it) and the least meaningful. An agent adds lines for free, so any target on lines gets hit by making the code bigger. It also hides the cost: more lines to review, more to maintain, more places for a defect. If lines of code is the only number on a client slide, the slide proves nothing.

**Presenting this to a client honestly.**

- Take a baseline before the engagement starts, from the client's own repository history. "Median lead time was 4.1 days before, 2.6 now" means something. "AI makes us 40% faster" does not.
- Show the counter-metrics next to the good ones: lead time with escaped defects, speed with review rounds, output with cost.
- Give ranges and sample sizes. With 20 merged PRs a month, say so, and do not draw a trend line through three points.
- Say what else changed. A new hire, a quieter month or an easier backlog moves these numbers as much as an agent does. You can show a correlation; you usually cannot show a cause.
- Include the failures: the cases your evals caught, the PR an agent got wrong, the revert. A report with no bad news is not believed.

### First Mate tip

This repo is a working example of both halves, and it is worth reading before you design your own.

- **The merge gates are an eval of the agents' output.** Each PR is a case. `npm run ci:local` runs the typecheck, lint, unit, build and end-to-end steps on one pinned commit and posts a `ci/local` status, with a log in `/private/tmp/ci-local-pr<PR>-<sha7>.log`. `scripts/gate-status.sh` posts `gate/browser`, `gate/review` and `gate/uiux` on the commit that was reviewed. The review gate also looks for "edits outside owned paths" (the ownership table in `AGENTS.md`). That is a `diff touches only allowed paths` check, done here by the review agent; as a script it would be free and exact, which is the first thing the exercise in this lesson builds. Tests and path rules should come first, and an agent review is for what code cannot see.
- **The news digest scores are an LLM judge with a rubric file.** `scripts/news/prompt.ts` sends each batch of items to `claude -p` with no tools and puts `content/news/firstmate-profile.md` in the system prompt. That file is the rubric: "What scores high (80-100)", "What scores medium (40-79)", "What scores low (0-39)" and the allowed tags. The output must be a JSON array, and `scripts/news/score-parse.ts` validates every object against a schema, so a malformed score leaves the item unscored instead of being trusted. The rubric lives in a file you can edit without a code change, which is the right place for it.
- **What this repo does not do yet.** It keeps no human-labelled set to check the judge against, so nothing says how closely the digest scores match what an engineer would pick. It also does not publish first-pass gate rates, lead times or cost per PR. Both are the next step, and `gh pr list --json` plus the `scorer_model` stored with each score are enough to start.

Put the same on a client engagement from the first sprint: five eval cases for the `CLAUDE.md`, a baseline of lead time and PR size taken before the agents start, and one line in the sprint report for cost per merged PR.

## Claude Code

### One case, headless

Run a case in a fresh copy of the fixture, with a cheap model and a budget, and keep the JSON:

```bash
rm -rf /tmp/case && cp -r evals/fixtures/todo-app /tmp/case && cd /tmp/case && git init -q && git add -A && git commit -qm base
claude -p "$(cat ~/work/evals/cases/add-slugify/prompt.md)" \
  --model haiku \
  --output-format json \
  --max-budget-usd 0.50 \
  --no-session-persistence \
  --allowedTools "Read,Edit,Write,Bash(npm test *)" > result.json
jq '{is_error, subtype, cost: .total_cost_usd, models: .modelUsage | keys}' result.json
```

`--output-format json` returns one object. The fields to read are `is_error`, `subtype`, `total_cost_usd` (a client-side estimate), `modelUsage` (per-model tokens and cost) and `session_id`; with `--json-schema` the validated answer is in `structured_output`. `--max-budget-usd` is a ceiling checked as the run goes. A run that hits it exits with `is_error: true` and `subtype: "error_max_budget_usd"`. In a probe for this lesson, a one-word reply with a cap of `0.05` hit it, because the startup context alone was about 38,000 cache-write tokens and the run cost $0.078. Budget with headroom, and treat `is_error` as a failed case, never as a pass.

Then check with code, outside the agent:

```bash
cd /tmp/case
npm test || echo "FAIL tests"
git diff --name-only HEAD | grep -v -E '^(src|tests)/' && echo "FAIL out-of-scope edit"
```

Pass `--bare` in CI so a teammate's hooks or an MCP server cannot change the result. It skips `CLAUDE.md` discovery too, so load the file you are testing explicitly (`--append-system-prompt-file CLAUDE.md`), and it needs `ANTHROPIC_API_KEY`, because bare mode does not read your login. For a rubric, run a second, tool-less call with `--json-schema` that returns `{ "verdict": "pass" | "fail", "reason": "..." }` and gate on the `structured_output` field.

### The built-in runner: `claude plugin eval`

If your skills, agents or hooks are packaged as a plugin (or a skills-directory plugin), Claude Code has a runner. It needs 2.1.269 or later and counts against your plan or API bill.

```text
my-plugin/
  skills/commit-message/SKILL.md
  evals/
    renames-a-function/
      prompt.md          # frontmatter: max_turns, allowed_tools; body: the task
      graders/
        skill-fired.md   # type: tool_used, tool: Skill
        criteria.md      # type: llm, with a PASS and FAIL rubric
```

Graders of type `regex`, `tool_used`, `tool_order` and `file_exists` cost nothing. Only `llm` and `baseline` graders call a judge model, and the judge defaults to a small fast one. Every case runs three times by default, with the plugin and again without it, and the summary shows `WITH`, `W/OUT` and the difference. `claude plugin eval init` writes a first suite for you.

```bash
claude plugin eval . \
  --trust-plugin --json results.json --threshold 0.8 \
  --model <pinned-model> --judge-model <cheap-model> \
  --no-publish --max-cost-usd 20
```

Exit code 0 means every case met the threshold. 1 means a case scored lower or failed to load. 2 means the run stopped early at `--max-cost-usd` or on a rejected credential, with `results.json` still written. The with-minus-without difference is reported but never changes the exit code. `plugin eval` tests plugins, so a bare `CLAUDE.md` change still needs the script above.

### Run it in CI

```yaml
name: agent-evals
on:
  pull_request:
    paths: ["CLAUDE.md", ".claude/**", "evals/**"]
jobs:
  evals:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v6
      # Install Claude Code on the runner as in lesson 5.3, with ANTHROPIC_API_KEY from secrets.
      - run: claude plugin eval . --trust-plugin --json results.json --threshold 0.8 --no-publish --max-cost-usd 5
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Measure cost and usage

| Where | What you get |
|---|---|
| `/usage` in a session (`/cost` and `/stats` are aliases) | Session cost at list price, tokens per model, and on a subscription your plan limits. Subscribers should ignore the dollar figure for billing. |
| `claude -p --output-format json` | `total_cost_usd` and `modelUsage` for one run: sum these per PR |
| OpenTelemetry | Set `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=otlp` and an endpoint. Metrics include `claude_code.cost.usage`, `claude_code.token.usage`, `claude_code.pull_request.count` and `claude_code.commit.count`; the `claude_code.api_request` event carries `cost_usd`. |
| Team and Enterprise analytics | A dashboard with PRs merged with Claude Code assistance (needs the GitHub app), and a spend report CSV. Both are described by Anthropic as conservative estimates. |
| Claude Console | Spend and accepted lines per member, and the Claude Code Analytics API, for API-billed organizations |

For cost per merged PR, tag each headless run with the PR number in your own log, or use `OTEL_RESOURCE_ATTRIBUTES` to add a team or repo attribute to the metrics, and divide a week's spend by that week's merged PRs.

## Codex CLI

### One case, headless

```bash
rm -rf /tmp/case && cp -r evals/fixtures/todo-app /tmp/case && cd /tmp/case && git init -q && git add -A && git commit -qm base
codex exec -C /tmp/case --ephemeral -s workspace-write --json \
  --profile fm-impl -o /tmp/case-last.txt \
  "$(cat ~/work/evals/cases/add-slugify/prompt.md)" > /tmp/case-events.jsonl
```

`--json` turns stdout into a JSONL stream. The event types are `thread.started`, `turn.started`, `turn.completed`, `turn.failed` and `item.*` events for messages, commands and file changes. `-o` writes the final message to a file. Use `-s workspace-write` only inside the throwaway fixture copy, and `--profile fm-impl` for the fast model from lesson 5.1. The `turn.completed` event carries the usage:

```bash
jq -c 'select(.type=="turn.completed") | .usage' /tmp/case-events.jsonl
# {"input_tokens":16107,"cached_input_tokens":15104,"cache_write_input_tokens":0,"output_tokens":5,"reasoning_output_tokens":0}
jq -e 'select(.type=="turn.failed")' /tmp/case-events.jsonl > /dev/null && echo "FAIL: turn failed"
```

Then run the same code checks as in the Claude Code tab: `npm test` and `git diff --name-only HEAD` against the allowed paths. A `turn.failed` event is a failed case.

### No built-in runner: use your own harness

Codex 0.154.0 has no eval command and no budget flag, so the runner is a script you own. That is what the exercise builds: a spec of cases, deterministic checks that fail closed, and a pass-rate report. For a rubric, run a read-only judge and gate on its structured verdict:

```bash
codex exec --ephemeral -s read-only \
  --output-schema evals/judge.schema.json -o judge.json \
  "Grade evals/out/add-slugify against the rubric in evals/rubrics/slugify.md. Do not edit files."
jq -e '.verdict == "pass"' judge.json
```

Keep spend bounded by case count, the cheap profile and a workflow `timeout-minutes`, since there is no dollar cap to rely on.

### Run it in CI

Use `openai/codex-action@v1` from lesson 5.3 with a `paths` filter on `AGENTS.md`, `.agents/**` and `evals/**`, and run your harness after it. For a single scripted run outside the action, `CODEX_API_KEY=<key> codex exec --json "..."` sets the key for that one invocation; keep the key in `secrets`.

### Measure cost and usage

- `codex exec --json`: sum `input_tokens`, `cached_input_tokens` and `output_tokens` over the `turn.completed` events of a run. Multiply by the model price you look up; there is no dollar field.
- OpenTelemetry: add an `[otel]` table to `config.toml` with an `otlp-http` or `otlp-grpc` exporter. It is off by default, it exports log events (`codex.conversation_starts`, `codex.api_request`, `codex.sse_event`, `codex.tool_decision`, `codex.tool_result`), and token counts arrive on the `response.completed` events. Prompts are redacted unless you set `log_user_prompt = true`.

For cost per merged PR, log the token totals of each headless run with the PR number, price them once in a script, and divide a period's total by its merged PRs. The merge counts come from `gh pr list` exactly as in the Claude Code tab.
