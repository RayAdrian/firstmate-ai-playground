---
slug: l3-headless-agents
level: 3
sort: 4
title: Headless and scripted agents
objective: Run Claude Code with -p and Codex with exec from scripts, get schema-validated JSON back, pipe data in and out, and wire it into CI safely.
est_minutes: 35
tool_versions:
  claude_code: "2.1.284"
  codex_cli: "0.154.0"
last_verified_on: "2026-09-30"
differences:
  - "Claude Code uses `claude -p` and prints text by default. `--output-format json` wraps the answer in a result object, and with `--json-schema` the validated data is in the `structured_output` field. Codex uses `codex exec`, prints only the final message on stdout (progress goes to stderr), and `--output-schema <file>` constrains that final message."
  - "Schema input differs. Claude Code's `--json-schema` takes the schema as a string. Codex's `--output-schema` takes a path to a JSON Schema file, and `-o <file>` writes the final message to disk."
  - "Safe defaults differ. `codex exec` runs in a read-only sandbox unless you pass `--sandbox`. `claude -p` uses the Manual permission mode, so anything that would prompt is denied in a script, and you widen it with `--allowedTools` or `--permission-mode`."
  - "For an event stream, Claude Code uses `--output-format stream-json` (with `--verbose`), and Codex uses `--json` for JSONL events such as `turn.completed` and `item.completed`."
  - "For clean CI runs, Claude Code has `--bare`, which skips hooks, plugins, MCP, memory and CLAUDE.md discovery and needs an API key. Codex has `--ignore-user-config` and `--ignore-rules`."
exercise: ex-3-4-headless-changelog
claude_no_equivalent: false
codex_no_equivalent: false
---

## Concept

Headless mode runs the same agent without a person at the keyboard: a prompt goes in, an answer comes out, and the process exits with a status code. That makes an agent a step in a script, a cron job or a CI pipeline, like `jq` or `curl` with judgement.

**This app already does it.** The daily news digest (`npm run news:run`, code in `scripts/news/`) scores each feed item by handing a batch to `claude -p`. Per the spec (docs/PRD.md, I-3 and I-4), it runs with no tools enabled, marks the feed text as untrusted data in the prompt, requires a JSON result of a fixed shape, validates it, and treats anything invalid as unscored to retry later. That is the pattern this lesson teaches.

Rules for a script you'd trust:

1. **Ask for structured output and validate it yourself.** Give the tool a JSON Schema, then check the result in your code anyway. Never assume the shape.
2. **Least privilege.** Read-only unless the job must write. No tools if the job is classification or summarising. Allow specific commands, not everything.
3. **Treat inputs as untrusted.** Commit messages, issue text, web pages and feed items can contain instructions. Say in the prompt that the text is data, and don't give the run tools it could be tricked into misusing.
4. **Check the exit code and handle failure.** Set a timeout and a retry limit, and decide what happens when output is invalid (skip, retry, fail the build).
5. **Be deterministic where you can.** Pin the prompt in a file, keep the schema in the repo and log the tool version.
6. **Watch cost and time.** A loose headless call can load a large context. Cap turns, budget or batch size.
7. **Keep secrets out of the agent's reach.** In CI, give the API key only to the step that runs the agent.

```diagram
type: flow
id: headless-validate-retry
title: One scripted agent call
summary: The script validates every result itself. Invalid output is retried a few times, then skipped instead of trusted.
steps:
  - id: input
    label: Input
    sub: untrusted text
  - id: agent
    label: Agent call
    sub: claude -p
  - id: validate
    label: Validate
    sub: your code
    emphasis: true
  - id: use
    label: Use result
loops:
  - from: validate
    to: agent
    label: invalid, retry
exits:
  - from: validate
    label: retries used up
    text: Left unscored
    style: risk
```

### First Mate tip

Headless is where AI work becomes repeatable for a client: changelog drafts, PR risk summaries, log triage, release notes. Build it as a normal script with a schema and tests that use a fake agent. Deliver it with a note on cost per run and what happens if the model output is invalid. Clients accept "it fails safe and tells you" far more readily than "it's usually right".

## Claude Code

`-p` (`--print`) runs a prompt and prints the response. Exit code is 0 on success and non-zero on failure.

```bash
claude -p "What does the auth module do?"
cat build-error.txt | claude -p "concisely explain the root cause of this build error" > out.txt
```

Piped stdin is capped at 10MB. Larger input goes in a file that the prompt references.

