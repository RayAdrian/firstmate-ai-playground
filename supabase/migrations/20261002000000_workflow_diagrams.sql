-- Diagrams for workflows (PRD §17.3). Both columns are optional frontmatter fields, stored parsed.
alter table public.workflows
  add column diagram jsonb,  -- a validated diagram object (src/lib/contracts/diagram.ts), or null
  add column watch text;     -- "<lesson-slug>/<media-id>", or null
