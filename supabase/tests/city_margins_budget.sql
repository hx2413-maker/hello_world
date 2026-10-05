-- Run as postgres after both City Margins migrations in a disposable database.
-- Simulates the final two global slots; every fixture is rolled back.
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

create function pg_temp.expect_error(statement text, expected_state text, expected_message text default null)
returns void language plpgsql as $$
declare
  actual_state text;
  actual_message text;
begin
  begin
    execute statement;
  exception when others then
    actual_state := sqlstate;
    actual_message := sqlerrm;
  end;
  if actual_state is distinct from expected_state
    or (expected_message is not null and actual_message is distinct from expected_message) then
    raise exception 'Expected % %, got % %', expected_state, expected_message, actual_state, actual_message;
  end if;
end;
$$;

select set_config('test.budget_user', gen_random_uuid()::text, true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (current_setting('test.budget_user')::uuid, 'authenticated', 'authenticated', current_setting('test.budget_user') || '@example.invalid', '{}'::jsonb, '{}'::jsonb);

insert into public.daily_generation_budget (quota_day, used_attempts)
values ((clock_timestamp() at time zone 'UTC')::date, 98)
on conflict (quota_day) do update set used_attempts = 98;

set local role anon;
select pg_temp.expect_error('select * from public.daily_generation_budget', '42501');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.budget_user'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.budget_user'), 'role', 'authenticated')::text, true);
select pg_temp.expect_error('select * from public.daily_generation_budget', '42501');
select pg_temp.expect_error('update public.daily_generation_budget set used_attempts = 0', '42501');
select pg_temp.expect_error('delete from public.daily_generation_budget', '42501');
select pg_temp.expect_error('select public.enforce_generation_budget()', '42501');
select public.reserve_generation('The ninety-ninth city scene', 'witty', 'prompt', 'system', 'test-model');
select public.reserve_generation('The hundredth city scene', 'poetic', 'prompt', 'system', 'test-model');
select pg_temp.expect_error(
  $$select public.reserve_generation('One city scene too many', 'deadpan', 'prompt', 'system', 'test-model')$$,
  'P0001', 'Daily studio limit reached.');
select pg_temp.assert_true((select count(*) = 2 from public.generation_requests), 'global limit blocks requests before personal quota');
reset role;

select pg_temp.assert_true((select used_attempts = 100 from public.daily_generation_budget where quota_day = (clock_timestamp() at time zone 'UTC')::date), 'global count stops at exactly 100');
delete from auth.users where id = current_setting('test.budget_user')::uuid;
select pg_temp.assert_true((select used_attempts = 100 from public.daily_generation_budget where quota_day = (clock_timestamp() at time zone 'UTC')::date), 'account deletion does not replenish spent global budget');

select 'City Margins global budget tests passed; rolling back fixtures.' as result;
rollback;
