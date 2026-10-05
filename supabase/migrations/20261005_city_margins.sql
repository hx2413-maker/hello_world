-- Assignment 4: run after schema.sql and 20260929_profiles.sql as postgres.
-- Safe to rerun. User prompts remain private; only completed captions are public.
begin;

create table if not exists public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scene text not null check (char_length(btrim(scene)) between 10 and 280),
  vibe text not null check (vibe in ('witty', 'poetic', 'deadpan')),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 2000),
  system_prompt text not null check (char_length(btrim(system_prompt)) between 1 and 4000),
  model text not null check (char_length(btrim(model)) between 1 and 100),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  -- A unique slot is a second, declarative guarantee of at most five attempts
  -- per UTC day, including under stricter transaction isolation levels.
  quota_day date not null,
  daily_slot smallint not null check (daily_slot between 1 and 5),
  input_tokens integer check (input_tokens between 0 and 1000000),
  output_tokens integer check (output_tokens between 0 and 1000000),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, quota_day, daily_slot),
  check ((status = 'pending') = (completed_at is null))
);

create index if not exists generation_requests_user_created_idx
  on public.generation_requests (user_id, created_at desc);

create table if not exists public.captions (
  -- One public caption per private request; IDs are identical for owner lookup.
  id uuid primary key references public.generation_requests (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 320),
  vibe text not null check (vibe in ('witty', 'poetic', 'deadpan')),
  created_at timestamptz not null default now()
);

create index if not exists captions_created_idx
  on public.captions (created_at desc, id desc);

create table if not exists public.votes (
  caption_id uuid not null references public.captions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, caption_id)
);

create index if not exists votes_caption_idx on public.votes (caption_id);

-- Secure every application table already present in public. Supabase-managed
-- auth/storage schemas and extension-owned relations are not altered here.
do $$
declare
  app_table record;
begin
  for app_table in
    select n.nspname, c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_class'::regclass
          and d.objid = c.oid and d.deptype = 'e'
      )
  loop
    execute format('alter table %I.%I enable row level security', app_table.nspname, app_table.relname);
  end loop;
end;
$$;

-- Replace policies on the five app-owned tables so a previous permissive policy
-- cannot silently widen these policies (Postgres combines them with OR).
do $$
declare
  old_policy record;
begin
  for old_policy in
    select schemaname, tablename, policyname from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('books', 'profiles', 'generation_requests', 'captions', 'votes')
  loop
    execute format('drop policy %I on %I.%I', old_policy.policyname, old_policy.schemaname, old_policy.tablename);
  end loop;
end;
$$;

revoke all on public.books, public.profiles, public.generation_requests,
  public.captions, public.votes from public, anon, authenticated;

grant select on public.books to anon, authenticated;
create policy "Anyone can read books" on public.books
  for select to anon, authenticated using (true);

grant select on public.profiles to authenticated;
grant update (first_name, last_name, avatar_path) on public.profiles to authenticated;
create policy "Users can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select on public.generation_requests to authenticated;
create policy "Users can read their own generation requests" on public.generation_requests
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.captions to anon, authenticated;
create policy "Anyone can read completed captions" on public.captions
  for select to anon, authenticated using (true);

