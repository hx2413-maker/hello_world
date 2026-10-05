-- Apply to the existing City Margins schema before publishing starter captions.
-- Attribution is assigned atomically with publication, using admin-only metadata.
begin;

-- Also permits a fresh installation in filename order (before *_starters.sql).
alter table public.captions
  add column if not exists is_starter boolean not null default false;
revoke insert (is_starter), update (is_starter) on public.captions
  from public, anon, authenticated;

create or replace function public.set_caption_starter_attribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Auth app metadata is writable only by trusted administration. Never use
  -- raw_user_meta_data, which account holders can edit themselves.
  new.is_starter := coalesce((
    select u.raw_app_meta_data @> '{"city_margins_starter": true}'::jsonb
    from public.generation_requests r
    join auth.users u on u.id = r.user_id
    where r.id = new.id
  ), false);
  return new;
end;
$$;

revoke all on function public.set_caption_starter_attribution()
  from public, anon, authenticated, service_role;
drop trigger if exists set_caption_starter_attribution on public.captions;
create trigger set_caption_starter_attribution
  before insert on public.captions
  for each row execute function public.set_caption_starter_attribution();

-- Repair any previously published starter rows without reclassifying ordinary
-- accounts or trusting client-controlled metadata.
update public.captions c set is_starter = true
from public.generation_requests r
join auth.users u on u.id = r.user_id
where c.id = r.id and not c.is_starter
  and u.raw_app_meta_data @> '{"city_margins_starter": true}'::jsonb;

notify pgrst, 'reload schema';
commit;
