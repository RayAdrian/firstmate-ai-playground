# ex-5-3-gates: a merge gate that fails closed

Build a local `gate` script that blocks a merge unless every gate passes, and test it against a seeded bad PR.

## Setup

```bash
cp -r exercises/ex-5-3-gates/starter ~/fm-ex/ex-5-3-gates && cd ~/fm-ex/ex-5-3-gates && npm i
npm test    # fails on purpose
node gate.mjs fixtures/seeded-bad-pr.json; echo "exit=$?"    # blocked, but for too few reasons
node gate.mjs fixtures/stale-sha.json; echo "exit=$?"        # wrongly exits 0
```

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

## Your job

Fix `gate.mjs` until `npm test` passes. Do not edit `tests/` or `fixtures/`. Rule 1 is the one that matters most: it is the lesson learned from this repo's own gate script, `scripts/gate-status.sh`. Ask your agent why an approval must be pinned to the reviewed commit, and check that it can explain it back to you.

Stretch (not tested): add a `--pr <number>` mode that builds the same JSON from `gh pr view` and `gh api repos/<owner>/<repo>/commits/<sha>/status`, then wire the script into a workflow.

## Verify

```bash
npm test
```