grant select, delete on public.votes to authenticated;
grant insert (caption_id, user_id, value) on public.votes to authenticated;
grant update (value) on public.votes to authenticated;
create policy "Users can read their own votes" on public.votes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own votes" on public.votes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own votes" on public.votes
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own votes" on public.votes
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.reserve_generation(
  p_scene text,
  p_vibe text,
  p_prompt text,
  p_system_prompt text,
  p_model text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  request_id uuid;
  reserved_at timestamptz;
  reserved_day date;
  next_slot integer;
begin
  if requester is null then
    raise exception 'Sign in before generating a caption.' using errcode = '42501';
  end if;

  if p_scene is null or char_length(btrim(p_scene)) not between 10 and 280
    or p_vibe is null or p_vibe not in ('witty', 'poetic', 'deadpan')
    or p_prompt is null or char_length(btrim(p_prompt)) not between 1 and 2000
    or p_system_prompt is null or char_length(btrim(p_system_prompt)) not between 1 and 4000
    or p_model is null or char_length(btrim(p_model)) not between 1 and 100 then
    raise exception 'Invalid generation input.' using errcode = '22023';
  end if;

  -- Concurrent requests from one account serialize before checking the quota.
  -- Failed attempts still count: no client can reset its budget by deleting rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requester::text, 914275));
  reserved_at := clock_timestamp();
  reserved_day := (reserved_at at time zone 'UTC')::date;
  select coalesce(max(r.daily_slot), 0) + 1 into next_slot
    from public.generation_requests r
    where r.user_id = requester and r.quota_day = reserved_day;

  if next_slot > 5 then
    raise exception 'Daily generation limit reached.' using errcode = 'P0001';
  end if;

  insert into public.generation_requests (
    user_id, scene, vibe, prompt, system_prompt, model, quota_day, daily_slot, created_at
  ) values (
    requester, btrim(p_scene), p_vibe, p_prompt, p_system_prompt, p_model,
    reserved_day, next_slot, reserved_at
  ) returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.complete_generation(
  p_request_id uuid,
  p_caption text,
  p_input_tokens integer default null,
  p_output_tokens integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.generation_requests%rowtype;
begin
  if p_caption is null or char_length(btrim(p_caption)) not between 1 and 320
    or p_input_tokens < 0 or p_input_tokens > 1000000
    or p_output_tokens < 0 or p_output_tokens > 1000000 then
    raise exception 'Invalid generated caption.' using errcode = '22023';
  end if;

  select * into request_row from public.generation_requests
    where id = p_request_id for update;
  if not found then
    raise exception 'Generation request not found.' using errcode = 'P0002';
  end if;
  if request_row.status = 'completed' then
    return request_row.id;
  end if;
  if request_row.status <> 'pending' then
    raise exception 'This generation is no longer pending.' using errcode = '55000';
  end if;

  insert into public.captions (id, body, vibe)
    values (request_row.id, btrim(p_caption), request_row.vibe);
  update public.generation_requests set
    status = 'completed', completed_at = clock_timestamp(),
    input_tokens = p_input_tokens, output_tokens = p_output_tokens
    where id = request_row.id;
  return request_row.id;
end;
$$;

create or replace function public.fail_generation(p_request_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.generation_requests
    set status = 'failed', completed_at = clock_timestamp()
    where id = p_request_id and status = 'pending';
$$;

create or replace function public.cast_vote(p_caption_id uuid, p_value smallint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  voter uuid := auth.uid();
begin
  if voter is null then
    raise exception 'Sign in before voting.' using errcode = '42501';
  end if;
  if p_value is null or p_value not in (-1, 0, 1) then
    raise exception 'Choose an upvote, downvote, or remove your vote.' using errcode = '22023';
  end if;
  if p_value = 0 then
    delete from public.votes where user_id = voter and caption_id = p_caption_id;
  else
    insert into public.votes (caption_id, user_id, value)
      values (p_caption_id, voter, p_value)
      on conflict (user_id, caption_id) do update set value = excluded.value;
  end if;
end;
$$;

-- Aggregate ratings intentionally cross the votes RLS boundary. This function
-- exposes counts and the current viewer's vote, never other voters' identities,
-- profiles, request owners, scenes, prompts, or model usage.
create or replace function public.get_caption_feed(
  p_sort text default 'new',
  p_limit integer default 30,
  p_offset integer default 0,
  p_caption_id uuid default null
)
returns table (
  id uuid,
  body text,
  vibe text,
  created_at timestamptz,
  upvotes bigint,
  downvotes bigint,
  score bigint,
  viewer_vote smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.body, c.vibe, c.created_at,
    count(v.value) filter (where v.value = 1) as upvotes,
    count(v.value) filter (where v.value = -1) as downvotes,
    coalesce(sum(v.value), 0)::bigint as score,
    max(v.value) filter (where v.user_id = (select auth.uid()))::smallint as viewer_vote
  from public.captions c
  left join public.votes v on v.caption_id = c.id
  where p_caption_id is null or c.id = p_caption_id
  group by c.id
  order by
    case when p_sort = 'top' then coalesce(sum(v.value), 0) end desc,
    c.created_at desc, c.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 30))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- Functions receive PUBLIC execution by default: revoke it explicitly. Only a
-- server-side service-role client can publish provider output or mark failure.
revoke all on function public.reserve_generation(text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.complete_generation(uuid, text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.fail_generation(uuid) from public, anon, authenticated, service_role;
revoke all on function public.cast_vote(uuid, smallint) from public, anon, authenticated, service_role;
revoke all on function public.get_caption_feed(text, integer, integer, uuid) from public, anon, authenticated, service_role;
grant execute on function public.reserve_generation(text, text, text, text, text) to authenticated;
grant execute on function public.complete_generation(uuid, text, integer, integer) to service_role;
grant execute on function public.fail_generation(uuid) to service_role;
grant execute on function public.cast_vote(uuid, smallint) to authenticated;
grant execute on function public.get_caption_feed(text, integer, integer, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
