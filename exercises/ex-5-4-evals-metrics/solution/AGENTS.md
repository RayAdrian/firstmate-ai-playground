# Eval harness

`bin/run-evals.js` scores a folder of saved agent outputs against `evals/spec.json` and prints a JSON report. The rules are in the comments of `src/checks.js` and `src/report.js`.

- Run `npm test` before you say you are done. Never edit files under `tests/`, `outputs/` or `evals/`.
- The harness fails closed: a missing file, an unknown check type, a bad path or a check that throws is a failure, never a pass.
- It makes no model calls and runs no commands from the outputs. Node's built-in modules only.
- `src/glob.js` and `src/diff.js` are finished. Your work is `src/checks.js` and `src/report.js`.
