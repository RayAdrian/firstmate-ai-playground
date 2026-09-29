<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# First Mate AI Playground

Internal playground for learning Claude Code and Codex CLI, plus a daily AI news digest. Spec: `docs/PRD.md` (acceptance criteria IDs like L-2, P-1 refer to it).

## Stack
Next.js App Router, TypeScript strict, Tailwind, npm, local Supabase (ports 544xx, see `supabase/config.toml`), zod, Vitest, Playwright + axe. The app makes no LLM calls. No auth; progress lives in localStorage (`fm-playground:v1`).

## Commands
- `supabase start` then `npm run seed`, `npm run dev`
- `npm run typecheck | lint | test | e2e | build`
- `npm run db:reset:test` (E2E fixtures), `npm run news:run`, `npm run news:import`, `npm run exercises:verify`, `npm run content:stale`
- `npm run gate:merge -- <pr#>` merges only if the PR has all three gate labels

## Rules
- **Path ownership (PRD §11):** edit only the paths your workstream owns. `package.json`, contracts (`src/lib/contracts/`), migrations and `src/lib/db/` are frozen after M0; change them only in a dedicated M0-owned PR.
- Never import `src/lib/db/service.ts` (service-role) from `src/app` or components. The browser and app use the read-only anon client (`src/lib/db/server.ts`).
- Content routes render dynamically (content edits must show without a rebuild).
- Test-first: each P0 AC has its test in the same PR.
- Branch `ws-<letter>/<desc>` in its own git worktree; rebase on `main` before gates.

## Merge gates (PRD §12), all three required
1. `gate:browser-green`: Playwright + axe pass on fixtures; manual check at 360/768/1440px with screenshots on the PR.
2. `gate:review-green`: code-review agent, no blocking findings (incl. edits outside owned paths).
3. `gate:uiux-green`: UI/UX agent (or "N/A: no UI changes").
Never merge with `gh pr merge` directly; use `npm run gate:merge`.