**Structured output.** `--output-format` is `text` (default), `json` or `stream-json`. With `json` the result object includes session id, usage and `total_cost_usd`. Add `--json-schema` and the validated data appears in `structured_output`:

```bash
claude -p "Classify this commit subject: 'fix: null check in parser'" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"category":{"type":"string","enum":["feature","fix","chore"]}},"required":["category"]}' \
  | jq '.structured_output'
```

Output: `{"category":"fix"}`. The same text also arrives as a string in `.result`. An invalid schema makes `claude` exit with `Error: --json-schema is not a valid JSON Schema`.

**Least privilege flags:**

```bash
# No tools at all: pure text in, text out (classify, summarise, score)
claude -p "$PROMPT" --tools "" --output-format json --json-schema "$SCHEMA"

# Allow only what the job needs
claude -p "Run the tests and fix failures" --allowedTools "Bash(npm test *),Read,Edit"

# Locked-down CI: anything that would prompt is denied
claude -p "..." --permission-mode dontAsk
```

Other flags you'll use: `--max-budget-usd <amount>`, `--no-session-persistence`, `--append-system-prompt`, `--model`, and `--continue` or `--resume <session-id>` for follow-ups (capture the id from `.session_id` in JSON output).

**Start clean in CI.** Without `--bare`, `-p` loads the same context an interactive session would, including your `CLAUDE.md`, hooks, plugins and MCP servers. On a developer machine, one tiny classification call like the one above loaded about 44,000 tokens of context. Add `--bare` for scripts. It skips those, and it never reads OAuth or the keychain, so set `ANTHROPIC_API_KEY`:

```bash
claude --bare -p "Summarize README.md" --allowedTools "Read"
```

**GitHub Actions.** Use the official action, `anthropics/claude-code-action@v1`, with the key in a secret:

```yaml
- uses: actions/checkout@v6
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: "Summarize the risks in this pull request"
    claude_args: "--max-turns 5"
```

The action needs `id-token: write` in `permissions`, and `claude_args` takes any CLI flag. Never commit a key.

## Codex CLI

`codex exec` runs Codex non-interactively. Progress streams to stderr and only the final agent message goes to stdout, so it pipes cleanly:

```bash
codex exec "generate release notes for the last 10 commits" | tee release-notes.md
npm test 2>&1 | codex exec "summarize failures and propose fixes"
cat prompt.txt | codex exec -
```

If stdin is piped and you also pass a prompt argument, the prompt is the instruction and the piped text is appended as a `<stdin>` block. `codex exec -` reads the whole prompt from stdin.

**Structured output.** `--output-schema` takes a path to a JSON Schema file. `-o`/`--output-last-message` writes the final message to a file (and it still prints to stdout):

```bash
cat > schema.json <<'EOF'
{
  "type": "object",
  "properties": { "category": { "type": "string", "enum": ["feature", "fix", "chore"] } },
  "required": ["category"],
  "additionalProperties": false
}
EOF

codex exec --ephemeral --output-schema ./schema.json -o ./out.json \
  "Classify this commit subject: 'fix: null check in parser'"
cat out.json   # {"category":"fix"}
```

Keep `additionalProperties: false` in the schema, as the Codex docs example does.

**Least privilege.** `codex exec` runs in a read-only sandbox by default. Widen it deliberately:

```bash
codex exec --sandbox workspace-write "Fix the failing test"   # allow edits
```

`danger-full-access` is only for an already-isolated runner. Also useful: `--ephemeral` (don't save session files), `--ignore-user-config` and `--ignore-rules` (predictable automation), `--skip-git-repo-check` (Codex requires a Git repo by default), and `-m` for the model.

**Events.** `codex exec --json` turns stdout into JSONL with events such as `thread.started`, `turn.completed`, `turn.failed`, `item.*` and `error`:

```bash
codex exec --json "summarize the repo structure" | jq
```

**Follow-ups.** `codex exec resume --last "fix the race conditions you found"`.

**CI.** Set `CODEX_API_KEY` only on the step that runs Codex, not as a job-level variable in a workflow that also runs repository code:

```bash
CODEX_API_KEY=$KEY codex exec --json "triage open bug reports"
```

For GitHub Actions, the docs recommend `openai/codex-action@v1` instead of installing the CLI yourself. It starts a proxy so the API key isn't exposed to your build steps:

```yaml
- uses: openai/codex-action@v1
  with:
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    prompt: "Summarize the risks in this pull request"
```
