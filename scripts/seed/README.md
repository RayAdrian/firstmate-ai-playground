# Seed and content tooling (WS-B)

| Command | What |
|---|---|
| `npm run seed` | Validate `content/` and `exercises/`, then upsert into local Supabase. Idempotent. |
| `npm run seed -- --dry-run` | Validate only. No database or key needed. Use it while writing content. |
| `npm run db:reset:test [-- --variant=<name>]` | Wipe and load the E2E fixtures (see `tests/fixtures/README.md`). |
| `npm run exercises:verify [-- <slug>...]` | Run each verify command against `starter/` (must fail) and `solution/` (must pass). |
| `npm run content:stale [-- --strict]` | List lessons verified more than 60 days ago or behind the latest release seen in the news feed. |

Environment: `CONTENT_DIR` (default `content`), `EXERCISES_DIR` (default `exercises`), `FM_NOW` (ISO clock override),
`EXERCISES_VERIFY_TIMEOUT_MS` (default 300000 per command).

## Source formats

- `content/levels.yaml`: `levels: [{ number, slug, title, summary }]`.
- `content/lessons/l<n>/<anything>.md`: frontmatter per `src/lib/contracts/lesson.ts`, then `## Concept`, `## Claude Code`,
  `## Codex CLI`. The folder must be `l<level>`; the file name is free. Slugs and `sort` must be unique (sort per level).
  Unknown `## ` sections are an error. A tool flagged `claude_no_equivalent` / `codex_no_equivalent: true` uses its section
  body as the workaround text (stored in `*_workaround_md`, `*_md` becomes null). An empty tool section without the flag is an error.
  `exercise` is optional; when present it must name an `exercises/<slug>/` directory that no other lesson uses.
- `exercises/<slug>/`: `exercise.json` (strict: unknown keys are errors; `verify` is a command or exactly `"manual"`),
  `README.md`, `CHECKLIST.md`, `starter/`, `solution/`. `title` / `goal` fall back to the README `# heading` and first paragraph.
- `CHECKLIST.md` items need a stable explicit id: `- [ ] {#c1} Test is green` (also accepted: `- [ ] Test is green {#c1}` and
  `- [ ] c1: Test is green` when the id contains a digit, `-` or `_`). Ids are `[a-z0-9_-]{1,64}` and unique per exercise.

## Behaviour

- All files are validated first and every fault is reported as `file:line: field: reason`. If anything is invalid nothing is written.
- Upsert is by slug; unchanged rows (same `content_hash` / same fields) are not touched, so a second run reports `0 inserted, 0 updated`.
- Levels, lessons and exercises whose files disappeared get `archived_at`; they are never deleted. Re-adding clears it and keeps the id.
- Text is normalised (BOM removed, CRLF to LF, NFC) before hashing. Markdown is stored verbatim; rendering must sanitise.
- A missing `content/` directory is a no-op (exit 0). A missing `exercises/` counts as empty (existing exercises are archived).
- Writes go through PostgREST (no multi-statement transactions), so atomicity is "validate everything, then write". A database
  failure mid-write stops with an error; re-running converges because every step is idempotent.
