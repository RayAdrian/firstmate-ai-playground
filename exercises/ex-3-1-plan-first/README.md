# ex-3-1: Plan first

A tiny Node API serves `GET /items` (45 in-memory items). Add pagination. The point of the exercise is the plan, not the code.

## The spec

- `GET /items` with no query behaves exactly as today: 200 and a bare JSON array of all 45 items.
- Pagination switches on when `limit` is sent. `limit` is an integer from 1 to 100. `page` is an integer >= 1 and defaults to 1.
- The body stays a bare array. Totals go in headers: `X-Total-Count` (all items) and `X-Total-Pages`.
- Invalid `limit` or `page`, or `page` without `limit`: 400 and `{ "error": "<message>" }`.
- A page past the end: 200 and `[]`.

`tests/pagination.test.js` encodes this. Treat it as read-only.

## Setup

```bash
cp -r exercises/ex-3-1-plan-first/starter ~/fm-ex/ex-3-1-plan-first
cd ~/fm-ex/ex-3-1-plan-first
git init -q && git add -A && git commit -qm starter
```

## Steps

1. **Plan (no code).** Use plan mode in Claude Code (`/plan`) or `/plan` in Codex. Ask for these sections: Goal (with out of scope), Files to change, Steps, Risks and open questions, Verification.
2. **Critique.** Read the plan against `CHECKLIST.md`. Find at least one thing to change: a missed risk, a vague step, a wrong assumption. Send it back or edit it directly (Claude Code: `Ctrl+G`).
3. **Save and commit `PLAN.md`** in the project root. `git add PLAN.md && git commit -m "Plan: paginate GET /items"`. No code changes in this commit.
4. **Implement.** Tell the agent to follow `PLAN.md` and to stop and ask if a step doesn't fit.
5. **Verify.** Run `npm test`. Then compare the diff with the plan: did it touch any file the plan didn't name?

## Verify

```bash
npm test
```

On the starter it fails: `PLAN.md` is missing and the pagination tests are red. It passes when `PLAN.md` has the five sections and pagination works. The test on `PLAN.md` only checks its structure. Whether the plan is good is what the checklist is for.

## Reference

`solution/` has a `PLAN.md` and the implementation. Look at it after you've finished.
