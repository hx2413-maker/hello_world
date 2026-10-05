-- Apply after the existing City Margins migrations. Labels app-created starter
-- captions and the current viewer's own work without publishing author identity.
begin;

alter table public.captions
  add column if not exists is_starter boolean not null default false;
revoke insert (is_starter), update (is_starter) on public.captions
  from public, anon, authenticated;

-- PostgreSQL requires replacing the function when its output row type changes.
-- Drop and restore its exact signature and grants in one atomic transaction.
drop function if exists public.get_caption_feed(text, integer, integer, uuid);
create function public.get_caption_feed(
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
  viewer_vote smallint,
  is_starter boolean,
  is_owner boolean
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
    c.is_starter,
    coalesce(r.user_id = (select auth.uid()), false) as is_owner
  from public.captions c
  join public.generation_requests r on r.id = c.id
  left join public.votes v on v.caption_id = c.id
  where p_caption_id is null or c.id = p_caption_id
  group by c.id, r.user_id
  order by
    case when p_sort = 'top' then coalesce(sum(v.value), 0) end desc,
    c.created_at desc, c.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 30))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.get_caption_feed(text, integer, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_caption_feed(text, integer, integer, uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';
commit;
