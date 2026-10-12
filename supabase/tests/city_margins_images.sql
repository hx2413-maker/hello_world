-- Disposable/local PostgreSQL or Supabase test database only. The Storage API
-- owns real file writes; these SQL-only storage rows are permission-test stubs.
-- Run after all additive migrations, before or after the legacy archive.
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

create function pg_temp.expect_sqlstate(statement text, expected text, message text)
returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement;
  exception when others then actual := sqlstate;
  end;
  if actual is distinct from expected then
    raise exception 'Assertion failed: % (expected %, got %)', message, expected, coalesce(actual, 'success');
  end if;
end;
$$;

select set_config('test.image_user_a', gen_random_uuid()::text, true);
select set_config('test.image_user_b', gen_random_uuid()::text, true);
select set_config('test.image_a', current_setting('test.image_user_a') || '/' || gen_random_uuid()::text || '.webp', true);
select set_config('test.image_unused', current_setting('test.image_user_a') || '/' || gen_random_uuid()::text || '.webp', true);
select set_config('test.image_failed', current_setting('test.image_user_a') || '/' || gen_random_uuid()::text || '.webp', true);
select set_config('test.image_unuploaded', current_setting('test.image_user_a') || '/' || gen_random_uuid()::text || '.webp', true);
select set_config('test.image_b', current_setting('test.image_user_b') || '/' || gen_random_uuid()::text || '.webp', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  (current_setting('test.image_user_a')::uuid, 'authenticated', 'authenticated', current_setting('test.image_user_a') || '@example.invalid', '{}', '{}'),
  (current_setting('test.image_user_b')::uuid, 'authenticated', 'authenticated', current_setting('test.image_user_b') || '@example.invalid', '{}', '{}');

-- Simulate an older unreferenced upload, which its owner may still clean up.
insert into storage.objects (bucket_id, name, metadata) values ('meme-images', current_setting('test.image_unused'), '{"mimetype":"image/webp","size":64}');

select pg_temp.assert_true((select not public and file_size_limit = 2097152 and allowed_mime_types = array['image/webp'] from storage.buckets where id = 'meme-images'), 'meme bucket is private and restricts API uploads to two MiB WebP');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.expect_sqlstate(
  $$insert into storage.objects (bucket_id, name, metadata) values ('meme-images', current_setting('test.image_a'), '{"mimetype":"image/webp"}')$$,
  '42501', 'anonymous uploads are rejected');
select pg_temp.expect_sqlstate(
  $$select public.reserve_image_generation('An uploaded image scene', 'witty', 'p', 's', 'model', current_setting('test.image_a'))$$,
  '42501', 'anonymous image generation is rejected');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.image_user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.image_user_a'), 'role', 'authenticated')::text, true);
select pg_temp.expect_sqlstate(
  $$insert into storage.objects (bucket_id, name, metadata) values ('meme-images', current_setting('test.image_a'), '{"mimetype":"image/webp","size":64}')$$,
  '42501', 'an unreserved upload cannot bypass generation quotas');
select pg_temp.expect_sqlstate(
  $$insert into storage.objects (bucket_id, name, metadata) values ('meme-images', current_setting('test.image_b'), '{"mimetype":"image/webp"}')$$,
  '42501', 'user cannot upload under another account');
select pg_temp.expect_sqlstate(
  $$insert into storage.objects (bucket_id, name, metadata) values ('meme-images', current_setting('test.image_user_a') || '/not-a-uuid.webp', '{"mimetype":"image/webp"}')$$,
  '42501', 'upload paths require a complete random UUID filename');
select pg_temp.expect_sqlstate(
  $$select public.reserve_image_generation('An uploaded image scene', 'witty', 'p', 's', 'model', current_setting('test.image_b'))$$,
  '22023', 'reservation cannot attach another account image');
select pg_temp.expect_sqlstate(
  $$select public.reserve_image_generation('An uploaded image scene', 'witty', 'p', 's', 'model', current_setting('test.image_a') || E'\n')$$,
  '22023', 'image path validation rejects suffixes and extra characters');

select set_config('test.image_request', public.reserve_image_generation('A student carrying a book on campus', 'witty', 'private visual prompt', 'private system direction', 'test-model', current_setting('test.image_a'))::text, true);
select set_config('test.failed_image_request', public.reserve_image_generation('A second image for a failed attempt', 'poetic', 'private visual prompt', 'private system direction', 'test-model', current_setting('test.image_failed'))::text, true);
select set_config('test.unuploaded_request', public.reserve_image_generation('An image whose upload will fail', 'deadpan', 'private visual prompt', 'private system direction', 'test-model', current_setting('test.image_unuploaded'))::text, true);
select pg_temp.expect_sqlstate(
  $$select public.reserve_image_generation('Reusing a reserved image path', 'witty', 'prompt', 'system', 'test-model', current_setting('test.image_a'))$$,
  '22023', 'each image path may be reserved only once');
insert into storage.objects (bucket_id, name, metadata) values
  ('meme-images', current_setting('test.image_a'), '{"mimetype":"image/webp","size":64}'),
  ('meme-images', current_setting('test.image_failed'), '{"mimetype":"image/webp","size":64}');
select pg_temp.assert_true((select count(*) = 3 from storage.objects where bucket_id = 'meme-images' and split_part(name, '/', 1) = current_setting('test.image_user_a')), 'owner can read their uploads before publication');
select pg_temp.assert_true((select image_path = current_setting('test.image_a') and status = 'pending' from public.generation_requests where id = current_setting('test.image_request')::uuid), 'the reserved request holds its exact upload path');
select pg_temp.assert_true((select count(*) = 3 from public.generation_requests), 'invalid and duplicate paths do not spend generation quota');
select pg_temp.expect_sqlstate(
  $$update public.generation_requests set image_path = current_setting('test.image_unused') where id = current_setting('test.image_request')::uuid$$,
  '42501', 'image cannot be swapped after reservation');
with overwritten as (
  update storage.objects set metadata = '{"mimetype":"image/webp","changed":true}' where bucket_id = 'meme-images' and name = current_setting('test.image_a') returning id
)
select pg_temp.assert_true((select count(*) = 0 from overwritten), 'uploaded objects cannot be overwritten');
with deleted as (
  delete from storage.objects where bucket_id = 'meme-images' and name = current_setting('test.image_a') returning id
)
select pg_temp.assert_true((select count(*) = 0 from deleted), 'pending generation keeps its source image');
with deleted as (
  delete from storage.objects where bucket_id = 'meme-images' and name = current_setting('test.image_unused') returning id
)
select pg_temp.assert_true((select count(*) = 1 from deleted), 'owner can clean up an unreferenced upload');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.image_user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.image_user_b'), 'role', 'authenticated')::text, true);
select pg_temp.assert_true(not exists (select 1 from storage.objects where name = current_setting('test.image_a')), 'other users cannot read an unpublished image');
with deleted as (
  delete from storage.objects where bucket_id = 'meme-images' and name = current_setting('test.image_a') returning id
)
select pg_temp.assert_true((select count(*) = 0 from deleted), 'other users cannot delete an upload');
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.assert_true(not exists (select 1 from storage.objects where name = current_setting('test.image_a')), 'anonymous readers cannot see a pending source image');
reset role;

-- Corrupt only the disposable metadata fixture to test publication validation;
-- the real Storage API owns and validates this metadata in production.
update storage.objects set metadata = '{"mimetype":"image/png","size":64}'
  where bucket_id = 'meme-images' and name = current_setting('test.image_a');
set local role service_role;
select pg_temp.expect_sqlstate(
  $$select public.complete_generation(current_setting('test.image_request')::uuid, 'Wrong media type must not publish.')$$,
  '22023', 'publication requires WebP metadata');
reset role;
update storage.objects set metadata = '{"mimetype":"image/webp","size":2097153}'
  where bucket_id = 'meme-images' and name = current_setting('test.image_a');
set local role service_role;
select pg_temp.expect_sqlstate(
  $$select public.complete_generation(current_setting('test.image_request')::uuid, 'Oversized media must not publish.')$$,
  '22023', 'publication rejects an image above two MiB');
reset role;
update storage.objects set metadata = '{"mimetype":"image/webp","size":64}'
  where bucket_id = 'meme-images' and name = current_setting('test.image_a');

set local role service_role;
select public.complete_generation(current_setting('test.image_request')::uuid, 'My backpack has a higher GPA than I do.');
select public.fail_generation(current_setting('test.failed_image_request')::uuid);
select pg_temp.expect_sqlstate(
  $$select public.complete_generation(current_setting('test.unuploaded_request')::uuid, 'A nonexistent image must never publish.')$$,
  '22023', 'publication requires the reserved image to exist');
select public.fail_generation(current_setting('test.unuploaded_request')::uuid);
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name = current_setting('test.image_a')), 'completed caption makes only its attached image publicly readable');
select pg_temp.assert_true(not exists (select 1 from storage.objects where name = current_setting('test.image_failed')), 'failed generation never publishes its image');
select pg_temp.assert_true((select image_path = current_setting('test.image_a') and not is_owner from public.get_caption_feed(p_caption_id => current_setting('test.image_request')::uuid)), 'feed exposes the saved published image with existing attribution');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.image_user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.image_user_a'), 'role', 'authenticated')::text, true);
select pg_temp.expect_sqlstate(
  $$insert into storage.objects (bucket_id, name, metadata) values ('meme-images', current_setting('test.image_unuploaded'), '{"mimetype":"image/webp","size":64}')$$,
  '42501', 'a failed request no longer permits an upload');
select pg_temp.expect_sqlstate(
  $$insert into storage.objects (bucket_id, name, metadata) values ('meme-images', current_setting('test.image_a'), '{"mimetype":"image/webp","size":64}')$$,
  '42501', 'a completed request no longer permits an upload');
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name = current_setting('test.image_failed')), 'owner retains their failed generation source privately');
with deleted as (
  delete from storage.objects where bucket_id = 'meme-images' and name in (current_setting('test.image_a'), current_setting('test.image_failed')) returning id
)
select pg_temp.assert_true((select count(*) = 0 from deleted), 'published and failed request references cannot be deleted');
reset role;

select 'City Margins image privacy and mutation tests passed.' as result;
rollback;
