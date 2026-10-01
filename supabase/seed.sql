-- Content is loaded by `npm run seed` (scripts/seed/, owned by WS-B).
-- news_sources baseline rows live in the initial migration.

-- LOCAL ONLY (PRD 18.4). Gives the community_writer role its local login; the migration creates it NOLOGIN with no
-- stored secret. This file runs on `supabase db reset` and a fresh `supabase start`, and NEVER on `supabase db push`
-- (do not use `--include-seed` against a hosted project). `npm run db:local-roles` runs the same statement.
-- Hosted: the maintainer sets a generated secret once in the dashboard SQL editor (PRD 18.8 DP-1).
alter role community_writer with login password 'community_writer_local_only';
