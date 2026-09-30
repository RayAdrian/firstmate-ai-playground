# Gate rules

## What the gate reads

`gate.mjs` takes a JSON snapshot of a PR (the shape mirrors what `gh api` returns, so a live version is a small step):

```json
{
  "pr": 42,
  "head_sha": "4e7d1a9...",
  "behind_by": 0,
  "labels": ["gate:browser-green", "gate:review-green", "gate:uiux-green"],
  "statuses": [{ "context": "gate/browser", "state": "success", "sha": "4e7d1a9..." }],
  "check_runs": [{ "name": "unit", "status": "completed", "conclusion": "success" }]
}
```

`statuses` is in the order they were posted. `fixtures/` holds a good PR and a set of bad ones, one per rule, plus `seeded-bad-pr.json` which breaks almost every rule at once.

## The rules

A PR may merge only if all of these hold. Report every rule that fails, not just the first.

1. Each of `gate/browser`, `gate/review` and `gate/uiux` has a status **on the head SHA**. A status posted on an older commit does not count.
2. The **latest** status per gate on the head SHA is `success`. A later `failure` overrides an earlier `success`.
3. The three labels `gate:browser-green`, `gate:review-green` and `gate:uiux-green` are present.
4. At least one CI check run exists, and every one is `completed` with a conclusion of `success`, `skipped` or `neutral`.
5. The branch is not behind `main` (`behind_by` is `0`).
6. Missing or malformed input blocks the merge. It never throws and never guesses.

Exit codes: `0` merge, `1` blocked (reasons on stderr), `2` bad usage or unreadable file.

