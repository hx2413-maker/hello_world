-- Shared creative styles; existing captions retain a label and prompt snapshot.
-- This migration is additive and does not change any publication or vote.
begin;

create table public.shared_tones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 40 and name !~ '[[:cntrl:]]'),
  instructions text not null check (instructions = btrim(instructions) and char_length(instructions) between 10 and 400),
  created_at timestamptz not null default now()
);
create unique index shared_tones_owner_name on public.shared_tones (user_id, lower(name));
create index shared_tones_newest on public.shared_tones (created_at desc, id);
alter table public.shared_tones enable row level security;
revoke all on public.shared_tones from public, anon, authenticated;
grant select on public.shared_tones to anon, authenticated;
grant insert (user_id, name, instructions) on public.shared_tones to authenticated;
grant delete on public.shared_tones to authenticated;
create policy "Shared tones are public" on public.shared_tones for select to anon, authenticated using (true);
create policy "Members can save their own tones" on public.shared_tones for insert to authenticated
  with check ((select auth.uid()) = user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Members can remove their own tones" on public.shared_tones for delete to authenticated
  using ((select auth.uid()) = user_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
-- No UPDATE grant: shared styles cannot change underneath another member.

create or replace function city_margins_private.limit_shared_tones()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Sign in to save your own tone.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 821719));
  if (select count(*) from public.shared_tones where user_id = new.user_id) >= 20 then
    raise exception 'Shared tone limit reached.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function city_margins_private.limit_shared_tones() from public, anon, authenticated, service_role;
create trigger limit_shared_tones before insert on public.shared_tones
  for each row execute function city_margins_private.limit_shared_tones();

alter table public.generation_requests drop constraint generation_requests_vibe_check;
alter table public.generation_requests add constraint generation_requests_vibe_check
  check (char_length(btrim(vibe)) between 2 and 40 and vibe !~ '[[:cntrl:]]');
alter table public.captions drop constraint captions_vibe_check;
alter table public.captions add constraint captions_vibe_check
  check (char_length(btrim(vibe)) between 2 and 40 and vibe !~ '[[:cntrl:]]');

-- Keep the existing reservation serialization, five-attempt user quota,
-- shared daily budget trigger, and completion idempotency. Only the tone
-- validator changes; the privileged implementation moves to a private schema.
create or replace function city_margins_private.reserve_generation(
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
  if requester is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Sign in before generating a caption.' using errcode = '42501';
  end if;

  if p_scene is null or char_length(btrim(p_scene)) not between 10 and 280
    or p_vibe is null or char_length(btrim(p_vibe)) not between 2 and 40 or p_vibe ~ '[[:cntrl:]]'
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

revoke all on function city_margins_private.reserve_generation(text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function city_margins_private.reserve_generation(text,text,text,text,text) to authenticated;
create or replace function public.reserve_generation(p_scene text, p_vibe text, p_prompt text, p_system_prompt text, p_model text)
returns uuid language sql security invoker set search_path = '' as $$
  select city_margins_private.reserve_generation(p_scene, p_vibe, p_prompt, p_system_prompt, p_model);
$$;
revoke all on function public.reserve_generation(text,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.reserve_generation(text,text,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
