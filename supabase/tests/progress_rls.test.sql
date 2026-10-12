begin;
create extension if not exists pgtap;
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-a@example.invalid','',now(),now(),now()),('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-b@example.invalid','',now(),now(),now()) on conflict(id) do nothing;
select plan(4);
insert into public.progress_events(user_id,event_id,event_type,payload) values ('11111111-1111-4111-8111-111111111111','answer:a','answer','{"itemId":"a","correct":true}'),('22222222-2222-4222-8222-222222222222','answer:b','answer','{"itemId":"b","correct":true}');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is((select count(*)::int from public.progress_events),1,'learner A only sees own event');
select is((select count(*)::int from public.progress_events where event_id='answer:a'),1,'learner A can read own event');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select is((select count(*)::int from public.progress_events),1,'learner B only sees own event');
select is((select count(*)::int from public.progress_events where event_id='answer:a'),0,'learner B cannot read learner A event');
reset role;
rollback;
