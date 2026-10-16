-- Public author pages expose only chosen identity and published-meme totals.
-- Deletion removes a publication, never its generation/quota audit record.
begin;

-- Definer implementations stay outside the Data API's exposed public schema.
-- USAGE permits the invoker wrappers to call exactly the granted helpers; it
-- gives no table access, CREATE privilege, or access to revoked trigger helpers.
grant usage on schema city_margins_private to anon, authenticated;

create or replace function city_margins_private.read_public_member(p_user_id uuid)
returns table (
  id uuid, display_name text, avatar_path text, updated_at timestamptz,
  meme_count bigint, total_upvotes bigint, is_owner boolean
)
language sql stable security definer set search_path = ''
as $$
  select p_user_id, coalesce(p.display_name, 'Community member'),
    p.avatar_path, p.updated_at,
    (select count(*) from public.captions c
      join public.generation_requests r on r.id = c.id
      where r.user_id = p_user_id and not c.is_starter),
    (select count(*) from public.votes v
      join public.captions c on c.id = v.caption_id
      join public.generation_requests r on r.id = c.id
      where r.user_id = p_user_id and not c.is_starter and v.value = 1),
    coalesce(p_user_id = (select auth.uid()), false)
  from (select p_user_id as id) requested
  left join public.member_profiles p on p.id = requested.id
  where p_user_id is not null and (
    p.id is not null
    or p_user_id = (select auth.uid())
    or exists (
      -- Every real member has an empty profile before their first publication
      -- and after their last is deleted. This exact-ID existence check returns
      -- no auth fields or account list. Starter accounts have no author page.
      select 1 from auth.users u
      where u.id = p_user_id
        and not coalesce(u.raw_app_meta_data @> '{"city_margins_starter": true}'::jsonb, false)
    )
  );
$$;
revoke all on function city_margins_private.read_public_member(uuid)
  from public, anon, authenticated, service_role;
grant execute on function city_margins_private.read_public_member(uuid) to anon, authenticated;

create or replace function public.get_public_member(p_user_id uuid)
returns table (
  id uuid, display_name text, avatar_path text, updated_at timestamptz,
  meme_count bigint, total_upvotes bigint, is_owner boolean
)
language sql stable security invoker set search_path = ''
as $$ select * from city_margins_private.read_public_member(p_user_id); $$;
revoke all on function public.get_public_member(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_member(uuid) to anon, authenticated;

-- A configured profile is now public even before its first meme. Read access
-- is limited to its currently selected fixed avatar path; writes remain owner-
-- only, and the direct member_profiles table remains private under RLS.
create or replace function city_margins_private.is_published_member_avatar(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.member_profiles p where p.avatar_path = p_path);
$$;
revoke all on function city_margins_private.is_published_member_avatar(text)
  from public, anon, authenticated, service_role;
grant execute on function city_margins_private.is_published_member_avatar(text) to anon, authenticated;

create or replace function city_margins_private.read_caption_feed(
  p_sort text, p_limit integer, p_offset integer,
  p_caption_id uuid, p_author_id uuid
)
returns table (
  id uuid, body text, vibe text, created_at timestamptz,
  upvotes bigint, downvotes bigint, score bigint, viewer_vote smallint,
  is_starter boolean, is_owner boolean, image_path text,
  author_name text, author_avatar_path text, author_updated_at timestamptz,
  author_id uuid
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.body, c.vibe, c.created_at,
    count(v.value) filter (where v.value = 1),
    count(v.value) filter (where v.value = -1),
    coalesce(sum(v.value), 0)::bigint,
    max(v.value) filter (where v.user_id = (select auth.uid()))::smallint,
    c.is_starter, coalesce(r.user_id = (select auth.uid()), false),
    c.image_path, p.display_name, p.avatar_path, p.updated_at,
    case when c.is_starter then null else r.user_id end
  from public.captions c
  join public.generation_requests r on r.id = c.id
  left join public.votes v on v.caption_id = c.id
  left join public.member_profiles p on p.id = r.user_id and not c.is_starter
  where (p_caption_id is null or c.id = p_caption_id)
    and (p_author_id is null or (r.user_id = p_author_id and not c.is_starter))
  group by c.id, r.user_id, p.id
  order by case when p_sort = 'top' then coalesce(sum(v.value), 0) end desc,
    c.created_at desc, c.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 30))
  offset greatest(0, coalesce(p_offset, 0));
$$;
revoke all on function city_margins_private.read_caption_feed(text, integer, integer, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function city_margins_private.read_caption_feed(text, integer, integer, uuid, uuid)
  to anon, authenticated;

-- Dropping the old overload avoids ambiguous RPC resolution. Its existing
-- calls remain compatible because the new fifth argument defaults to null.
drop function if exists public.get_caption_feed(text, integer, integer, uuid);
create or replace function public.get_caption_feed(
  p_sort text default 'new', p_limit integer default 30,
  p_offset integer default 0, p_caption_id uuid default null,
  p_author_id uuid default null
)
returns table (
  id uuid, body text, vibe text, created_at timestamptz,
  upvotes bigint, downvotes bigint, score bigint, viewer_vote smallint,
  is_starter boolean, is_owner boolean, image_path text,
  author_name text, author_avatar_path text, author_updated_at timestamptz,
  author_id uuid
)
language sql stable security invoker set search_path = ''
as $$
  select * from city_margins_private.read_caption_feed(
    p_sort, p_limit, p_offset, p_caption_id, p_author_id
  );
$$;
revoke all on function public.get_caption_feed(text, integer, integer, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_caption_feed(text, integer, integer, uuid, uuid) to anon, authenticated;

grant delete on public.captions to authenticated;
drop policy if exists "Authors can delete their own memes" on public.captions;
create policy "Authors can delete their own memes" on public.captions
  for delete to authenticated using (
    not captions.is_starter and exists (
      select 1 from public.generation_requests r
      where r.id = captions.id and r.user_id = (select auth.uid())
    )
  );

-- Keep both the ownership/path check and the reservation lock. A completed
-- request intentionally remains after deletion, so it no longer blocks cleanup
-- once no publication references the image. Pending/failed requests still do.
create or replace function public.can_delete_meme_image(p_path text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null or p_path is null or char_length(p_path) <> 78
    or split_part(p_path, '/', 1) <> auth.uid()::text
    or p_path !~ '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$' then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_path, 2147001));
  return not exists (
      select 1 from public.generation_requests r
      where r.image_path = p_path and (r.status <> 'completed' or r.user_id <> auth.uid())
    )
    and not exists (select 1 from public.captions c where c.image_path = p_path);
end;
$$;
revoke all on function public.can_delete_meme_image(text)
  from public, anon, authenticated, service_role;
grant execute on function public.can_delete_meme_image(text) to authenticated;

notify pgrst, 'reload schema';
commit;
