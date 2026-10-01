# First Mate AI Playground

An internal playground for learning Claude Code and Codex CLI, from your first agent session to gated multi-agent pipelines, plus a daily AI news digest scored for its relevance to First Mate.

- **Curriculum:** 5 levels, 18 lessons and 18 hands-on exercises. Each lesson shows Claude Code and Codex CLI side by side.
- **News:** a daily digest of model, tooling and framework news, each item with a "why it matters for First Mate" note.

## Quick start (engineers)

You need Node 20+, Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone https://github.com/RayAdrian/firstmate-ai-playground.git
cd firstmate-ai-playground
npm ci
supabase start                      # local Postgres on ports 544xx
cp .env.example .env.local          # fill from: supabase status -o env (API_URL, ANON_KEY, SERVICE_ROLE_KEY)
npm run seed                        # load the curriculum
npm run news:import                 # load the latest news digests from the news-snapshots branch
npm run dev                         # http://localhost:3000
```

Re-run `npm run news:import` any time to pull newer digests. Progress is saved in your browser; export or import it at `/progress`.

Exercises live in `exercises/`. Each lesson's exercise panel has a one-line setup command that copies the starter into `~/fm-ex/<exercise>`.

## Daily news job (maintainer Mac only)

One Mac runs the scoring job; everyone else imports its snapshots.

- `npm run news:run`: fetch, dedupe and score now (uses `claude -p` with no tools).
- `npm run news:schedule:install -- --dry-run`: preview the LaunchAgent. Drop `--dry-run` to install. It runs hourly and acts once a day after 08:00 Asia/Manila, then publishes to the `news-snapshots` branch.
- `npm run news:schedule:uninstall`: remove it. Logs are in `~/Library/Logs/fm-playground/news.log`.

## Contributing

Read `AGENTS.md` (also loaded as `CLAUDE.md`). Every change lands through a PR that needs three green gates on its exact head commit: browser e2e, code review and UI/UX review. The spec is [docs/PRD.md](docs/PRD.md) and the design system is [docs/design/DESIGN.md](docs/design/DESIGN.md).

Note: `npm run e2e` and `npm run db:reset:test` reset your local DB to test fixtures. Run `npm run seed && npm run news:import` afterwards to get your real data back.
