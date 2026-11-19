begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_anonymous)
values ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reveal@test.local', '', now(), now(), '{}', '{}', false),
       ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', now(), now(), '{}', '{}', true);
insert into public.events (id, name, starting_capital, total_rounds, round_duration_sec, created_by)
values ('e0000000-0000-0000-0000-0000000000b1', 'Reveal Fest', 100000, 2, 60, '00000000-0000-0000-0000-0000000000ba');
insert into public.companies (id, event_id, name, ticker, starting_price, current_price)
values ('c0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000b1', 'Alpha Corp', 'ALPHA', 1000, 1000),
       ('c0000000-0000-0000-0000-0000000000b2', 'e0000000-0000-0000-0000-0000000000b1', 'Beta Ltd', 'BETA', 500, 500);
insert into public.rounds (id, event_id, round_no)
values ('a0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000b1', 1),
       ('a0000000-0000-0000-0000-0000000000b2', 'e0000000-0000-0000-0000-0000000000b1', 2);
insert into public.teams (id, event_id, name, join_code, user_id)
values ('b0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-0000000000b1', '101', 'RRRRRR', '00000000-0000-0000-0000-0000000000b1');

create or replace function pg_temp.login(uid uuid, anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;
create or replace function pg_temp.visible_companies() returns int language sql as $$
  select count(*)::int from public.companies where event_id = 'e0000000-0000-0000-0000-0000000000b1';
$$;

-- Before trading opens: teams and the projector see no scrips; the organiser sees them all.
select pg_temp.login('00000000-0000-0000-0000-0000000000b1', true);
select is(pg_temp.visible_companies(), 0, 'a team sees no companies before round 1');
select pg_temp.logout();
set local role anon;
select is(pg_temp.visible_companies(), 0, 'the projector sees no companies before round 1');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000ba');
select is(pg_temp.visible_companies(), 2, 'the organiser always sees the companies');

-- Releasing the headline is not enough.
select public.release_headline('a0000000-0000-0000-0000-0000000000b1');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000b1', true);
select is(pg_temp.visible_companies(), 0, 'still hidden after the headline is released');
select pg_temp.logout();

-- Opening the window reveals them, and they stay visible once it closes.
select pg_temp.login('00000000-0000-0000-0000-0000000000ba');
select public.open_window('a0000000-0000-0000-0000-0000000000b1');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000b1', true);
select is(pg_temp.visible_companies(), 2, 'a team sees the companies once trading opens');
select pg_temp.logout();
set local role anon;
select is(pg_temp.visible_companies(), 2, 'the projector sees them too');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000ba');
select public.close_window('a0000000-0000-0000-0000-0000000000b1');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000b1', true);
select is(pg_temp.visible_companies(), 2, 'they stay visible after the window closes');

-- Teams cannot rename themselves (the update silently matches no rows under RLS).
update public.teams set name = 'Wolves' where id = 'b0000000-0000-0000-0000-0000000000b1';
select pg_temp.logout();
select is((select name from public.teams where id = 'b0000000-0000-0000-0000-0000000000b1'), '101', 'a team cannot rename itself');
select pg_temp.login('00000000-0000-0000-0000-0000000000ba');
update public.teams set name = '102' where id = 'b0000000-0000-0000-0000-0000000000b1';
select pg_temp.logout();
select is((select name from public.teams where id = 'b0000000-0000-0000-0000-0000000000b1'), '102', 'the organiser can rename a team');

select * from finish();
rollback;
