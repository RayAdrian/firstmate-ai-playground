-- Community reactions without sign-in (PRD §18): workflow stars and reactions.
--
-- Write path: the base tables have RLS enabled, no policies and NO grants to anon, authenticated or
-- community_writer. Every write goes through a SECURITY DEFINER function that only community_writer (the role the
-- route handler connects as) and service_role may execute. anon may execute the three read functions only, and
-- no function ever returns a client_id, so a client id is write-only.
--
-- community_writer is created NOLOGIN with no stored secret. `supabase db push` copies this file to the hosted
-- database, so nothing here may make that role usable: the local login is set only by supabase/seed.sql and
-- scripts/db/local-roles.ts, and the hosted login by the maintainer in the dashboard SQL editor (PRD §18.8 DP-1).
-- Never use `supabase db push --include-seed`: that would copy seed.sql to the hosted database.

-- ---------------------------------------------------------------------------------------------------------
-- Role
-- ---------------------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select from pg_roles where rolname = 'community_writer') then
    create role community_writer nologin noinherit;
  end if;
end
$$;
-- A role that already exists (a local `supabase db reset` keeps cluster roles) is brought back to the same state.
alter role community_writer nologin noinherit;

-- Functions in public are not executable by PUBLIC (Postgres grants EXECUTE to PUBLIC by default); each function
-- below is granted explicitly. Trigger functions do not need the caller to hold EXECUTE.
revoke execute on all functions in schema public from public;

-- ---------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------
create table public.workflow_stars (
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  client_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workflow_id, client_id)
);
create index workflow_stars_client_idx on public.workflow_stars (client_id, created_at desc);

create table public.workflow_reactions (
  workflow_id uuid not null references public.workflows (id) on delete cascade,
  client_id uuid not null,
  reaction text not null check (reaction in ('worked', 'learned', 'saved_time', 'game_changer')),
  -- Already sanitised (community_normalize_name): 1 to 40 characters, none of the stripped characters, whitespace
  -- only as single inner spaces. NULL means anonymous.
  display_name text check (
    display_name is null
    or (
      char_length(display_name) between 1 and 40
      and display_name !~ '[\u0001-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]'
      and display_name !~ '(^ )|( $)|(  )|[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]'
    )
  ),
  created_at timestamptz not null default now(),
  primary key (workflow_id, client_id, reaction)
);
create index workflow_reactions_summary_idx on public.workflow_reactions (workflow_id, reaction, created_at desc);
create index workflow_reactions_client_idx on public.workflow_reactions (client_id);

-- Per-client token bucket: 30 writes, refilling 1 every 2 seconds.
create table public.community_rate (
  client_id uuid primary key,
  tokens numeric not null,
  refilled_at timestamptz not null
);
create index community_rate_refilled_idx on public.community_rate (refilled_at);

-- Fixed-window write counters: one global row, one row per workflow.
create table public.community_budget (
  scope text primary key check (scope = 'global' or scope ~ '^workflow:[0-9a-f-]{36}$'),
  window_start timestamptz not null,
  writes integer not null
);
create index community_budget_window_idx on public.community_budget (window_start);

alter table public.workflow_stars enable row level security;
alter table public.workflow_reactions enable row level security;
alter table public.community_rate enable row level security;
alter table public.community_budget enable row level security;

-- Supabase's default privileges give anon and authenticated TRUNCATE and friends on new tables: remove all of it.
revoke all on public.workflow_stars, public.workflow_reactions, public.community_rate, public.community_budget
  from public, anon, authenticated, community_writer;
grant all on public.workflow_stars, public.workflow_reactions, public.community_rate, public.community_budget
  to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Internal helpers (owner only: not executable by anon, authenticated, community_writer or service_role)
-- Errors carry a stable message and SQLSTATE: CM001 workflow_unavailable, CM002 rate_limited, CM003 invalid input.
-- ---------------------------------------------------------------------------------------------------------

-- The display-name rule (CM-4). Mirrors normalizeDisplayName in src/lib/contracts/community.ts; both run over
-- tests/unit/r0/name-vectors.json. Strip control, bidi and zero-width characters, collapse whitespace, trim,
-- empty becomes NULL, more than 40 characters is invalid.
create function public.community_normalize_name(p_name text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          p_name,
          '[\u0001-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]',
          '',
          'g'
        ),
        '[ \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+',
        ' ',
        'g'
      ),
      ' '
    ),
    ''
  );
  if v_name is not null and char_length(v_name) > 40 then
    raise exception 'invalid_name' using errcode = 'CM003';
  end if;
  return v_name;
end
$$;

-- client_id must be a UUID v4 (what the browser generates).
create function public.community_uuid(p_value text)
returns uuid
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_value is null or p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid_client_id' using errcode = 'CM003';
  end if;
  return p_value::uuid;
