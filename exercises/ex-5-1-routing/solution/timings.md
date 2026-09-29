# Timings

Task: implement `titleCase` in `src/text.mjs` so `npm test` passes.
Measure wall-clock seconds for each phase (a stopwatch, or `time` around `claude -p` / `codex exec`).
One row per phase per tool. Phase is `plan`, `implement` or `review`. Tool is `claude` or `codex`.
Effort is one of `low`, `medium`, `high`, `xhigh`, `max`.

The numbers below are an example run, not a benchmark. Yours will differ.

| Phase | Tool | Model | Effort | Seconds |
|---|---|---|---|---|
| plan | claude | opus | high | 41 |
| implement | claude | sonnet | medium | 18 |
| review | claude | opus | high | 33 |
| plan | codex | gpt-5.6-sol | high | 38 |
| implement | codex | gpt-5.6-luna | low | 12 |
| review | codex | gpt-5.6-sol | high | 35 |

## Decision

The fast model wrote a correct `titleCase` on the first pass, in about a third of the planning time.
The strong model earned its cost in the plan and the review, where a wrong call is expensive to spot later.
Next time I would keep planning and review on the strong model and leave implementation on the fast one.
