-- Run as postgres in a disposable/local Supabase database after all migrations.
-- Uses two temporary Auth users and rolls back every change, even on success.
-- Any failed assertion aborts the transaction. No pgTAP extension is required.
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
declare
  actual text;
begin
  begin
    execute statement;
  exception when others then
    actual := sqlstate;
  end;
  if actual is distinct from expected then
    raise exception 'Assertion failed: % (expected %, got %)', message, expected, coalesce(actual, 'success');
  end if;
end;
$$;

select set_config('test.user_a', gen_random_uuid()::text, true);
select set_config('test.user_b', gen_random_uuid()::text, true);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  (current_setting('test.user_a')::uuid, 'authenticated', 'authenticated', current_setting('test.user_a') || '@example.invalid', '{}'::jsonb, '{}'::jsonb),
  (current_setting('test.user_b')::uuid, 'authenticated', 'authenticated', current_setting('test.user_b') || '@example.invalid', '{}'::jsonb, '{}'::jsonb);

select pg_temp.assert_true(not exists (
  select 1 from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_catalog.pg_class'::regclass
        and d.objid = c.oid and d.deptype = 'e'
    )
), 'all public application tables have RLS');

-- Reserve as user A. JWT claims are assigned by the SQL test administrator;
-- real clients cannot choose a JWT subject without a valid signed token.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
select set_config('test.caption_a', public.reserve_generation('A rainy walk around campus', 'witty', 'private prompt A', 'system prompt A', 'test-model')::text, true);
select set_config('test.failed', public.reserve_generation('A cancelled subway commute', 'deadpan', 'private failed prompt', 'system prompt A', 'test-model')::text, true);
select set_config('test.pending', public.reserve_generation('A quiet morning at the park', 'poetic', 'private pending prompt', 'system prompt A', 'test-model')::text, true);

select pg_temp.expect_sqlstate(
  $$select public.complete_generation(current_setting('test.caption_a')::uuid, 'fabricated caption')$$,
  '42501', 'a signed-in user cannot impersonate the AI provider');
select pg_temp.expect_sqlstate(
  $$select public.fail_generation(current_setting('test.pending')::uuid)$$,
  '42501', 'a signed-in user cannot change generation status');
select pg_temp.expect_sqlstate(
  $$insert into public.captions (id, body, vibe) values (current_setting('test.pending')::uuid, 'fabricated', 'witty')$$,
  '42501', 'direct output insertion is forbidden');
select pg_temp.expect_sqlstate(
  $$update public.generation_requests set status = 'failed' where id = current_setting('test.pending')::uuid$$,
  '42501', 'direct request state changes are forbidden');
select pg_temp.expect_sqlstate(
  $$delete from public.generation_requests where user_id = current_setting('test.user_a')::uuid$$,
  '42501', 'attempts cannot be deleted to recover quota');
select pg_temp.expect_sqlstate(
  $$select public.reserve_generation('short', 'witty', 'p', 's', 'test-model')$$,
  '22023', 'generation input is validated in the database');
reset role;

-- Provider publication and failure transitions are privileged and atomic.
set local role service_role;
select pg_temp.assert_true(
  public.complete_generation(current_setting('test.caption_a')::uuid, 'The city called. It is also running late.', 40, 12) = current_setting('test.caption_a')::uuid,
  'completed caption and its request use the same ID');
select public.complete_generation(current_setting('test.caption_a')::uuid, 'A retry must not replace the original.');
select public.fail_generation(current_setting('test.failed')::uuid);
select public.fail_generation(current_setting('test.caption_a')::uuid);
select pg_temp.expect_sqlstate(
  $$select public.complete_generation(current_setting('test.failed')::uuid, 'late completion')$$,
  '55000', 'a failed request cannot later be published');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
select set_config('test.caption_b', public.reserve_generation('A weekend wandering downtown', 'poetic', 'private prompt B', 'system prompt B', 'test-model')::text, true);
select pg_temp.assert_true((select count(*) = 1 from public.generation_requests), 'user B sees only their own request');
select pg_temp.assert_true(not exists (select 1 from public.generation_requests where id = current_setting('test.caption_a')::uuid), 'user B cannot read user A private prompts');
select pg_temp.assert_true(not exists (select 1 from public.profiles where id = current_setting('test.user_a')::uuid), 'user B cannot read user A profile');
select pg_temp.assert_true((select count(*) = 1 from public.profiles where id = current_setting('test.user_b')::uuid), 'user B can read their own profile');
with updated as (
  update public.profiles set first_name = 'intruder' where id = current_setting('test.user_a')::uuid returning id
)
select pg_temp.assert_true((select count(*) = 0 from updated), 'user B cannot update user A profile');
reset role;

set local role service_role;
select public.complete_generation(current_setting('test.caption_b')::uuid, 'A pocket-sized poem for a very large city.');
reset role;

-- Public visitors can read outputs and scores but no private records or votes.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.assert_true((select count(*) = 1 from public.captions where id = current_setting('test.caption_a')::uuid), 'public caption is readable');
select pg_temp.assert_true((select body = 'The city called. It is also running late.' from public.captions where id = current_setting('test.caption_a')::uuid), 'completion retries preserve the original output');
select pg_temp.assert_true(not exists (select 1 from public.captions where id in (current_setting('test.failed')::uuid, current_setting('test.pending')::uuid)), 'failed and pending generations are not public');
select pg_temp.assert_true((select count(*) >= 0 from public.books), 'existing books remain public');
select pg_temp.assert_true((select viewer_vote is null from public.get_caption_feed(p_caption_id => current_setting('test.caption_a')::uuid)), 'anonymous viewers have no vote');
select pg_temp.expect_sqlstate('select * from public.generation_requests', '42501', 'anonymous prompts are inaccessible');
select pg_temp.expect_sqlstate('select * from public.profiles', '42501', 'anonymous profiles are inaccessible');
select pg_temp.expect_sqlstate('select * from public.votes', '42501', 'anonymous voter records are inaccessible');
select pg_temp.expect_sqlstate(
  $$select public.cast_vote(current_setting('test.caption_a')::uuid, 1::smallint)$$,
  '42501', 'anonymous voting is forbidden');
