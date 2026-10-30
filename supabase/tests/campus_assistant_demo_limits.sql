-- This suite only creates temporary fixtures; all effects roll back.
begin;
create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'Assertion failed: %', message; end if;
end; $$;
create function pg_temp.expect_error(statement text, expected text, message text)
returns void language plpgsql as $$ declare actual text; begin
  begin execute statement; exception when others then actual := sqlerrm; end;
  if actual is distinct from expected then raise exception 'Assertion failed: % (got %)', message, coalesce(actual, 'success'); end if;
end; $$;
create function pg_temp.expect_state(statement text, expected text, message text)
returns void language plpgsql as $$ declare actual text; begin
  begin execute statement; exception when others then actual := sqlstate; end;
  if actual is distinct from expected then raise exception 'Assertion failed: % (got %)', message, coalesce(actual, 'success'); end if;
end; $$;
select set_config('test.assistant_user', gen_random_uuid()::text, true);
select set_config('test.assistant_other', gen_random_uuid()::text, true);
select set_config('test.demo_guest', md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), true);
select set_config('test.demo_ip', md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), true);
select set_config('test.caption_count', (select count(*)::text from public.captions), true);
select set_config('test.vote_count', (select count(*)::text from public.votes), true);
insert into auth.users(id, aud, role, email) values
  (current_setting('test.assistant_user')::uuid, 'authenticated', 'authenticated', current_setting('test.assistant_user') || '@example.invalid'),
  (current_setting('test.assistant_other')::uuid, 'authenticated', 'authenticated', current_setting('test.assistant_other') || '@example.invalid');

select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in ('city_margins_private.assistant_requests'::regclass, 'city_margins_private.demo_requests'::regclass)), 'private request tables have RLS');
select pg_temp.assert_true(not has_table_privilege('anon', 'city_margins_private.demo_requests', 'SELECT'), 'guest audit is not public');
select pg_temp.assert_true(not has_table_privilege('authenticated', 'city_margins_private.demo_requests', 'SELECT'), 'members cannot enumerate guest prompts');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.reserve_campus_demo(text,text,text,text,text)', 'EXECUTE'), 'anonymous callers cannot reserve directly');
select pg_temp.assert_true(not has_function_privilege('anon', 'public.check_campus_demo(text,text)', 'EXECUTE'), 'preflight cannot be probed directly');
select pg_temp.assert_true(not has_function_privilege('authenticated', 'public.reserve_campus_assistant(uuid)', 'EXECUTE'), 'members cannot pick another account for quota');
select pg_temp.assert_true(not (select bool_or(prosecdef) from pg_proc where oid in ('public.reserve_campus_assistant(uuid)'::regprocedure, 'public.reserve_campus_demo(text,text,text,text,text)'::regprocedure, 'public.campus_demo_used(text)'::regprocedure, 'public.finish_campus_demo(uuid,text)'::regprocedure)), 'public RPCs never bypass caller privileges');
set local role anon;
select pg_temp.expect_state($$select public.campus_demo_used(current_setting('test.demo_guest'))$$, '42501', 'guest status cannot be probed directly');
select pg_temp.expect_state($$select public.reserve_campus_assistant(current_setting('test.assistant_user')::uuid)$$, '42501', 'anonymous assistant reservation denied');
reset role;

