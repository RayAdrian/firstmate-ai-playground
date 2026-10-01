-- Community hardening (PRD §18.4), follow-up to 20261003000000_community.sql. Fixes a search_path hole.
--
-- `set search_path = ''` does NOT stop Postgres searching the session's pg_temp schema first: any role holding
-- TEMPORARY on the database can plant `pg_temp.uuid` (a domain with a CHECK) and have it fire inside a bare `::uuid`
-- cast in a SECURITY DEFINER function, running as the function owner. Defence in depth:
--   (a) every function pins `search_path = pg_catalog, pg_temp` (pg_temp explicitly LAST) and schema-qualifies every
--       type, cast, function and table reference in its body;
--   (b) TEMPORARY is revoked from PUBLIC, anon, authenticated and community_writer, and CREATE on schema public from
--       PUBLIC, anon and authenticated (Supabase grants those by default);
--   (c) the functions and the four tables are owned by a dedicated NOLOGIN role, community_owner, that holds only the
--       privileges they need, not by postgres.

-- ---------------------------------------------------------------------------------------------------------
-- (c) dedicated owner
-- ---------------------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select from pg_roles where rolname = 'community_owner') then
    create role community_owner nologin noinherit;
  end if;
end
$$;
alter role community_owner nologin noinherit;

-- ALTER ... OWNER TO needs the migration role to be able to SET ROLE to the new owner.
grant community_owner to postgres;

-- Postgres requires the new owner to hold CREATE on the schema while ownership moves; revoked again at the end.
grant create on schema public to community_owner;
alter table public.workflow_stars owner to community_owner;
alter table public.workflow_reactions owner to community_owner;
alter table public.community_rate owner to community_owner;
alter table public.community_budget owner to community_owner;

-- Reads workflows to resolve a slug. RLS on workflows only lists anon and authenticated, so add the owner.
grant usage on schema public to community_owner;
grant select, references on public.workflows to community_owner;
create policy workflows_community_owner_read on public.workflows for select to community_owner using (true);

-- ---------------------------------------------------------------------------------------------------------
-- (b) temporary objects and schema creation
-- ---------------------------------------------------------------------------------------------------------
do $$
begin
  execute pg_catalog.format('revoke temporary on database %I from public, anon, authenticated, community_writer', pg_catalog.current_database());
  -- Roles that legitimately need temp tables keep them explicitly.
  execute pg_catalog.format('grant temporary on database %I to postgres, service_role', pg_catalog.current_database());
