-- Private metering for the assistant and unauthenticated practice preview.
-- No anonymous accounts, public captions, or real votes are created here.
create schema if not exists city_margins_private;
create table city_margins_private.assistant_requests (
  id uuid primary key default gen_random_uuid(),
  -- Retain spent global quota even when an account is deleted.
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index assistant_requests_user_created_idx on city_margins_private.assistant_requests(user_id, created_at);
create index assistant_requests_created_idx on city_margins_private.assistant_requests(created_at);
alter table city_margins_private.assistant_requests enable row level security;

create table city_margins_private.demo_requests (
  id uuid primary key default gen_random_uuid(),
  guest_hash text not null unique check (guest_hash ~ '^[0-9a-f]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  prompt text not null check (length(prompt) between 1 and 3000),
  system_prompt text not null check (length(system_prompt) between 1 and 12000),
  model text not null check (length(model) between 1 and 100),
  caption text check (length(caption) between 1 and 320),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now()
);
create index demo_requests_ip_created_idx on city_margins_private.demo_requests(ip_hash, created_at);
create index demo_requests_created_idx on city_margins_private.demo_requests(created_at);
alter table city_margins_private.demo_requests enable row level security;
revoke all on city_margins_private.assistant_requests, city_margins_private.demo_requests from public, anon, authenticated;
grant usage on schema city_margins_private to service_role;
grant select, insert, update on city_margins_private.assistant_requests, city_margins_private.demo_requests to service_role;

-- Invoker functions: only the server's service_role has both EXECUTE and table
-- privileges. Public callers cannot pick a different account or reset quotas.
create function public.reserve_campus_assistant(p_user_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  request_id uuid;
begin
  if p_user_id is null then raise exception 'Sign in to use the assistant.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('campus-assistant-budget', 0));
  if (select count(*) from city_margins_private.assistant_requests where created_at >= day_start and user_id = p_user_id) >= 20 then
    raise exception 'Assistant account limit reached.';
  end if;
  if (select count(*) from city_margins_private.assistant_requests where created_at >= day_start) >= 100 then
    raise exception 'Assistant shared limit reached.';
  end if;
  insert into city_margins_private.assistant_requests(user_id) values(p_user_id) returning id into request_id;
  return request_id;
end;
$$;

create function public.campus_demo_used(p_guest_hash text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from city_margins_private.demo_requests where guest_hash = p_guest_hash);
$$;

-- A cheap preflight rejects exhausted visitors before decoding their uploads.
-- reserve_campus_demo rechecks these conditions under its transaction lock.
create function public.check_campus_demo(p_guest_hash text, p_ip_hash text)
returns text language sql stable security invoker set search_path = '' as $$
  select case
    when exists(select 1 from city_margins_private.demo_requests where guest_hash = p_guest_hash) then 'Demo already used.'
    when (select count(*) from city_margins_private.demo_requests where ip_hash = p_ip_hash and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 3 then 'Demo network limit reached.'
    when (select count(*) from city_margins_private.demo_requests where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 20 then 'Demo shared limit reached.'
    else null
  end;
$$;

create function public.reserve_campus_demo(p_guest_hash text, p_ip_hash text, p_prompt text, p_system_prompt text, p_model text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  request_id uuid;
begin
  -- Serialize all reservations before checking the shared, IP and guest limits.
  perform pg_advisory_xact_lock(hashtextextended('campus-demo-budget', 0));
  if exists(select 1 from city_margins_private.demo_requests where guest_hash = p_guest_hash) then
    raise exception 'Demo already used.';
  end if;
  if (select count(*) from city_margins_private.demo_requests where created_at >= day_start and ip_hash = p_ip_hash) >= 3 then
    raise exception 'Demo network limit reached.';
  end if;
  if (select count(*) from city_margins_private.demo_requests where created_at >= day_start) >= 20 then
    raise exception 'Demo shared limit reached.';
  end if;
  insert into city_margins_private.demo_requests(guest_hash, ip_hash, prompt, system_prompt, model)
    values(p_guest_hash, p_ip_hash, p_prompt, p_system_prompt, p_model) returning id into request_id;
  return request_id;
end;
$$;

create function public.finish_campus_demo(p_request_id uuid, p_caption text)
returns void language sql security invoker set search_path = '' as $$
  update city_margins_private.demo_requests
  set caption = p_caption, status = case when p_caption is null then 'failed' else 'completed' end
  where id = p_request_id and status = 'pending';
$$;

revoke all on function public.reserve_campus_assistant(uuid), public.campus_demo_used(text), public.check_campus_demo(text, text), public.reserve_campus_demo(text, text, text, text, text), public.finish_campus_demo(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_campus_assistant(uuid), public.campus_demo_used(text), public.check_campus_demo(text, text), public.reserve_campus_demo(text, text, text, text, text), public.finish_campus_demo(uuid, text) to service_role;