set local role service_role;
select pg_temp.assert_true(not public.campus_demo_used(current_setting('test.demo_guest')), 'new guest can preview');
select pg_temp.assert_true(public.check_campus_demo(current_setting('test.demo_guest'), current_setting('test.demo_ip')) is null, 'preflight accepts unused quota');
select set_config('test.demo_request', public.reserve_campus_demo(current_setting('test.demo_guest'), current_setting('test.demo_ip'), 'Fixture image context.', 'Fixture system instructions.', 'fixture-model')::text, true);
select pg_temp.assert_true(public.campus_demo_used(current_setting('test.demo_guest')), 'pending request already consumes guest quota');
select pg_temp.expect_error($$select public.reserve_campus_demo(current_setting('test.demo_guest'), current_setting('test.demo_ip'), 'Again', 'System', 'model')$$, 'Demo already used.', 'replaying the same guest is rejected');
select public.finish_campus_demo(current_setting('test.demo_request')::uuid, 'A private fixture punchline.');
select public.finish_campus_demo(current_setting('test.demo_request')::uuid, 'An overwrite should not happen.');
select pg_temp.assert_true((select caption = 'A private fixture punchline.' and status = 'completed' from city_margins_private.demo_requests where id = current_setting('test.demo_request')::uuid), 'completion is idempotent');
select public.reserve_campus_demo(md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), current_setting('test.demo_ip'), 'Second image', 'System', 'model');
select public.reserve_campus_demo(md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), current_setting('test.demo_ip'), 'Third image', 'System', 'model');
select pg_temp.expect_error($$select public.reserve_campus_demo(md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), current_setting('test.demo_ip'), 'Fourth image', 'System', 'model')$$, 'Demo network limit reached.', 'fresh cookies cannot bypass network cap');
select pg_temp.assert_true(public.check_campus_demo(repeat('e',64), current_setting('test.demo_ip')) = 'Demo network limit reached.', 'preflight stops network exhaustion before image decoding');
select pg_temp.expect_state($$select public.reserve_campus_demo('raw-unhashed-identity', repeat('a',64), 'Image', 'System', 'model')$$, '23514', 'raw identities cannot enter the audit table');
insert into city_margins_private.demo_requests(guest_hash, ip_hash, prompt, system_prompt, model)
select md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), 'Shared budget fixture', 'System', 'model'
from generate_series(1, greatest(0, 20 - (select count(*)::integer from city_margins_private.demo_requests where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')));
select pg_temp.expect_error($$select public.reserve_campus_demo(md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), repeat('b',64), 'Image', 'System', 'model')$$, 'Demo shared limit reached.', 'global demo spending has a hard cap');
select pg_temp.expect_error($$select public.reserve_campus_assistant(null)$$, 'Sign in to use the assistant.', 'assistant requires an account identity');
select public.reserve_campus_assistant(current_setting('test.assistant_user')::uuid) from generate_series(1,20);
select pg_temp.expect_error($$select public.reserve_campus_assistant(current_setting('test.assistant_user')::uuid)$$, 'Assistant account limit reached.', 'assistant stops at20 requests per account');
insert into city_margins_private.assistant_requests(user_id)
select current_setting('test.assistant_other')::uuid
from generate_series(1, greatest(0,100-(select count(*)::integer from city_margins_private.assistant_requests where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')));
-- Consolidate only fixture account identities so this check reaches the shared
-- branch without touching real activity or resetting the global quota.
update city_margins_private.assistant_requests set user_id = current_setting('test.assistant_user')::uuid where user_id = current_setting('test.assistant_other')::uuid;
select pg_temp.expect_error($$select public.reserve_campus_assistant(current_setting('test.assistant_other')::uuid)$$, 'Assistant shared limit reached.', 'assistant global spending has a hard cap');
reset role;
select set_config('test.assistant_spent', (select count(*)::text from city_margins_private.assistant_requests), true);
delete from auth.users where id = current_setting('test.assistant_user')::uuid;
select pg_temp.assert_true((select count(*)::text = current_setting('test.assistant_spent') from city_margins_private.assistant_requests), 'account deletion does not reset spent global assistant quota');
select pg_temp.assert_true((select count(*)::text = current_setting('test.caption_count') from public.captions), 'practice never publishes to the feed');
select pg_temp.assert_true((select count(*)::text = current_setting('test.vote_count') from public.votes), 'practice never casts real votes');
select 'Campus assistant and demo quota checks passed.' as result;
rollback;
