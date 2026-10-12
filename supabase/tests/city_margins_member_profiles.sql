-- Disposable/local PostgreSQL or Supabase test database only. Storage rows below
-- are permission fixtures; real files must always be written with Storage API.
-- Run after the image/profile migrations and the Reading Room archive.
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function pg_temp.expect_sqlstate(statement text, expected text, message text)
returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement; exception when others then actual := sqlstate; end;
  if actual is distinct from expected then
    raise exception 'Assertion failed: % (expected %, got %)', message, expected, coalesce(actual, 'success');
  end if;
end;
$$;

select set_config('test.member_a', gen_random_uuid()::text, true);
select set_config('test.member_b', gen_random_uuid()::text, true);
select set_config('test.member_c', gen_random_uuid()::text, true);
select set_config('test.avatar_a', current_setting('test.member_a') || '/avatar.webp', true);
select set_config('test.avatar_b', current_setting('test.member_b') || '/avatar.webp', true);
select set_config('test.avatar_c', current_setting('test.member_c') || '/avatar.webp', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select id::uuid, 'authenticated', 'authenticated', id || '@example.invalid', '{}', '{}'
from unnest(array[current_setting('test.member_a'), current_setting('test.member_b'), current_setting('test.member_c')]) as id;

select pg_temp.assert_true((select relrowsecurity from pg_class where oid = 'public.member_profiles'::regclass), 'profiles enforce RLS');
select pg_temp.assert_true((select not public and file_size_limit = 2097152 and allowed_mime_types = array['image/webp'] from storage.buckets where id = 'member-avatars'), 'avatar bucket is private and bounded');
select pg_temp.assert_true(not has_schema_privilege('anon', 'city_margins_private', 'USAGE'), 'private helpers cannot be addressed through public schemas');
select pg_temp.assert_true(not has_function_privilege('service_role', 'public.get_caption_feed(text,integer,integer,uuid)', 'EXECUTE'), 'feed grants remain narrowly scoped');
select pg_temp.assert_true(not has_function_privilege('anon', 'city_margins_private.set_member_profile_updated_at()', 'EXECUTE'), 'timestamp trigger is not a public RPC');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_sqlstate('select * from public.member_profiles', '42501', 'anonymous profiles cannot be listed');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name) values ('Anon')$$, '42501', 'anonymous users cannot create a profile');
select pg_temp.expect_sqlstate($$update public.member_profiles set display_name = 'Anon'$$, '42501', 'anonymous profile edits are rejected');
select pg_temp.expect_sqlstate('delete from public.member_profiles', '42501', 'anonymous profile deletion is rejected');
select pg_temp.expect_sqlstate($$insert into storage.objects (bucket_id, name) values ('member-avatars', current_setting('test.avatar_a'))$$, '42501', 'anonymous avatar upload is rejected');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_a'), true);
select pg_temp.expect_sqlstate($$insert into public.member_profiles (id, display_name) values (current_setting('test.member_b')::uuid, 'Impersonator')$$, '42501', 'profile insert cannot claim another user');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name) values ('')$$, '23514', 'empty name is invalid');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name) values (' Space ')$$, '23514', 'name must be trimmed');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name) values (repeat('x', 41))$$, '23514', 'long name is invalid');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name) values (E'Two\nLines')$$, '23514', 'control characters are rejected');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name) values (U&'Hidden\202eName')$$, '23514', 'invisible formatting controls are rejected');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name, avatar_path) values ('Sam', current_setting('test.avatar_b'))$$, '23514', 'profile cannot reference another avatar');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name, avatar_path) values ('Sam', current_setting('test.member_a') || '/extra.webp')$$, '23514', 'profile requires the fixed avatar path');
select pg_temp.expect_sqlstate($$insert into public.member_profiles (display_name, updated_at) values ('Sam', '2000-01-01')$$, '42501', 'caller cannot supply profile timestamp');

-- Avatar preview works before a profile exists. One fixed object may be replaced.
insert into storage.objects (bucket_id, name, metadata) values ('member-avatars', current_setting('test.avatar_a'), '{"mimetype":"image/webp","size":64}');
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name = current_setting('test.avatar_a')), 'owner can preview an unsaved avatar');
insert into storage.objects (bucket_id, name, metadata) values ('member-avatars', current_setting('test.avatar_a'), '{"mimetype":"image/webp","size":128}')
on conflict (bucket_id, name) do update set metadata = excluded.metadata;
select pg_temp.assert_true((select metadata ->> 'size' = '128' from storage.objects where name = current_setting('test.avatar_a')), 'owner avatar upsert succeeds');
select pg_temp.expect_sqlstate($$insert into storage.objects (bucket_id, name) values ('member-avatars', current_setting('test.avatar_b'))$$, '42501', 'owner cannot upload another avatar');
select pg_temp.expect_sqlstate($$insert into storage.objects (bucket_id, name) values ('member-avatars', current_setting('test.member_a') || '/extra.webp')$$, '42501', 'additional avatar objects are rejected');
select pg_temp.expect_sqlstate($$update storage.objects set name = current_setting('test.avatar_b') where name = current_setting('test.avatar_a')$$, '42501', 'avatar update cannot reassign ownership');
select pg_temp.expect_sqlstate($$update storage.objects set name = current_setting('test.member_a') || '/extra.webp' where name = current_setting('test.avatar_a')$$, '42501', 'avatar update cannot create an alternate path');

