-- Transactional fixtures only. All tones, users, generations and quota changes roll back.
begin;
create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'Assertion failed: %', message; end if;
end; $$;
create function pg_temp.expect_sqlstate(statement text, expected text, message text)
returns void language plpgsql as $$ declare actual text; begin
  begin execute statement; exception when others then actual := sqlstate; end;
  if actual is distinct from expected then raise exception 'Assertion failed: % (expected %, got %)', message, expected, coalesce(actual,'success'); end if;
end; $$;
select set_config('test.tone_a', gen_random_uuid()::text, true);
select set_config('test.tone_b', gen_random_uuid()::text, true);
insert into auth.users(id,aud,role,email) select id::uuid,'authenticated','authenticated',id || '@example.invalid'
  from unnest(array[current_setting('test.tone_a'),current_setting('test.tone_b')]) id;
select pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.shared_tones'::regclass), 'shared tones enable RLS');
select pg_temp.assert_true(not (select prosecdef from pg_proc where oid='public.reserve_generation(text,text,text,text,text)'::regprocedure), 'reservation public entry is invoker');
select pg_temp.assert_true(not has_function_privilege('anon','city_margins_private.reserve_generation(text,text,text,text,text)','EXECUTE'), 'anonymous cannot invoke reservation helper');
select pg_temp.assert_true(not has_function_privilege('authenticated','city_margins_private.limit_shared_tones()','EXECUTE'), 'trigger cannot be directly invoked');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert_true((select count(*) >= 0 from public.shared_tones), 'anonymous can browse public tone styles');
select pg_temp.expect_sqlstate($q$insert into public.shared_tones(user_id,name,instructions) values (current_setting('test.tone_a')::uuid,'No auth','A campus joke in a dry voice.')$q$,'42501','anonymous cannot save tone');
select pg_temp.expect_sqlstate($q$update public.shared_tones set name='Hijacked'$q$,'42501','anonymous cannot update tones');
select pg_temp.expect_sqlstate($q$delete from public.shared_tones$q$,'42501','anonymous cannot delete tones');
select pg_temp.expect_sqlstate($q$select public.reserve_generation('Campus fixture scene','New tone','Fixture prompt','Fixture system','fixture-model')$q$,'42501','anonymous cannot generate');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.tone_a'),true);
select set_config('request.jwt.claims','{"is_anonymous":false}',true);
insert into public.shared_tones(user_id,name,instructions) values (current_setting('test.tone_a')::uuid,'Overcaffeinated TA','Earnest academic phrasing with a dry punchline.');
select set_config('test.shared_tone',(select id::text from public.shared_tones where user_id=current_setting('test.tone_a')::uuid and name='Overcaffeinated TA'),true);
select pg_temp.assert_true((select created_at is not null from public.shared_tones where id=current_setting('test.shared_tone')::uuid),'server supplies timestamp');
select pg_temp.expect_sqlstate($q$insert into public.shared_tones(user_id,name,instructions) values(current_setting('test.tone_b')::uuid,'Impersonation','Do not permit another owner.')$q$,'42501','members cannot forge another owner');
select pg_temp.expect_sqlstate($q$insert into public.shared_tones(user_id,name,instructions,created_at) values(current_setting('test.tone_a')::uuid,'Forged time','Do not permit forged timestamps.','2000-01-01')$q$,'42501','members cannot forge timestamp');
select pg_temp.expect_sqlstate($q$insert into public.shared_tones(user_id,name,instructions) values(current_setting('test.tone_a')::uuid,'overcaffeinated ta','Case-insensitive names are unique per owner.')$q$,'23505','duplicate own names rejected');
select pg_temp.expect_sqlstate($q$insert into public.shared_tones(user_id,name,instructions) values(current_setting('test.tone_a')::uuid,'A','A name must have at least two characters.')$q$,'23514','short name rejected');
select pg_temp.expect_sqlstate($q$insert into public.shared_tones(user_id,name,instructions) values(current_setting('test.tone_a')::uuid,'Oversized',repeat('x',401))$q$,'23514','oversized style rejected');
select pg_temp.expect_sqlstate($q$update public.shared_tones set user_id=current_setting('test.tone_b')::uuid where id=current_setting('test.shared_tone')::uuid$q$,'42501','owner cannot transfer shared tone');
select pg_temp.expect_sqlstate($q$update public.shared_tones set instructions='Silently changing a shared tone is not allowed.' where id=current_setting('test.shared_tone')::uuid$q$,'42501','saved styles are immutable');
select set_config('test.tone_request',public.reserve_generation('Columbia campus fixture scene','Overcaffeinated TA','Stored fixture style: Earnest academic phrasing with a dry punchline.','Campus fixture system','fixture-model')::text,true);
select pg_temp.assert_true((select vibe='Overcaffeinated TA' and daily_slot=1 from public.generation_requests where id=current_setting('test.tone_request')::uuid),'custom label uses existing quota reservation');
select pg_temp.expect_sqlstate($q$select public.reserve_generation('Campus fixture scene',repeat('x',41),'Fixture prompt','Fixture system','fixture-model')$q$,'22023','oversized generation label rejected');
select pg_temp.expect_sqlstate($q$select public.reserve_generation('Campus fixture scene',E'Tone\nInjection','Fixture prompt','Fixture system','fixture-model')$q$,'22023','multiline generation label rejected');
select pg_temp.expect_sqlstate($q$select public.complete_generation(current_setting('test.tone_request')::uuid,'Forged model output')$q$,'42501','member cannot publish forged AI result');
select set_config('request.jwt.claims','{"is_anonymous":true}',true);
select pg_temp.expect_sqlstate($q$insert into public.shared_tones(user_id,name,instructions) values(current_setting('test.tone_a')::uuid,'Anonymous user','Anonymous-auth users must sign in first.')$q$,'42501','anonymous-auth user cannot save shared tone');
select pg_temp.expect_sqlstate($q$select public.reserve_generation('Campus fixture scene','witty','Fixture prompt','Fixture system','fixture-model')$q$,'42501','anonymous-auth user cannot reserve generation');
select set_config('request.jwt.claims','{"is_anonymous":false}',true);
reset role;

