# ex-5-4-evals-metrics: a tiny eval harness

Finish a harness that scores saved agent outputs against a spec: deterministic checks first, a pass-rate report at the end. It makes no model calls and runs nothing from the outputs, so it is free, offline and repeatable. That is the shape of the cheap part of any agent eval, which in a real setup runs after the agent has produced its output.

## Setup

```bash
mkdir -p ~/fm-ex && cp -r exercises/ex-5-4-evals-metrics/starter ~/fm-ex/ex-5-4-evals-metrics && cd ~/fm-ex/ex-5-4-evals-metrics
git init -q -b main && git add -A && git -c user.name=fm-learner -c user.email=learner@example.com commit -q -m baseline
npm install
npm test                  # fails on purpose
node bin/run-evals.js; echo "exit=$?"    # reports a 100% pass rate for outputs that are plainly wrong
```

Needs Node 22 or newer. No dependencies.

## The scenario

An agent was given one task: *add a `slugify(input)` function in `src/slug.js` with a test, touch only `src/`, `tests/` and `docs/`, keep the change under 80 changed lines.* Twelve saved attempts sit in `outputs/<case-id>/`. Each has the files the agent wrote and a `patch.diff` (the `git diff` of its change). `evals/spec.json` lists, per case, the checks to run:

| Check | Passes when |
|---|---|
| `file_exists { path }` | the file exists in the case folder |
| `file_contains { path, pattern, flags? }` | the regex matches the file's text |
| `file_not_contains { path, pattern, flags? }` | the file exists and the regex does not match |
| `diff_touches_only { diff?, allow }` | every file in the diff matches an allow glob (`diff` defaults to `patch.diff`) |
| `max_diff_lines { diff?, max }` | added plus removed lines is at most `max` |
| `rubric { criteria }` | never. It needs a judge model, so the harness reports it as `skipped` |

`src/glob.js` (a small glob matcher) and `src/diff.js` (a unified-diff reader that returns the files, including rename sources, and the line counts) are finished. `bin/run-evals.js` is finished too. You write two files.

## Your job

1. **`runCheck` in `src/checks.js`**: implement every check type. Make every doubtful situation a failure: a missing file, a path that leaves the case folder (`..`, an absolute path, a symlink out), an empty or missing diff, a `..` segment in a diff path, a bad regex, a bad limit, an unknown check type. `rubric` returns `skipped`.
2. **`evaluateCase` and `buildReport` in `src/report.js`**: a case passes only if every scored check passes; a case with nothing left to score is `unscored`; a case with no checks, a bad id or no output folder fails; a check that throws is a failed check. The report holds `total_cases`, `passed`, `failed`, `unscored`, `pass_rate` (over scored cases, three decimals, `null` when nothing was scored), `threshold`, `ok`, `failures_by_type` and `cases`.
3. Run `npm test` until it passes, then run `node bin/run-evals.js` and read the report. With the spec threshold of 0.8 the run must be blocked: only 4 of the 11 scored cases are good.

Do not edit `tests/`, `outputs/` or `evals/`. Ask your agent to explain, before it codes, why a rubric check must never count as a pass and why an empty diff must not pass `diff_touches_only`. Check that it can explain both back to you.

## Stretch (not tested)

Point the harness at real saved outputs from your own repo: run an agent headlessly on 3 to 5 small tasks (`claude -p --output-format json`, or `codex exec --json -o`), save each run's `git diff` as `patch.diff`, and write the spec before you look at the results. Then add one new check type of your own, for example "no new entries in `package.json` dependencies".

## Verify

```bash
npm test
```
