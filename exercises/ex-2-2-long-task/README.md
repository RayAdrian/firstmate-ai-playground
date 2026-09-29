# ex-2-2: A three-part refactor across two sessions

Lesson: 2.2 Memory and context-window management.

## Goal
Refactor `src/report.js` into three modules over **two separate sessions**, passing state through a handoff file, without losing the constraints.

| Part | Module | Session |
|---|---|---|
| 1 | `src/parse.js` exports `parseRows(csv)` | 1 |
| 2 | `src/format.js` exports `formatMoney(cents)` | 2 |
| 3 | `src/render.js` exports `renderReport(rows)`; `report.js` becomes a thin facade | 2 |

Constraints (they must survive the session boundary):
- `generateReport(csv)` output stays byte-identical (golden file).
- Never edit anything under `test/fixtures/`.
- No new dependencies. Plain ESM, no `require()`.

## Setup
```bash
cp -r exercises/ex-2-2-long-task/starter ~/fm-ex/ex-2-2-long-task
cd ~/fm-ex/ex-2-2-long-task && git init -q && git add -A && git commit -qm base && npm i
```
`npm test` fails on the starter: the part tests need modules that do not exist yet. `test/constraints.test.js` passes and must keep passing.

## Steps
1. **Session 1.** Use the starter prompt. The agent does part 1, writes `HANDOFF.md` (`## Done`, `## Next`, `## Constraints`) and commits.
2. **Reset.** Claude Code: `/clear` (or quit and run `claude`). Codex: `/new` (or quit and run `codex`). Compare with `claude --continue` / `codex resume --last`, which bring the old context back, and decide which you want here.
3. **Session 2.** Prompt: `Read HANDOFF.md and continue with the Next section. Follow the Constraints.` Nothing else.
4. Mid-task, check context use: Claude Code `/context`, Codex `/status`.
5. Run the verify command.

## Stretch
On a scratch copy, run one long session for all three parts and use `/compact` with instructions (Claude Code: `/compact Keep the constraints and the list of finished parts`). Compare what survived with what a handoff file carries.

## Verify
```bash
npm test
```
It covers the golden output, the fixtures hash, dependencies, the three modules, the thin facade and the shape of `HANDOFF.md`. It cannot prove you used two sessions; the checklist covers that.