insert into public.member_profiles (display_name, avatar_path) values ('Sam 林', current_setting('test.avatar_a'));
select pg_temp.assert_true((select id = current_setting('test.member_a')::uuid from public.member_profiles), 'profile defaults to the current authenticated user');
select set_config('test.member_original_updated', (select updated_at::text from public.member_profiles), true);
select pg_temp.expect_sqlstate($$update public.member_profiles set id = current_setting('test.member_b')::uuid$$, '42501', 'profile ownership cannot be changed');
select pg_temp.expect_sqlstate($$update public.member_profiles set updated_at = '2000-01-01'$$, '42501', 'profile timestamps cannot be forged');
select pg_temp.expect_sqlstate('delete from public.member_profiles', '42501', 'direct profile deletion is not exposed');
update public.member_profiles set display_name = 'Sam from Columbia';
select pg_temp.assert_true((select updated_at > current_setting('test.member_original_updated')::timestamptz from public.member_profiles), 'database timestamp changes when a name is saved');
select set_config('test.member_caption_a', public.reserve_generation('A crowded subway ride uptown', 'witty', 'private prompt A', 'private system A', 'test-model')::text, true);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_b'), true);
select pg_temp.assert_true(not exists(select 1 from public.member_profiles), 'other members cannot read private profile rows');
with changed as (update public.member_profiles set display_name = 'Hijacked' where id = current_setting('test.member_a')::uuid returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'other members cannot edit a profile');
select pg_temp.assert_true(not exists(select 1 from storage.objects where name = current_setting('test.avatar_a')), 'unpublished avatar is private');
with changed as (update storage.objects set metadata = '{}' where name = current_setting('test.avatar_a') returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'other members cannot replace an unpublished avatar');
with changed as (delete from storage.objects where name = current_setting('test.avatar_a') returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'other members cannot delete an avatar');
insert into storage.objects (bucket_id, name, metadata) values ('member-avatars', current_setting('test.avatar_b'), '{"mimetype":"image/webp","size":64}');
insert into public.member_profiles (display_name, avatar_path) values ('Private until I post', current_setting('test.avatar_b'));
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_c'), true);
select set_config('test.member_caption_c', public.reserve_generation('A second crowded subway ride', 'deadpan', 'private prompt C', 'private system C', 'test-model')::text, true);
reset role;
set local role service_role;
select public.complete_generation(current_setting('test.member_caption_a')::uuid, 'The 1 train is my longest relationship.');
select public.complete_generation(current_setting('test.member_caption_c')::uuid, 'New York has entered the chat.');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_a'), true);
select public.cast_vote(current_setting('test.member_caption_a')::uuid, 1::smallint);
select pg_temp.assert_true((select is_owner and viewer_vote = 1 and author_name = 'Sam from Columbia' from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_a')::uuid)), 'author profile does not change own vote/ownership');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_b'), true);
select public.cast_vote(current_setting('test.member_caption_a')::uuid, 1::smallint);
select pg_temp.assert_true((select not is_owner and viewer_vote = 1 and upvotes = 2 and score = 2 and author_name = 'Sam from Columbia' from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_a')::uuid)), 'feed retains votes and public author information');
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name = current_setting('test.avatar_a')), 'members can read published authors avatars');
with changed as (update storage.objects set metadata = '{}' where name = current_setting('test.avatar_a') returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'public avatar visibility does not confer update access');
with changed as (delete from storage.objects where name = current_setting('test.avatar_a') returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'public avatar visibility does not confer delete access');
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true((select author_name = 'Sam from Columbia' and author_avatar_path = current_setting('test.avatar_a') and author_updated_at is not null and viewer_vote is null and not is_owner and upvotes = 2 from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_a')::uuid)), 'anonymous feed shows only explicit published author details');
select pg_temp.assert_true((select author_name is null and author_avatar_path is null and author_updated_at is null from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_c')::uuid)), 'existing authors without profiles still appear');
select pg_temp.assert_true((select id = current_setting('test.member_caption_a')::uuid from public.get_caption_feed('top', 1, 0)), 'top sorting is preserved');
select pg_temp.assert_true((select count(*) = 1 from public.get_caption_feed('top', 30, 1)), 'pagination is preserved');
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name = current_setting('test.avatar_a')), 'anonymous readers can fetch the current published avatar');
select pg_temp.assert_true(not exists(select 1 from storage.objects where name = current_setting('test.avatar_b')), 'profile without published captions does not expose its avatar');
select pg_temp.expect_sqlstate('select * from public.member_profiles', '42501', 'public author attribution does not allow profile enumeration');
select pg_temp.expect_sqlstate('select * from public.generation_requests', '42501', 'private prompts remain inaccessible');
with changed as (update storage.objects set metadata = '{}' where name = current_setting('test.avatar_a') returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'anonymous readers cannot replace avatars');
with changed as (delete from storage.objects where name = current_setting('test.avatar_a') returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'anonymous readers cannot delete avatars');
reset role;

-- Profiles are live attribution, not a snapshot taken when the meme is posted.
-- Member C published above without a profile; adding and replacing their avatar
-- must update that same existing meme for its owner and for public visitors.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_c'), true);
insert into storage.objects (bucket_id, name, metadata) values ('member-avatars', current_setting('test.avatar_c'), '{"mimetype":"image/webp","size":64}');
insert into public.member_profiles (display_name, avatar_path) values ('After the first meme', current_setting('test.avatar_c'));
select set_config('test.member_c_original_updated', (select updated_at::text from public.member_profiles), true);
select pg_temp.assert_true((select is_owner and author_name = 'After the first meme' and author_avatar_path = current_setting('test.avatar_c') and author_updated_at = current_setting('test.member_c_original_updated')::timestamptz from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_c')::uuid)), 'owner sees a new profile and avatar on an existing meme');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true((select not is_owner and author_name = 'After the first meme' and author_avatar_path = current_setting('test.avatar_c') and author_updated_at = current_setting('test.member_c_original_updated')::timestamptz from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_c')::uuid)), 'anonymous feed sees a profile created after publication');
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name = current_setting('test.avatar_c')), 'avatar added after publication is publicly readable');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_c'), true);
insert into storage.objects (bucket_id, name, metadata) values ('member-avatars', current_setting('test.avatar_c'), '{"mimetype":"image/webp","size":128}')
on conflict (bucket_id, name) do update set metadata = excluded.metadata;
update public.member_profiles set display_name = 'New photo, same meme', avatar_path = current_setting('test.avatar_c');
select set_config('test.member_c_replaced_updated', (select updated_at::text from public.member_profiles), true);
select pg_temp.assert_true(current_setting('test.member_c_replaced_updated')::timestamptz > current_setting('test.member_c_original_updated')::timestamptz, 'replacing an avatar advances its cache-busting version');
select pg_temp.assert_true((select is_owner and author_name = 'New photo, same meme' and author_avatar_path = current_setting('test.avatar_c') and author_updated_at = current_setting('test.member_c_replaced_updated')::timestamptz from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_c')::uuid)), 'owner sees the replacement avatar version and name on an existing meme');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true((select not is_owner and author_name = 'New photo, same meme' and author_avatar_path = current_setting('test.avatar_c') and author_updated_at = current_setting('test.member_c_replaced_updated')::timestamptz from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_c')::uuid)), 'anonymous feed sees the replacement avatar version and name on an existing meme');
select pg_temp.assert_true((select metadata ->> 'size' = '128' from storage.objects where name = current_setting('test.avatar_c')), 'public avatar reads resolve the replaced object');
select pg_temp.expect_sqlstate('select * from public.member_profiles', '42501', 'updated public attribution still does not expose private profile rows');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_a'), true);
update public.member_profiles set avatar_path = null;
select pg_temp.assert_true((select count(*) = 1 from storage.objects where name = current_setting('test.avatar_a')), 'removing an avatar keeps its stored object owner-readable');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(not exists(select 1 from storage.objects where name = current_setting('test.avatar_a')), 'removing an avatar immediately revokes new public reads');
select pg_temp.assert_true((select author_name = 'Sam from Columbia' and author_avatar_path is null from public.get_caption_feed(p_caption_id => current_setting('test.member_caption_a')::uuid)), 'removed avatar disappears from all author cards');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.member_a'), true);
with removed as (delete from storage.objects where name = current_setting('test.avatar_a') returning id)
select pg_temp.assert_true((select count(*) = 1 from removed), 'owner can delete their fixed avatar object');
reset role;

select 'City Margins member profile permissions, avatars, and feed tests passed.' as result;
rollback;