select pg_temp.expect_sqlstate(
  $$select public.reserve_generation('A long enough city scene', 'witty', 'p', 's', 'model')$$,
  '42501', 'anonymous generation is forbidden');
reset role;

-- First vote inserts a row; changing/repeating it never adds a second row.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
select public.cast_vote(current_setting('test.caption_a')::uuid, 1::smallint);
select public.cast_vote(current_setting('test.caption_a')::uuid, 1::smallint);
select pg_temp.assert_true((select count(*) = 1 from public.votes where caption_id = current_setting('test.caption_a')::uuid), 'repeated vote creates only one row');
select public.cast_vote(current_setting('test.caption_a')::uuid, -1::smallint);
select pg_temp.assert_true((select value = -1 from public.votes where caption_id = current_setting('test.caption_a')::uuid), 'own vote can change');
select pg_temp.expect_sqlstate(
  $$insert into public.votes (caption_id, user_id, value) values (current_setting('test.caption_b')::uuid, current_setting('test.user_b')::uuid, 1)$$,
  '42501', 'RLS rejects forging another user vote');
select pg_temp.expect_sqlstate(
  $$update public.votes set user_id = current_setting('test.user_b')::uuid where caption_id = current_setting('test.caption_a')::uuid$$,
  '42501', 'vote ownership is immutable');
select pg_temp.expect_sqlstate(
  $$update public.votes set caption_id = current_setting('test.caption_b')::uuid where caption_id = current_setting('test.caption_a')::uuid$$,
  '42501', 'vote target is immutable');
select pg_temp.expect_sqlstate(
  $$select public.cast_vote(current_setting('test.pending')::uuid, 1::smallint)$$,
  '23503', 'votes require a published caption');
select pg_temp.expect_sqlstate(
  $$select public.cast_vote(current_setting('test.caption_a')::uuid, 2::smallint)$$,
  '22023', 'invalid vote values are rejected');
select pg_temp.expect_sqlstate(
  $$insert into public.votes (caption_id, user_id, value) values (current_setting('test.caption_b')::uuid, current_setting('test.user_a')::uuid, 2)$$,
  '23514', 'table constraints also reject invalid vote values');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_b'), 'role', 'authenticated')::text, true);
select pg_temp.assert_true(not exists (select 1 from public.votes), 'user B cannot inspect user A vote row');
with changed as (
  update public.votes set value = 1 where user_id = current_setting('test.user_a')::uuid returning user_id
)
select pg_temp.assert_true((select count(*) = 0 from changed), 'user B cannot change user A vote');
with removed as (
  delete from public.votes where user_id = current_setting('test.user_a')::uuid returning user_id
)
select pg_temp.assert_true((select count(*) = 0 from removed), 'user B cannot remove user A vote');
select public.cast_vote(current_setting('test.caption_a')::uuid, 1::smallint);
select pg_temp.assert_true((select upvotes = 1 and downvotes = 1 and score = 0 and viewer_vote = 1 from public.get_caption_feed(p_caption_id => current_setting('test.caption_a')::uuid)), 'aggregate counts include both users but viewer vote belongs to B');
select public.cast_vote(current_setting('test.caption_a')::uuid, 0::smallint);
select pg_temp.assert_true(not exists (select 1 from public.votes), 'user B can remove their own vote');
reset role;

-- Completed, failed, and pending requests all count toward one shared quota.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user_a'), 'role', 'authenticated')::text, true);
select public.reserve_generation('The fourth scene of the day', 'witty', 'fourth prompt', 'system', 'test-model');
select public.reserve_generation('The fifth scene of the day', 'deadpan', 'fifth prompt', 'system', 'test-model');
select pg_temp.expect_sqlstate(
  $$select public.reserve_generation('The sixth scene of the day', 'witty', 'sixth prompt', 'system', 'test-model')$$,
  'P0001', 'a sixth generation attempt is rejected');
select pg_temp.assert_true((select count(*) = 5 from public.generation_requests), 'exactly five attempts remain after quota rejection');
select pg_temp.assert_true((select status = 'completed' and input_tokens = 40 and output_tokens = 12 from public.generation_requests where id = current_setting('test.caption_a')::uuid), 'successful generation stores status and provider usage');
select pg_temp.assert_true((select status = 'failed' from public.generation_requests where id = current_setting('test.failed')::uuid), 'provider failure is recorded privately');
select pg_temp.assert_true((select downvotes = 1 and viewer_vote = -1 from public.get_caption_feed(p_caption_id => current_setting('test.caption_a')::uuid)), 'user A still owns their original vote');
select pg_temp.assert_true((select count(*) = 1 from public.get_caption_feed(p_limit => 1)), 'feed respects its requested limit');
reset role;

-- Structural quota check: six occupied slots cannot exist even if callers use
-- different isolation levels. The first constraint covers values outside 1..5.
select pg_temp.expect_sqlstate(
  $$update public.generation_requests set daily_slot = 6 where id = current_setting('test.pending')::uuid$$,
  '23514', 'daily slot constraint prevents a sixth slot');
select pg_temp.expect_sqlstate(
  $$update public.generation_requests set daily_slot = 1 where id = current_setting('test.pending')::uuid$$,
  '23505', 'daily slot uniqueness prevents quota slot reuse');

select 'City Margins RLS and mutation tests passed; rolling back test users and data.' as result;
rollback;
