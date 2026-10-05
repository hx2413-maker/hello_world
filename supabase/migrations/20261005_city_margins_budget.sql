-- Apply after 20261005_city_margins.sql. Bound total provider usage on a public
-- app to 100 generation attempts per UTC day, in addition to five per account.
begin;

-- Readers can continue; serialize initialization with existing request writes.
lock table public.generation_requests in share row exclusive mode;

create table if not exists public.daily_generation_budget (
  quota_day date primary key,
  used_attempts integer not null check (used_attempts between 0 and 100)
);
alter table public.daily_generation_budget enable row level security;
revoke all on public.daily_generation_budget from public, anon, authenticated;
-- No client policies: this bookkeeping table is accessible only to trusted SQL.

-- Preserve historical usage on reruns and after an account/request is deleted.
insert into public.daily_generation_budget as budget (quota_day, used_attempts)
  select quota_day, least(count(*), 100)::integer
  from public.generation_requests group by quota_day
  on conflict (quota_day) do update
    set used_attempts = greatest(budget.used_attempts, excluded.used_attempts);

create or replace function public.enforce_generation_budget()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved_attempt integer;
begin
  -- ON CONFLICT locks the shared day row and evaluates the current count after
  -- concurrent writers finish. Failed request inserts roll back this increment.
  insert into public.daily_generation_budget as budget (quota_day, used_attempts)
    values (new.quota_day, 1)
    on conflict (quota_day) do update
      set used_attempts = budget.used_attempts + 1
      where budget.used_attempts < 100
    returning used_attempts into reserved_attempt;
  if not found then
    raise exception 'Daily studio limit reached.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_generation_budget() from public, anon, authenticated, service_role;
drop trigger if exists enforce_generation_budget on public.generation_requests;
create trigger enforce_generation_budget
  before insert on public.generation_requests
  for each row execute function public.enforce_generation_budget();

notify pgrst, 'reload schema';
commit;
