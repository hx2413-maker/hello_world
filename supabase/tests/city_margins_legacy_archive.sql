-- Run as postgres in a disposable database after the post-deploy archive.
-- Run the pre-archive application tests first; they still reference public books
-- and profiles. This test rolls back its temporary signup.
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.assert_true(
  to_regclass('public.books') is null and to_regclass('public.profiles') is null
  and to_regclass('city_margins_legacy.books') is not null
  and to_regclass('city_margins_legacy.profiles') is not null,
  'legacy tables are archived outside public');

select pg_temp.assert_true(not exists (
  select 1 from pg_catalog.pg_class c
  where c.oid in ('city_margins_legacy.books'::regclass, 'city_margins_legacy.profiles'::regclass)
    and not c.relrowsecurity
), 'archived tables retain RLS');

select pg_temp.assert_true(not exists (
  select 1 from pg_catalog.pg_policies where schemaname = 'city_margins_legacy'
    and tablename in ('books', 'profiles')
), 'legacy table policies are removed');

do $$
declare
  app_role text;
  archived_object record;
begin
  foreach app_role in array array['anon', 'authenticated', 'service_role'] loop
    perform pg_temp.assert_true(not has_schema_privilege(app_role, 'city_margins_legacy', 'USAGE, CREATE'), app_role || ' cannot use the archive schema');
    for archived_object in
      select c.oid, c.relkind from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'city_margins_legacy' and c.relkind in ('r', 'p', 'S')
    loop
      if archived_object.relkind = 'S' then
        perform pg_temp.assert_true(not has_sequence_privilege(app_role, archived_object.oid, 'USAGE, SELECT, UPDATE'), app_role || ' has no archived sequence privileges');
      else
        perform pg_temp.assert_true(not has_table_privilege(app_role, archived_object.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'), app_role || ' has no archived table privileges');
        perform pg_temp.assert_true(not has_any_column_privilege(app_role, archived_object.oid, 'SELECT, INSERT, UPDATE, REFERENCES'), app_role || ' has no archived column privileges');
      end if;
    end loop;
  end loop;
end;
$$;

select pg_temp.assert_true(
  to_regprocedure('public.create_profile_for_new_user()') is null
  and to_regprocedure('public.set_profile_updated_at()') is null
  and not exists (
    select 1 from pg_catalog.pg_trigger
    where (tgrelid = 'auth.users'::regclass and tgname = 'create_profile_after_signup')
      or (tgrelid = 'city_margins_legacy.profiles'::regclass and tgname = 'set_profile_updated_at')
  ), 'legacy signup and timestamp hooks are removed');

select pg_temp.assert_true(not exists (
  select 1 from pg_catalog.pg_policies
  where schemaname = 'storage' and tablename = 'objects' and policyname in (
    'Users can read their own profile photos',
    'Users can upload their own profile photos',
    'Users can update their own profile photos',
    'Users can delete their own profile photos'
  )
), 'the four legacy photo policies are removed');
select pg_temp.assert_true((select not public from storage.buckets where id = 'profile-photos'), 'legacy photo bucket is retained and private');

select set_config('test.archive_signup', gen_random_uuid()::text, true);
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values (current_setting('test.archive_signup')::uuid, 'authenticated', 'authenticated', current_setting('test.archive_signup') || '@example.invalid', '{}'::jsonb, '{}'::jsonb);
select pg_temp.assert_true(not exists (
  select 1 from city_margins_legacy.profiles where id = current_setting('test.archive_signup')::uuid
), 'new signup succeeds without recreating a legacy profile');

rollback;
