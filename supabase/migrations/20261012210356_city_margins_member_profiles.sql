-- Additive: keep the current meme app compatible while adding optional, user-
-- chosen public author names/avatars. No archived Reading Room data is copied.
begin;

create table if not exists public.member_profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (
    char_length(display_name) between 1 and 40
    and display_name = btrim(display_name)
    and display_name !~ '[[:cntrl:]]'
    -- Reject invisible formatting controls in addition to C0/C1 controls.
    and display_name !~ U&'[\00ad\0600-\0605\061c\06dd\070f\0890-\0891\08e2\180e\200b-\200f\202a-\202e\2060-\2064\2066-\206f\feff\fff9-\fffb\+0110bd\+0110cd\+013430-\+01343f\+01bca0-\+01bca3\+01d173-\+01d17a\+0e0001\+0e0020-\+0e007f]'
  ),
  avatar_path text check (avatar_path is null or avatar_path = id::text || '/avatar.webp'),
  updated_at timestamptz not null default clock_timestamp()
);

create unique index if not exists member_profiles_avatar_path_idx
  on public.member_profiles (avatar_path) where avatar_path is not null;

alter table public.member_profiles enable row level security;
revoke all on public.member_profiles from public, anon, authenticated, service_role;
-- New tables can inherit broad default privileges. Keep immutable identifiers
-- and timestamps out of UPDATE, and let the database supply timestamps.
revoke all (id, display_name, avatar_path, updated_at) on public.member_profiles
  from public, anon, authenticated, service_role;
grant select on public.member_profiles to authenticated;
grant insert (id, display_name, avatar_path) on public.member_profiles to authenticated;
grant update (display_name, avatar_path) on public.member_profiles to authenticated;

drop policy if exists "Members can read their own profile" on public.member_profiles;
create policy "Members can read their own profile" on public.member_profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "Members can create their own profile" on public.member_profiles;
create policy "Members can create their own profile" on public.member_profiles
  for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "Members can update their own profile" on public.member_profiles;
create policy "Members can update their own profile" on public.member_profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create schema if not exists city_margins_private;
revoke all on schema city_margins_private from public, anon, authenticated, service_role;

create or replace function city_margins_private.set_member_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Also makes cache-busting versions advance for back-to-back updates within
  -- the clock's resolution (including concurrent avatar replacements).
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function city_margins_private.set_member_profile_updated_at()
  from public, anon, authenticated, service_role;
drop trigger if exists set_member_profile_updated_at on public.member_profiles;
create trigger set_member_profile_updated_at before update on public.member_profiles
  for each row execute function city_margins_private.set_member_profile_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-avatars', 'member-avatars', false, 2097152, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- This narrow helper intentionally crosses the private profile/request RLS
-- boundary for anonymous reads. It reveals only whether this exact avatar is
-- currently selected by an author of an already-public caption. There is no
-- general profile-list endpoint; the helper is outside the exposed schema.
create or replace function city_margins_private.is_published_member_avatar(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member_profiles p
    join public.generation_requests r on r.user_id = p.id
    join public.captions c on c.id = r.id
    where p.avatar_path = p_path
  );
$$;
revoke all on function city_margins_private.is_published_member_avatar(text)
  from public, anon, authenticated, service_role;
grant execute on function city_margins_private.is_published_member_avatar(text)
  to anon, authenticated;

-- A single bounded object per member supports replacing the avatar without
-- accumulating files. Storage upsert requires INSERT, SELECT, and UPDATE.
drop policy if exists "Members can upload their own avatar" on storage.objects;
create policy "Members can upload their own avatar" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'member-avatars' and name = (select auth.uid()::text) || '/avatar.webp'
  );
drop policy if exists "Members can read their own avatar" on storage.objects;
create policy "Members can read their own avatar" on storage.objects
  for select to authenticated using (
    bucket_id = 'member-avatars' and name = (select auth.uid()::text) || '/avatar.webp'
  );
drop policy if exists "Members can replace their own avatar" on storage.objects;
create policy "Members can replace their own avatar" on storage.objects
  for update to authenticated using (
    bucket_id = 'member-avatars' and name = (select auth.uid()::text) || '/avatar.webp'
  ) with check (
    bucket_id = 'member-avatars' and name = (select auth.uid()::text) || '/avatar.webp'
  );
drop policy if exists "Members can delete their own avatar" on storage.objects;
create policy "Members can delete their own avatar" on storage.objects
  for delete to authenticated using (
    bucket_id = 'member-avatars' and name = (select auth.uid()::text) || '/avatar.webp'
  );
drop policy if exists "Anyone can read published authors avatars" on storage.objects;
create policy "Anyone can read published authors avatars" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'member-avatars'
    and city_margins_private.is_published_member_avatar(name)
  );

-- Preserve all original feed columns and ordering, then append only the chosen
-- display information. Never expose account emails, full profiles, or prompts.
drop function if exists public.get_caption_feed(text, integer, integer, uuid);
create function public.get_caption_feed(
  p_sort text default 'new',
  p_limit integer default 30,
  p_offset integer default 0,
  p_caption_id uuid default null
)
returns table (
  id uuid, body text, vibe text, created_at timestamptz,
  upvotes bigint, downvotes bigint, score bigint, viewer_vote smallint,
  is_starter boolean, is_owner boolean, image_path text,
  author_name text, author_avatar_path text, author_updated_at timestamptz
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
    max(v.value) filter (where v.user_id = (select auth.uid()))::smallint as viewer_vote,
    c.is_starter, coalesce(r.user_id = (select auth.uid()), false) as is_owner,
    c.image_path, p.display_name, p.avatar_path, p.updated_at
  from public.captions c
  join public.generation_requests r on r.id = c.id
  left join public.votes v on v.caption_id = c.id
  left join public.member_profiles p on p.id = r.user_id
  where p_caption_id is null or c.id = p_caption_id
  group by c.id, r.user_id, p.id
  order by case when p_sort = 'top' then coalesce(sum(v.value), 0) end desc,
    c.created_at desc, c.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 30))
  offset greatest(0, coalesce(p_offset, 0));
$$;
revoke all on function public.get_caption_feed(text, integer, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_caption_feed(text, integer, integer, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
