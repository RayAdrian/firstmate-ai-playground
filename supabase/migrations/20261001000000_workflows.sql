-- Shared workflows (PRD §16.8). Mirrors `lessons`: anon/authenticated SELECT only; writes by the
-- service-role seed. No freshness column (derived from verified_on) and no client_safe column.

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  title text not null,
  problem text not null,
  tools text[] not null
    check (cardinality(tools) >= 1 and tools <@ array['claude-code', 'codex']::text[]),
  setup jsonb not null default '[]'::jsonb,   -- [{ path, kind, lang, tool|null, code }]
  setup_kinds text[] not null default '{}',   -- distinct kinds, for filtering; empty = prompt only
  prompt jsonb not null default '{}'::jsonb,  -- { shared?, claude?, codex? } markdown
  result_before text not null,
  result_after text not null,
  steps text[] not null check (cardinality(steps) between 1 and 5),
  why_md text not null,
  use_cases text[] not null default '{}',
  stacks text[] not null default '{}',
  related_lesson_slug text,                   -- validated at seed; no FK, so archiving a lesson never blocks a seed
  level int check (level is null or level between 1 and 5), -- copied from the related lesson at seed time
  tool_versions jsonb not null default '{}'::jsonb,
  verified_on date not null,
  author_name text not null,
  reviewed_on date,
  content_hash text not null default '',
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflows_tools_idx on public.workflows using gin (tools);
create index workflows_use_cases_idx on public.workflows using gin (use_cases);
create index workflows_stacks_idx on public.workflows using gin (stacks);
create index workflows_related_lesson_idx on public.workflows (related_lesson_slug);
create index workflows_verified_on_idx on public.workflows (verified_on desc);

alter table public.workflows enable row level security;
revoke all on public.workflows from anon, authenticated;
grant select on public.workflows to anon, authenticated;
grant all on public.workflows to service_role;
create policy workflows_read on public.workflows for select to anon, authenticated using (true);
