-- Lesson TL;DR (PRD §19.4). Validated by lessonTldrSchema in the seed; null until a lesson is seeded with one.
-- The existing table-level select grant to anon/authenticated covers the new column; RLS does not change.
alter table public.lessons add column tldr jsonb;
