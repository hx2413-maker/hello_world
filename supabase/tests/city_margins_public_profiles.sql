-- Transactional fixtures only; every user, publication, vote, and quota write
-- rolls back. No existing application row or real Storage object is modified.
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

select set_config('test.public_a', gen_random_uuid()::text, true);
select set_config('test.public_b', gen_random_uuid()::text, true);
select set_config('test.public_c', gen_random_uuid()::text, true);
select set_config('test.public_d', gen_random_uuid()::text, true);
select set_config('test.public_e', gen_random_uuid()::text, true);
select set_config('test.public_starter', gen_random_uuid()::text, true);
select set_config('test.public_unknown', gen_random_uuid()::text, true);
select set_config('test.caption_a1', gen_random_uuid()::text, true);
select set_config('test.caption_a2', gen_random_uuid()::text, true);
select set_config('test.caption_a3', gen_random_uuid()::text, true);
select set_config('test.caption_b', gen_random_uuid()::text, true);
select set_config('test.caption_c', gen_random_uuid()::text, true);
select set_config('test.caption_starter', gen_random_uuid()::text, true);
select set_config('test.image_path', current_setting('test.public_a') || '/' || gen_random_uuid()::text || '.webp', true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select id::uuid, 'authenticated', 'authenticated', id || '@example.invalid',
  case when id = current_setting('test.public_starter') then '{"city_margins_starter":true}'::jsonb else '{}'::jsonb end,
  '{"display_name":"Private auth name must not leak"}'::jsonb
from unnest(array[current_setting('test.public_a'), current_setting('test.public_b'),
  current_setting('test.public_c'), current_setting('test.public_d'),
  current_setting('test.public_e'), current_setting('test.public_starter')]) as id;
insert into public.member_profiles (id, display_name, avatar_path) values
  (current_setting('test.public_a')::uuid, 'Sam from Columbia', current_setting('test.public_a') || '/avatar.webp'),
  (current_setting('test.public_d')::uuid, 'Ready to create', current_setting('test.public_d') || '/avatar.webp');

-- Use a separate fixture quota day to avoid consuming/locking today's budget.
insert into public.generation_requests
  (id, user_id, scene, vibe, prompt, system_prompt, model, status,
   quota_day, daily_slot, created_at, completed_at, image_path)
select id::uuid, owner_id::uuid, 'A private fixture situation', 'witty',
  'Private fixture prompt', 'Private system prompt', 'fixture-model', 'completed',
  '2099-01-01'::date, slot::smallint, published::timestamptz, published::timestamptz, image_path
from (values
  (current_setting('test.caption_a1'), current_setting('test.public_a'), 1, '2000-01-01', null::text),
  (current_setting('test.caption_a2'), current_setting('test.public_a'), 2, '2000-01-02', null::text),
  (current_setting('test.caption_a3'), current_setting('test.public_a'), 3, '2000-01-03', current_setting('test.image_path')),
  (current_setting('test.caption_b'), current_setting('test.public_b'), 1, '2000-01-04', null::text),
  (current_setting('test.caption_c'), current_setting('test.public_c'), 1, '2000-01-05', null::text),
  (current_setting('test.caption_starter'), current_setting('test.public_starter'), 1, '2000-01-06', null::text)
) as fixtures(id, owner_id, slot, published, image_path);
insert into public.captions (id, body, vibe, created_at, image_path)
select id, 'A public fixture meme.', vibe, created_at, image_path
from public.generation_requests
where id::text in (current_setting('test.caption_a1'), current_setting('test.caption_a2'),
  current_setting('test.caption_a3'), current_setting('test.caption_b'),
  current_setting('test.caption_c'), current_setting('test.caption_starter'));
insert into public.votes (caption_id, user_id, value) values
  (current_setting('test.caption_a1')::uuid, current_setting('test.public_a')::uuid, 1),
  (current_setting('test.caption_a1')::uuid, current_setting('test.public_b')::uuid, 1),
  (current_setting('test.caption_a1')::uuid, current_setting('test.public_c')::uuid, -1),
  (current_setting('test.caption_a2')::uuid, current_setting('test.public_b')::uuid, 1);
select set_config('test.budget_before', (select used_attempts::text from public.daily_generation_budget where quota_day = '2099-01-01'), true);

select pg_temp.assert_true(not (select prosecdef from pg_proc where oid = 'public.get_public_member(uuid)'::regprocedure), 'profile RPC is an invoker wrapper');
select pg_temp.assert_true(not (select prosecdef from pg_proc where oid = 'public.get_caption_feed(text,integer,integer,uuid,uuid)'::regprocedure), 'feed RPC is an invoker wrapper');
select pg_temp.assert_true(not has_schema_privilege('anon', 'city_margins_private', 'CREATE'), 'public visitors cannot create private helpers');
select pg_temp.assert_true(not has_function_privilege('anon', 'city_margins_private.set_member_profile_updated_at()', 'EXECUTE'), 'private trigger remains revoked');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true((select display_name = 'Sam from Columbia' and meme_count = 3 and total_upvotes = 3 and not is_owner from public.get_public_member(current_setting('test.public_a')::uuid)), 'public stats count memes and upvotes, not net votes');
select pg_temp.assert_true((select display_name = 'Community member' and avatar_path is null and updated_at is null and meme_count = 1 from public.get_public_member(current_setting('test.public_c')::uuid)), 'author without profile gets safe fallback, never auth metadata');
select pg_temp.assert_true((select display_name = 'Ready to create' and meme_count = 0 and total_upvotes = 0 from public.get_public_member(current_setting('test.public_d')::uuid)), 'configured zero-post profile is visible');
select pg_temp.assert_true(city_margins_private.is_published_member_avatar(current_setting('test.public_d') || '/avatar.webp'), 'configured zero-post avatar is readable');
select pg_temp.assert_true(not exists(select 1 from public.get_public_member(current_setting('test.public_unknown')::uuid)), 'unknown UUID does not create a phantom member');
select pg_temp.assert_true((select display_name = 'Community member' and meme_count = 0 and total_upvotes = 0 and not is_owner from public.get_public_member(current_setting('test.public_e')::uuid)), 'every real member has a public empty profile before posting or choosing a name');
select pg_temp.assert_true(not exists(select 1 from public.get_public_member(current_setting('test.public_starter')::uuid)), 'starter-only account has no public page');
select pg_temp.assert_true(not exists(select 1 from public.get_public_member(null)), 'null lookup is empty');
select pg_temp.assert_true((select array_agg(key order by key) = array['avatar_path','display_name','id','is_owner','meme_count','total_upvotes','updated_at'] from public.get_public_member(current_setting('test.public_a')::uuid) p cross join lateral jsonb_object_keys(to_jsonb(p)) key), 'RPC shape contains only public identity and aggregates');
select pg_temp.assert_true((select count(*) = 3 and bool_and(author_id = current_setting('test.public_a')::uuid and not is_owner and not is_starter) from public.get_caption_feed(p_author_id => current_setting('test.public_a')::uuid)), 'author filter returns only that member');
select pg_temp.assert_true((select id = current_setting('test.caption_a3')::uuid from public.get_caption_feed('new', 1, 0, null, current_setting('test.public_a')::uuid)), 'author first page sorts newest');
select pg_temp.assert_true((select id = current_setting('test.caption_a2')::uuid from public.get_caption_feed('new', 1, 1, null, current_setting('test.public_a')::uuid)), 'author pagination advances');
select pg_temp.assert_true(not exists(select 1 from public.get_caption_feed('new', 1, 3, null, current_setting('test.public_a')::uuid)), 'author pagination ends');
select pg_temp.assert_true((select id = current_setting('test.caption_a2')::uuid from public.get_caption_feed('top', 1, 0, null, current_setting('test.public_a')::uuid)), 'author top sort preserves score and timestamp tiebreak');
select pg_temp.assert_true(not exists(select 1 from public.get_caption_feed(p_author_id => current_setting('test.public_starter')::uuid)), 'starter publications excluded from author filter');
select pg_temp.assert_true((select author_id is null and author_name is null and author_avatar_path is null from public.get_caption_feed(p_caption_id => current_setting('test.caption_starter')::uuid)), 'starter identity stays hidden in main feed');
select pg_temp.assert_true((select id = current_setting('test.caption_a1')::uuid from public.get_caption_feed('new', 30, 0, current_setting('test.caption_a1')::uuid)), 'existing four-argument feed callers remain compatible');
select pg_temp.assert_true(not exists(select 1 from public.get_caption_feed(p_caption_id => current_setting('test.caption_b')::uuid, p_author_id => current_setting('test.public_a')::uuid)), 'caption and author filters intersect');
select pg_temp.expect_sqlstate('select * from public.member_profiles', '42501', 'direct profile enumeration is still denied');
select pg_temp.expect_sqlstate('select * from public.generation_requests', '42501', 'private prompts stay inaccessible');
select pg_temp.expect_sqlstate($$delete from public.captions where id = current_setting('test.caption_a1')::uuid$$, '42501', 'anonymous deletion is denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.public_b'), true);
with removed as (delete from public.captions where id = current_setting('test.caption_a1')::uuid returning id)
select pg_temp.assert_true((select count(*) = 0 from removed), 'another member cannot delete a publication');
select pg_temp.assert_true(not public.can_delete_meme_image(current_setting('test.image_path')), 'another member cannot delete the source object');
select pg_temp.assert_true(not exists(select 1 from public.member_profiles where id = current_setting('test.public_a')::uuid), 'public wrapper does not widen direct profile RLS');
select pg_temp.assert_true((select viewer_vote = 1 and not is_owner from public.get_caption_feed(p_caption_id => current_setting('test.caption_a1')::uuid)), 'public member feed preserves current viewer vote');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.public_e'), true);
select pg_temp.assert_true((select is_owner and meme_count = 0 and display_name = 'Community member' from public.get_public_member(current_setting('test.public_e')::uuid)), 'new user can open their own empty profile');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.public_a'), true);
select pg_temp.assert_true((select is_owner from public.get_public_member(current_setting('test.public_a')::uuid)), 'owner flag uses authenticated identity');
select pg_temp.assert_true(not public.can_delete_meme_image(current_setting('test.image_path')), 'published source cannot be removed');
with removed as (delete from public.captions where id = current_setting('test.caption_a1')::uuid returning id)
select pg_temp.assert_true((select count(*) = 1 from removed), 'owner can delete their publication');
select pg_temp.assert_true((select meme_count = 2 and total_upvotes = 1 from public.get_public_member(current_setting('test.public_a')::uuid)), 'profile totals update after deletion');
select pg_temp.assert_true(not exists(select 1 from public.get_caption_feed(p_caption_id => current_setting('test.caption_a1')::uuid)), 'deleted item disappears from feed and permalink lookup');
select pg_temp.assert_true((select count(*) = 1 from public.generation_requests where id = current_setting('test.caption_a1')::uuid and status = 'completed'), 'owner retains private prompt and request after deletion');
select pg_temp.expect_sqlstate($$delete from public.generation_requests where id = current_setting('test.caption_a1')::uuid$$, '42501', 'owner cannot reset quota by deleting audit request');
with removed as (delete from public.captions where id in (current_setting('test.caption_a2')::uuid, current_setting('test.caption_a3')::uuid) returning id)
select pg_temp.assert_true((select count(*) = 2 from removed), 'owner can delete remaining own publications');
select pg_temp.assert_true(public.can_delete_meme_image(current_setting('test.image_path')), 'completed unpublished source can now be removed');
select pg_temp.assert_true((select meme_count = 0 and total_upvotes = 0 from public.get_public_member(current_setting('test.public_a')::uuid)), 'last deletion leaves empty profile');
reset role;
select pg_temp.assert_true(not exists(select 1 from public.votes where caption_id = current_setting('test.caption_a1')::uuid), 'all votes cascade, including votes owned by other members');
select pg_temp.assert_true((select count(*) = 3 and max(daily_slot) = 3 from public.generation_requests where user_id = current_setting('test.public_a')::uuid), 'all personal quota slots remain');
select pg_temp.assert_true((select used_attempts::text = current_setting('test.budget_before') from public.daily_generation_budget where quota_day = '2099-01-01'), 'global quota is unchanged by publication deletion');
set local role service_role;
select public.complete_generation(current_setting('test.caption_a1')::uuid, 'Retry must not restore a deleted publication.');
reset role;
select pg_temp.assert_true(not exists(select 1 from public.captions where id = current_setting('test.caption_a1')::uuid), 'a completion retry cannot resurrect deleted content');