end
$$;

-- The workflow a write may touch: it exists, is not removed, and is not Archived (verified at most 180 days
-- before today's Asia/Manila date, matching WF-40). The database ignores the app's test clock.
create function public.community_resolve(p_slug text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select w.id into v_id
  from public.workflows w
  where w.slug = p_slug
    and w.removed_at is null
    and w.verified_on >= ((now() at time zone 'Asia/Manila')::date - 180);
  if v_id is null then
    raise exception 'workflow_unavailable' using errcode = 'CM001';
  end if;
  return v_id;
end
$$;

-- One fixed-window counter: at most p_limit writes per minute for the scope.
create function public.community_charge_budget(p_scope text, p_limit integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_writes integer;
begin
  insert into public.community_budget as b (scope, window_start, writes)
  values (p_scope, v_now, 1)
  on conflict (scope) do update set
    window_start = case when b.window_start <= v_now - interval '1 minute' then v_now else b.window_start end,
    writes = case when b.window_start <= v_now - interval '1 minute' then 1 else b.writes + 1 end
  where b.window_start <= v_now - interval '1 minute' or b.writes < p_limit
  returning b.writes into v_writes;
  if v_writes is null then
    raise exception 'rate_limited' using errcode = 'CM002';
  end if;
end
$$;

-- All three write budgets, in one transaction with the write. Order: global, the workflow's (not for a rename),
-- then the client's bucket. Any empty budget raises rate_limited and the whole call rolls back.
create function public.community_charge(p_workflow uuid, p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_tokens numeric;
begin
  -- The global row serialises every write, so the pruning below cannot race another writer's upsert.
  perform public.community_charge_budget('global', 300);

  -- Growth is bounded: a full bucket refills in 60s, so a row idle for 10 minutes carries no information;
  -- a workflow counter from a past window is the same as no counter.
  delete from public.community_rate where refilled_at < v_now - interval '10 minutes';
  delete from public.community_budget where scope <> 'global' and window_start < v_now - interval '1 minute';

  if p_workflow is not null then
    perform public.community_charge_budget('workflow:' || p_workflow::text, 60);
  end if;

  insert into public.community_rate as r (client_id, tokens, refilled_at)
  values (p_client, 29, v_now)
  on conflict (client_id) do update set
    tokens = least(30, r.tokens + greatest(0, extract(epoch from (v_now - r.refilled_at))) * 0.5) - 1,
    refilled_at = v_now
  where least(30, r.tokens + greatest(0, extract(epoch from (v_now - r.refilled_at))) * 0.5) >= 1
  returning r.tokens into v_tokens;
  if v_tokens is null then
    raise exception 'rate_limited' using errcode = 'CM002';
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Write functions: SECURITY DEFINER, executable only by community_writer and service_role.
-- Desired-state and idempotent. They return nothing, so a caller cannot learn whether a client_id exists.
-- ---------------------------------------------------------------------------------------------------------
create function public.community_set_star(p_slug text, p_client_id text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := public.community_uuid(p_client_id);
  v_workflow uuid;
begin
  if p_on is null then
    raise exception 'invalid_on' using errcode = 'CM003';
  end if;
  v_workflow := public.community_resolve(p_slug);
  perform public.community_charge(v_workflow, v_client);
  if p_on then
    insert into public.workflow_stars (workflow_id, client_id)
    values (v_workflow, v_client)
    on conflict do nothing;
  else
    delete from public.workflow_stars where workflow_id = v_workflow and client_id = v_client;
  end if;
end
$$;

create function public.community_set_reaction(
  p_slug text,
  p_client_id text,
  p_reaction text,
  p_on boolean,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := public.community_uuid(p_client_id);
  v_workflow uuid;
  v_name text;
begin
  if p_on is null then
    raise exception 'invalid_on' using errcode = 'CM003';
  end if;
  if p_reaction is null or p_reaction not in ('worked', 'learned', 'saved_time', 'game_changer') then
    raise exception 'invalid_reaction' using errcode = 'CM003';
  end if;
  if p_on then
    v_name := public.community_normalize_name(p_display_name);
  end if;
  v_workflow := public.community_resolve(p_slug);
  perform public.community_charge(v_workflow, v_client);
  if p_on then
    -- An existing reaction keeps its name: renames go through community_set_name.
    insert into public.workflow_reactions (workflow_id, client_id, reaction, display_name)
    values (v_workflow, v_client, p_reaction, v_name)
    on conflict do nothing;
  else
    delete from public.workflow_reactions
    where workflow_id = v_workflow and client_id = v_client and reaction = p_reaction;
  end if;
end
$$;

-- Renames (or, with an empty name, anonymises) every reaction row of this client.
create function public.community_set_name(p_client_id text, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := public.community_uuid(p_client_id);
  v_name text := public.community_normalize_name(p_display_name);
begin
  perform public.community_charge(null, v_client);
  update public.workflow_reactions set display_name = v_name where client_id = v_client;
end
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Read functions: SECURITY DEFINER, executable by anon (and service_role). Counts, the most recent names and
-- the caller's own booleans. Never a client_id. Not rate limited.
-- ---------------------------------------------------------------------------------------------------------

-- Per slug (up to 100; removed workflows are left out, archived ones keep their counts): the star count, and per
-- reaction the count and the 2 most recent non-null names.
create function public.community_summary(p_slugs text[])
returns table (slug text, stars integer, reactions jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_slugs is null then
    return;
  end if;
  if cardinality(p_slugs) > 100 then
    raise exception 'too_many_slugs' using errcode = 'CM003';
  end if;
  return query
  with ws as (
    select w.id, w.slug from public.workflows w where w.slug = any (p_slugs) and w.removed_at is null
  ),
  rc as (
    select
      r.workflow_id,
      r.reaction,
      count(*)::integer as cnt,
      (array_agg(r.display_name order by r.created_at desc) filter (where r.display_name is not null))[1:2] as names
    from public.workflow_reactions r
    join ws on ws.id = r.workflow_id
    group by r.workflow_id, r.reaction
  )
  select
    ws.slug,
    (select count(*)::integer from public.workflow_stars s where s.workflow_id = ws.id),
    (
      select jsonb_object_agg(
        k.key,
        jsonb_build_object('count', coalesce(rc.cnt, 0), 'names', to_jsonb(coalesce(rc.names, array[]::text[])))
      )
      from (values ('worked'), ('learned'), ('saved_time'), ('game_changer')) as k (key)
      left join rc on rc.workflow_id = ws.id and rc.reaction = k.key
    )
  from ws;
end
$$;

-- Whether this client starred each slug, and which reactions it chose.
create function public.community_mine(p_client_id text, p_slugs text[])
returns table (slug text, starred boolean, reactions text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_client uuid := public.community_uuid(p_client_id);
begin
  if p_slugs is null then
    return;
  end if;
  if cardinality(p_slugs) > 100 then
    raise exception 'too_many_slugs' using errcode = 'CM003';
  end if;
  return query
  select
    w.slug,
    exists (select 1 from public.workflow_stars s where s.workflow_id = w.id and s.client_id = v_client),
    coalesce(
      (select array_agg(r.reaction order by r.reaction)
       from public.workflow_reactions r
       where r.workflow_id = w.id and r.client_id = v_client),
      array[]::text[]
    )
  from public.workflows w
  where w.slug = any (p_slugs) and w.removed_at is null;
end
$$;

-- The slugs this client starred, newest first (at most 200). `removed` workflows show as no longer available.
create function public.community_my_stars(p_client_id text)
returns table (slug text, removed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_client uuid := public.community_uuid(p_client_id);
begin
  return query
  select w.slug, (w.removed_at is not null)
  from public.workflow_stars s
  join public.workflows w on w.id = s.workflow_id
  where s.client_id = v_client
  order by s.created_at desc
  limit 200;
end
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Grants. Supabase's default privileges grant EXECUTE on new functions to anon, authenticated and service_role,
-- so everything is revoked explicitly first.
-- ---------------------------------------------------------------------------------------------------------
revoke all on function public.community_normalize_name(text) from public, anon, authenticated, service_role;
revoke all on function public.community_uuid(text) from public, anon, authenticated, service_role;
revoke all on function public.community_resolve(text) from public, anon, authenticated, service_role;
revoke all on function public.community_charge_budget(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.community_charge(uuid, uuid) from public, anon, authenticated, service_role;

revoke all on function public.community_set_star(text, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.community_set_reaction(text, text, text, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.community_set_name(text, text) from public, anon, authenticated, service_role;
revoke all on function public.community_summary(text[]) from public, anon, authenticated, service_role;
revoke all on function public.community_mine(text, text[]) from public, anon, authenticated, service_role;
revoke all on function public.community_my_stars(text) from public, anon, authenticated, service_role;

grant usage on schema public to community_writer;
grant execute on function public.community_set_star(text, text, boolean) to community_writer, service_role;
grant execute on function public.community_set_reaction(text, text, text, boolean, text) to community_writer, service_role;
grant execute on function public.community_set_name(text, text) to community_writer, service_role;

grant execute on function public.community_summary(text[]) to anon, service_role;
grant execute on function public.community_mine(text, text[]) to anon, service_role;
grant execute on function public.community_my_stars(text) to anon, service_role;
