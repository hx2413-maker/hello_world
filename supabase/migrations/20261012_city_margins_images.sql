-- Additive migration: apply before deploying the standalone image-caption app.
-- Existing text-only generations and caption URLs remain valid.
begin;

alter table public.generation_requests add column if not exists image_path text;
alter table public.captions add column if not exists image_path text;
revoke insert (image_path), update (image_path) on public.generation_requests, public.captions
  from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.generation_requests'::regclass and conname = 'generation_requests_image_path_check') then
    alter table public.generation_requests add constraint generation_requests_image_path_check check (
      image_path is null or (
        char_length(image_path) = 78
        and split_part(image_path, '/', 1) = user_id::text
        and image_path ~ '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
      )
    );
  end if;
end;
$$;

create unique index if not exists generation_requests_image_path_unique_idx
  on public.generation_requests (image_path) where image_path is not null;
create index if not exists captions_image_path_idx
  on public.captions (image_path) where image_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meme-images', 'meme-images', false, 2097152, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- This helper and the reservation RPC take the same transaction lock. A DELETE
-- waiting for a reservation rechecks references after that reservation commits.
-- Storage remains managed by its API; no custom triggers/FKs alter its schema.
create or replace function public.can_delete_meme_image(p_path text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_path is null or char_length(p_path) <> 78
    or split_part(p_path, '/', 1) <> auth.uid()::text
    or p_path !~ '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$' then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_path, 2147001));
  return not exists (select 1 from public.generation_requests where image_path = p_path)
    and not exists (select 1 from public.captions where image_path = p_path);
end;
$$;
revoke all on function public.can_delete_meme_image(text) from public, anon, authenticated, service_role;
grant execute on function public.can_delete_meme_image(text) to authenticated;

drop policy if exists "Owners can upload meme images" on storage.objects;
create policy "Owners can upload meme images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'meme-images'
    and char_length(name) = 78
    and split_part(name, '/', 1) = (select auth.uid()::text)
    and name ~ '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
    and exists (
      select 1 from public.generation_requests r
      where r.image_path = name and r.user_id = (select auth.uid())
        and r.status = 'pending'
    )
  );

drop policy if exists "Owners can read unpublished meme images" on storage.objects;
create policy "Owners can read unpublished meme images" on storage.objects
  for select to authenticated using (
    bucket_id = 'meme-images'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

drop policy if exists "Anyone can read published meme images" on storage.objects;
create policy "Anyone can read published meme images" on storage.objects
  for select to anon, authenticated using (
    bucket_id = 'meme-images'
    and exists (select 1 from public.captions c where c.image_path = name)
  );

drop policy if exists "Owners can delete unreferenced meme images" on storage.objects;
create policy "Owners can delete unreferenced meme images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'meme-images' and public.can_delete_meme_image(name)
  );
-- Intentionally no UPDATE policy: uploads are immutable and upsert is forbidden.

create or replace function public.reserve_image_generation(
  p_scene text,
  p_vibe text,
  p_prompt text,
  p_system_prompt text,
  p_model text,
  p_image_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  request_id uuid;
begin
  if requester is null then
    raise exception 'Sign in before generating a caption.' using errcode = '42501';
  end if;
  if p_image_path is null or char_length(p_image_path) <> 78
    or split_part(p_image_path, '/', 1) <> requester::text
    or p_image_path !~ '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$' then
    raise exception 'Invalid image path.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_image_path, 2147001));
  if exists (select 1 from public.generation_requests where image_path = p_image_path) then
    raise exception 'Image path is already in use.' using errcode = '22023';
  end if;

  -- Reserve before uploading, so every permitted object path has already spent
  -- a per-user/global generation slot. The path and request commit atomically.
  request_id := public.reserve_generation(p_scene, p_vibe, p_prompt, p_system_prompt, p_model);
  update public.generation_requests set image_path = p_image_path
    where id = request_id and user_id = requester and status = 'pending';
  if not found then
    raise exception 'Could not attach the image.' using errcode = 'P0002';
  end if;
  return request_id;
end;
$$;
revoke all on function public.reserve_image_generation(text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_image_generation(text, text, text, text, text, text)
  to authenticated;

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
  if request_row.image_path is not null and not exists (
    select 1 from storage.objects
    where bucket_id = 'meme-images' and name = request_row.image_path
      and metadata ->> 'mimetype' = 'image/webp'
      and case when jsonb_typeof(metadata -> 'size') = 'number'
        then (metadata ->> 'size')::numeric between 1 and 2097152
        else false end
  ) then
    raise exception 'A valid uploaded WebP image is required before publication.' using errcode = '22023';
  end if;

  insert into public.captions (id, body, vibe, image_path)
    values (request_row.id, btrim(p_caption), request_row.vibe, request_row.image_path);
  update public.generation_requests set
    status = 'completed', completed_at = clock_timestamp(),
    input_tokens = p_input_tokens, output_tokens = p_output_tokens
    where id = request_row.id;
  return request_row.id;
end;
$$;
revoke all on function public.complete_generation(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_generation(uuid, text, integer, integer) to service_role;

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
  is_starter boolean, is_owner boolean, image_path text
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
    c.image_path
  from public.captions c
  join public.generation_requests r on r.id = c.id
  left join public.votes v on v.caption_id = c.id
  where p_caption_id is null or c.id = p_caption_id
  group by c.id, r.user_id
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
