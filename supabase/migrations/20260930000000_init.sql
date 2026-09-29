-- First Mate AI Playground: initial schema (PRD section 6).
-- anon = SELECT only on every table. All writes use the service-role key (scripts only).

create extension if not exists pgcrypto;

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  number int not null unique check (number between 1 and 5),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  sort int not null default 0,
  archived_at timestamptz
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete restrict,
  slug text not null unique,
  sort int not null default 0,
  title text not null,
  objective text not null default '',
  est_minutes int not null default 0 check (est_minutes >= 0),
  concept_md text not null default '',
  claude_md text,
  codex_md text,
  claude_no_equivalent boolean not null default false,
  codex_no_equivalent boolean not null default false,
  claude_workaround_md text,
  codex_workaround_md text,
  differences text[] not null check (cardinality(differences) between 1 and 5),
  tool_versions jsonb not null default '{}'::jsonb,
  last_verified_on date,
  content_hash text not null default '',
  archived_at timestamptz,
  updated_at timestamptz not null default now(),
  -- a tool body may be null only when that tool is flagged no-equivalent
  constraint lessons_claude_body check (claude_md is not null or claude_no_equivalent),
  constraint lessons_codex_body check (codex_md is not null or codex_no_equivalent),
  -- a no-equivalent tab must carry a workaround (PRD L-3)
  constraint lessons_claude_workaround check (not claude_no_equivalent or claude_workaround_md is not null),
  constraint lessons_codex_workaround check (not codex_no_equivalent or codex_workaround_md is not null)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons(id) on delete restrict,
  slug text not null unique,
  title text not null,
  goal text not null default '',
  repo_path text not null,
  setup_cmd text not null default '',
  verify_cmd text, -- null = manual verification
  starter_prompts jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  solution_notes text[] not null default '{}',
  archived_at timestamptz
);

create table public.news_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  url text not null,
  -- 'html' added for the Anthropic scraper (PRD section 14, Q3)
  type text not null check (type in ('rss', 'atom', 'html')),
  enabled boolean not null default true,
  filters jsonb not null default '{}'::jsonb
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.news_sources(id) on delete restrict,
  guid text,
  canonical_url text not null unique,
  url text not null,
  title text not null,
  author text,
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  digest_date date not null, -- derived from first_seen_at by trigger when omitted
  excerpt text,
  score int check (score is null or score between 0 and 100),
  tags text[] not null default '{}',
  why_it_matters text,
  scoring_status text not null default 'pending'
    check (scoring_status in ('pending', 'scored', 'failed', 'skipped')),
  attempts int not null default 0,
  scored_at timestamptz,
  scorer_model text
);

create function public.news_items_set_digest_date() returns trigger
language plpgsql as $$
begin
  if new.digest_date is null then
    new.digest_date := (new.first_seen_at at time zone 'Asia/Manila')::date;
  end if;
  return new;
end $$;

create trigger news_items_digest_date before insert on public.news_items
  for each row execute function public.news_items_set_digest_date();

create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text not null check (trigger in ('schedule', 'manual')),
  status text not null check (status in ('success', 'partial', 'failed')),
  fetched int not null default 0,
  new int not null default 0,
  scored int not null default 0,
  pending int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  error_summary text
);

create index news_items_digest_score_idx on public.news_items (digest_date, score desc);
create index news_items_scoring_status_idx on public.news_items (scoring_status);
create index news_items_tags_idx on public.news_items using gin (tags);
create index lessons_level_sort_idx on public.lessons (level_id, sort);

-- Row level security: anon (and authenticated) may only SELECT.
do $$
declare t text;
begin
  foreach t in array array['levels','lessons','exercises','news_sources','news_items','ingest_runs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- Baseline news sources. URLs must be re-verified by WS-E (PRD I-1).
insert into public.news_sources (slug, name, url, type, enabled, filters) values
  ('anthropic-news', 'Anthropic news', 'https://www.anthropic.com/news', 'html', true, '{}'),
  ('claude-code-releases', 'Claude Code releases', 'https://github.com/anthropics/claude-code/releases.atom', 'atom', true, '{}'),
  ('codex-cli-releases', 'Codex CLI releases', 'https://github.com/openai/codex/releases.atom', 'atom', true, '{}'),
  ('openai-news', 'OpenAI news', 'https://openai.com/news/rss.xml', 'rss', true, '{}'),
  ('deepmind-blog', 'Google DeepMind blog', 'https://deepmind.google/blog/rss.xml', 'rss', true, '{}'),
  ('hacker-news', 'Hacker News front page', 'https://hnrss.org/frontpage?points=150', 'rss', true,
    '{"keywords":["AI","LLM","Claude","OpenAI","Gemini","Next.js","React","Supabase","Postgres","TypeScript","Vercel","security","agent","MCP"]}'),
  ('simon-willison', 'Simon Willison', 'https://simonwillison.net/atom/everything/', 'atom', true, '{}'),
  ('vercel-blog', 'Vercel blog', 'https://vercel.com/atom', 'atom', true, '{}'),
  ('nextjs-blog', 'Next.js blog', 'https://nextjs.org/feed.xml', 'rss', true, '{}'),
  ('supabase-blog', 'Supabase blog', 'https://supabase.com/rss.xml', 'rss', true, '{}'),
  ('github-changelog', 'GitHub changelog', 'https://github.blog/changelog/feed/', 'rss', true, '{}')
on conflict (slug) do nothing;
