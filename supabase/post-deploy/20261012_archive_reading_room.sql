-- POST-DEPLOY ONLY: run as postgres after the image-first app is deployed and
-- verified without /books or /profile dependencies. Do not add this schema to
-- Supabase's exposed schemas. All legacy rows and stored photo files are kept.
-- To restore: move both tables back to public, rerun 20260929_profiles.sql, and
-- restore only the books grants/read policy from schema.sql (not its seed INSERT).
-- Earlier migrations reference public.books/profiles; do not replay them after
-- this archive without first restoring the tables. This script is rerunnable.
begin;

create schema if not exists city_margins_legacy;
revoke all on schema city_margins_legacy from public, anon, authenticated, service_role;

-- Remove the signup dependency before moving the table used by its function.
drop trigger if exists create_profile_after_signup on auth.users;

do $$
declare
  legacy_table text;
begin
  foreach legacy_table in array array['books', 'profiles'] loop
    if to_regclass(format('public.%I', legacy_table)) is not null then
      if to_regclass(format('city_margins_legacy.%I', legacy_table)) is not null then
        raise exception 'Both public.% and city_margins_legacy.% exist; archive aborted.', legacy_table, legacy_table;
      end if;
      -- PostgreSQL also moves the table's indexes and owned identity sequences.
      execute format('alter table public.%I set schema city_margins_legacy', legacy_table);
    elsif to_regclass(format('city_margins_legacy.%I', legacy_table)) is null then
      raise exception 'Missing legacy table %; archive aborted.', legacy_table;
    end if;
    execute format('alter table city_margins_legacy.%I enable row level security', legacy_table);
  end loop;
end;
$$;

drop trigger if exists set_profile_updated_at on city_margins_legacy.profiles;
-- No CASCADE: an unexpected external dependency aborts the whole transaction.
drop function if exists public.create_profile_for_new_user();
drop function if exists public.set_profile_updated_at();

do $$
declare
  legacy_policy record;
  legacy_column record;
begin
  for legacy_policy in
    select tablename, policyname from pg_catalog.pg_policies
    where schemaname = 'city_margins_legacy' and tablename in ('books', 'profiles')
  loop
    execute format('drop policy %I on city_margins_legacy.%I', legacy_policy.policyname, legacy_policy.tablename);
  end loop;

  -- Table-level REVOKE does not remove the previous profile column grants.
  for legacy_column in
    select c.relname, a.attname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'city_margins_legacy' and c.relkind in ('r', 'p')
      and a.attnum > 0 and not a.attisdropped
  loop
    execute format('revoke all (%I) on table city_margins_legacy.%I from public, anon, authenticated, service_role', legacy_column.attname, legacy_column.relname);
  end loop;
end;
$$;

revoke all on all tables in schema city_margins_legacy from public, anon, authenticated, service_role;
revoke all on all sequences in schema city_margins_legacy from public, anon, authenticated, service_role;
revoke all on all functions in schema city_margins_legacy from public, anon, authenticated, service_role;

-- Remove exactly the policies introduced by the legacy profile migration.
drop policy if exists "Users can read their own profile photos" on storage.objects;
drop policy if exists "Users can upload their own profile photos" on storage.objects;
drop policy if exists "Users can update their own profile photos" on storage.objects;
drop policy if exists "Users can delete their own profile photos" on storage.objects;
update storage.buckets set public = false where id = 'profile-photos';

notify pgrst, 'reload schema';

commit;