-- Safety still blocks unfinished source images; no real objects are touched.
update public.generation_requests set status = 'pending', completed_at = null where id = current_setting('test.caption_a3')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.public_a'), true);
select pg_temp.assert_true(not public.can_delete_meme_image(current_setting('test.image_path')), 'pending source remains protected');
reset role;
update public.generation_requests set status = 'failed', completed_at = clock_timestamp() where id = current_setting('test.caption_a3')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.public_a'), true);
select pg_temp.assert_true(not public.can_delete_meme_image(current_setting('test.image_path')), 'failed request cleanup policy remains unchanged');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.public_c'), true);
delete from public.captions where id = current_setting('test.caption_c')::uuid;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true((select display_name = 'Community member' and meme_count = 0 and total_upvotes = 0 from public.get_public_member(current_setting('test.public_c')::uuid)), 'former author without configured profile remains available');
reset role;

-- Starter publications are managed by the application, not member settings.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.public_starter'), true);
with removed as (delete from public.captions where id = current_setting('test.caption_starter')::uuid returning id)
select pg_temp.assert_true((select count(*) = 0 from removed), 'starter publications cannot be deleted through member permissions');
reset role;

select 'Public member profiles, pagination, owner deletion, vote cascade, storage cleanup, and quota retention passed.' as result;
rollback;
