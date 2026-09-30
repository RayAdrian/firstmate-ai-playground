# Gate script

`gate.mjs` decides whether a PR may merge, from a JSON snapshot of the PR state. The rules are in `RULES.md`.

- Run `npm test` before you say you are done. Never edit files under `tests/` or `fixtures/`.
- The gate fails closed: missing or malformed input blocks the merge. It never guesses "probably fine".
- Report every reason a PR is blocked, not just the first.
- No dependencies. Node's built-in modules only.