set local role service_role;
select public.complete_generation(current_setting('test.tone_request')::uuid,'A fixture campus joke.',42,10);
select pg_temp.assert_true(public.complete_generation(current_setting('test.tone_request')::uuid,'A different retry body.',42,10)=current_setting('test.tone_request')::uuid,'completion remains idempotent');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.tone_b'),true);
select pg_temp.assert_true((select name='Overcaffeinated TA' and instructions='Earnest academic phrasing with a dry punchline.' from public.shared_tones where id=current_setting('test.shared_tone')::uuid),'another member can reuse saved style');
with removed as (delete from public.shared_tones where id=current_setting('test.shared_tone')::uuid returning id)
select pg_temp.assert_true((select count(*)=0 from removed),'another member cannot delete shared style');
insert into public.shared_tones(user_id,name,instructions) values(current_setting('test.tone_b')::uuid,'Overcaffeinated TA','Another creator can use the same name.');
select pg_temp.assert_true((select count(*)=2 from public.shared_tones where name='Overcaffeinated TA' and user_id in(current_setting('test.tone_a')::uuid,current_setting('test.tone_b')::uuid)),'same names across creators allowed');
select set_config('request.jwt.claim.sub',current_setting('test.tone_a'),true);
insert into public.shared_tones(user_id,name,instructions) select current_setting('test.tone_a')::uuid,'Fixture tone ' || n,'Fixture creative voice for campus memes.' from generate_series(1,19) n;
select pg_temp.expect_sqlstate($q$insert into public.shared_tones(user_id,name,instructions) values(current_setting('test.tone_a')::uuid,'Twenty first tone','The per-account saved tone limit is enforced.')$q$,'P0001','20-tone account limit enforced');
with removed as(delete from public.shared_tones where id=current_setting('test.shared_tone')::uuid returning id)
select pg_temp.assert_true((select count(*)=1 from removed),'owner can remove own tone');
select pg_temp.assert_true((select vibe='Overcaffeinated TA' and body='A fixture campus joke.' from public.captions where id=current_setting('test.tone_request')::uuid),'deleting tone retains original caption snapshot');
select pg_temp.assert_true((select prompt like '%Earnest academic phrasing%' and status='completed' from public.generation_requests where id=current_setting('test.tone_request')::uuid),'deleting tone retains stored prompt and request');
-- Existing five-attempt cap is unchanged after custom-tone support.
select public.reserve_generation('Campus fixture scene','witty','Fixture prompt','Fixture system','fixture-model') from generate_series(1,4);
select pg_temp.expect_sqlstate($q$select public.reserve_generation('Campus fixture scene','A custom tone','Fixture prompt','Fixture system','fixture-model')$q$,'P0001','sixth daily attempt still blocked');
reset role;
rollback;