end
$$;
revoke create on schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- (a) functions: fixed search_path, everything qualified. CREATE OR REPLACE keeps the existing grants.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.community_normalize_name(p_name pg_catalog.text)
returns pg_catalog.text
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_name pg_catalog.text;
begin
  v_name := nullif(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
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
  if v_name is not null and pg_catalog.char_length(v_name) > 40 then
    raise exception 'invalid_name' using errcode = 'CM003';
  end if;
  return v_name;
end
$$;

create or replace function public.community_uuid(p_value pg_catalog.text)
returns pg_catalog.uuid
language plpgsql
immutable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_value is null or p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid_client_id' using errcode = 'CM003';
  end if;
  return p_value::pg_catalog.uuid;
end
$$;

create or replace function public.community_resolve(p_slug pg_catalog.text)
returns pg_catalog.uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_id pg_catalog.uuid;
begin
  select w.id into v_id
  from public.workflows w
  where w.slug = p_slug
    and w.removed_at is null
    and w.verified_on >= ((pg_catalog.now() at time zone 'Asia/Manila')::pg_catalog.date - 180);
  if v_id is null then
    raise exception 'workflow_unavailable' using errcode = 'CM001';
  end if;
  return v_id;
end
$$;

create or replace function public.community_charge_budget(p_scope pg_catalog.text, p_limit pg_catalog.int4)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_now pg_catalog.timestamptz := pg_catalog.now();
  v_writes pg_catalog.int4;
begin
  insert into public.community_budget as b (scope, window_start, writes)
  values (p_scope, v_now, 1)
  on conflict (scope) do update set
    window_start = case when b.window_start <= v_now - '1 minute'::pg_catalog.interval then v_now else b.window_start end,
    writes = case when b.window_start <= v_now - '1 minute'::pg_catalog.interval then 1 else b.writes + 1 end
  where b.window_start <= v_now - '1 minute'::pg_catalog.interval or b.writes < p_limit
  returning b.writes into v_writes;
  if v_writes is null then
    raise exception 'rate_limited' using errcode = 'CM002';
  end if;
end
$$;

create or replace function public.community_charge(p_workflow pg_catalog.uuid, p_client pg_catalog.uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_now pg_catalog.timestamptz := pg_catalog.now();
  v_tokens pg_catalog.numeric;
begin
  -- The global row serialises every write, so the pruning below cannot race another writer's upsert.
  perform public.community_charge_budget('global', 300);

  delete from public.community_rate where refilled_at < v_now - '10 minutes'::pg_catalog.interval;
  delete from public.community_budget where scope <> 'global' and window_start < v_now - '1 minute'::pg_catalog.interval;

  if p_workflow is not null then
    perform public.community_charge_budget('workflow:' operator(pg_catalog.||) p_workflow::pg_catalog.text, 60);
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

create or replace function public.community_set_star(p_slug pg_catalog.text, p_client_id pg_catalog.text, p_on pg_catalog.bool)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_client pg_catalog.uuid := public.community_uuid(p_client_id);
  v_workflow pg_catalog.uuid;
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

create or replace function public.community_set_reaction(
  p_slug pg_catalog.text,
  p_client_id pg_catalog.text,
  p_reaction pg_catalog.text,
  p_on pg_catalog.bool,
  p_display_name pg_catalog.text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_client pg_catalog.uuid := public.community_uuid(p_client_id);
  v_workflow pg_catalog.uuid;
  v_name pg_catalog.text;
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
    insert into public.workflow_reactions (workflow_id, client_id, reaction, display_name)
    values (v_workflow, v_client, p_reaction, v_name)
    on conflict do nothing;
  else
    delete from public.workflow_reactions
    where workflow_id = v_workflow and client_id = v_client and reaction = p_reaction;
  end if;
end
$$;

create or replace function public.community_set_name(p_client_id pg_catalog.text, p_display_name pg_catalog.text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_client pg_catalog.uuid := public.community_uuid(p_client_id);
  v_name pg_catalog.text := public.community_normalize_name(p_display_name);
begin
  perform public.community_charge(null, v_client);
  update public.workflow_reactions set display_name = v_name where client_id = v_client;
end
$$;

create or replace function public.community_summary(p_slugs pg_catalog.text[])
returns table (slug pg_catalog.text, stars pg_catalog.int4, reactions pg_catalog.jsonb)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_slugs is null then
    return;
  end if;
  if pg_catalog.cardinality(p_slugs) > 100 then
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
      pg_catalog.count(*)::pg_catalog.int4 as cnt,
      (pg_catalog.array_agg(r.display_name order by r.created_at desc) filter (where r.display_name is not null))[1:2] as names
    from public.workflow_reactions r
    join ws on ws.id = r.workflow_id
    group by r.workflow_id, r.reaction
  )
  select
    ws.slug,
    (select pg_catalog.count(*)::pg_catalog.int4 from public.workflow_stars s where s.workflow_id = ws.id),
    (
      select pg_catalog.jsonb_object_agg(
        k.key,
        pg_catalog.jsonb_build_object(
          'count', coalesce(rc.cnt, 0),
          'names', pg_catalog.to_jsonb(coalesce(rc.names, array[]::pg_catalog.text[]))
        )
      )
      from (values ('worked'), ('learned'), ('saved_time'), ('game_changer')) as k (key)
      left join rc on rc.workflow_id = ws.id and rc.reaction = k.key
    )
  from ws;
end
$$;

create or replace function public.community_mine(p_client_id pg_catalog.text, p_slugs pg_catalog.text[])
returns table (slug pg_catalog.text, starred pg_catalog.bool, reactions pg_catalog.text[])
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_client pg_catalog.uuid := public.community_uuid(p_client_id);
begin
  if p_slugs is null then
    return;
  end if;
  if pg_catalog.cardinality(p_slugs) > 100 then
    raise exception 'too_many_slugs' using errcode = 'CM003';
  end if;
  return query
  select
    w.slug,
    exists (select 1 from public.workflow_stars s where s.workflow_id = w.id and s.client_id = v_client),
    coalesce(
      (select pg_catalog.array_agg(r.reaction order by r.reaction)
       from public.workflow_reactions r
       where r.workflow_id = w.id and r.client_id = v_client),
      array[]::pg_catalog.text[]
    )
  from public.workflows w
  where w.slug = any (p_slugs) and w.removed_at is null;
end
$$;

create or replace function public.community_my_stars(p_client_id pg_catalog.text)
returns table (slug pg_catalog.text, removed pg_catalog.bool)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_client pg_catalog.uuid := public.community_uuid(p_client_id);
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
-- (c) ownership of the functions (after the bodies, so replacing them above never needs the new owner)
-- ---------------------------------------------------------------------------------------------------------
alter function public.community_normalize_name(pg_catalog.text) owner to community_owner;
alter function public.community_uuid(pg_catalog.text) owner to community_owner;
alter function public.community_resolve(pg_catalog.text) owner to community_owner;
alter function public.community_charge_budget(pg_catalog.text, pg_catalog.int4) owner to community_owner;
alter function public.community_charge(pg_catalog.uuid, pg_catalog.uuid) owner to community_owner;
alter function public.community_set_star(pg_catalog.text, pg_catalog.text, pg_catalog.bool) owner to community_owner;
alter function public.community_set_reaction(pg_catalog.text, pg_catalog.text, pg_catalog.text, pg_catalog.bool, pg_catalog.text) owner to community_owner;
alter function public.community_set_name(pg_catalog.text, pg_catalog.text) owner to community_owner;
alter function public.community_summary(pg_catalog.text[]) owner to community_owner;
alter function public.community_mine(pg_catalog.text, pg_catalog.text[]) owner to community_owner;
alter function public.community_my_stars(pg_catalog.text) owner to community_owner;

revoke create on schema public from community_owner;
