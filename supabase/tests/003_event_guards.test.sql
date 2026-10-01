begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_anonymous)
values ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'guards@test.local', '', now(), now(), '{}', '{}', false),
       ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', now(), now(), '{}', '{}', true);
insert into public.events (id, name, starting_capital, total_rounds, round_duration_sec, created_by)
values ('e0000000-0000-0000-0000-0000000000a1', 'Guard Fest', 100000, 1, 60, '00000000-0000-0000-0000-0000000000aa');
insert into public.companies (id, event_id, name, ticker, starting_price, current_price)
values ('c0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a1', 'Alpha Corp', 'ALPHA', 1000, 1000);
insert into public.rounds (id, event_id, round_no) values ('a0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a1', 1);
insert into public.teams (id, event_id, name, join_code, user_id)
values ('b0000000-0000-0000-0000-0000000000a1', 'e0000000-0000-0000-0000-0000000000a1', 'Gamma', 'GGGGGG', '00000000-0000-0000-0000-0000000000a1');

create or replace function pg_temp.login(uid uuid, anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;

-- Organiser changes the starting capital before anyone trades: existing teams are re-funded.
select pg_temp.login('00000000-0000-0000-0000-0000000000aa');
update public.events set starting_capital = 250000 where id = 'e0000000-0000-0000-0000-0000000000a1';
select pg_temp.logout();
select is((select cash from public.teams where id = 'b0000000-0000-0000-0000-0000000000a1'), 250000::numeric, 'capital change re-funds untouched teams');
select is((select pnl from public.leaderboard_view where team_id = 'b0000000-0000-0000-0000-0000000000a1'), 0::numeric, 'P&L stays zero after a capital change');

-- After a trade the capital is locked.
select pg_temp.login('00000000-0000-0000-0000-0000000000aa');
select public.release_headline('a0000000-0000-0000-0000-0000000000a1');
select public.open_window('a0000000-0000-0000-0000-0000000000a1');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000a1', true);
select public.execute_order('c0000000-0000-0000-0000-0000000000a1', 'buy', 10);
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000aa');
select throws_ok($$update public.events set starting_capital = 500000 where id = 'e0000000-0000-0000-0000-0000000000a1'$$, 'CAPITAL_LOCKED', 'capital is locked once a team has traded');
select lives_ok($$update public.events set name = 'Guard Fest II' where id = 'e0000000-0000-0000-0000-0000000000a1'$$, 'other settings still editable');
select pg_temp.logout();

-- Anonymous (team) sessions cannot create events; organisers can.
select pg_temp.login('00000000-0000-0000-0000-0000000000a1', true);
select throws_ok($$insert into public.events (name, created_by) values ('Rogue', '00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'anonymous users cannot create events');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000aa');
select lives_ok($$insert into public.events (name, created_by) values ('Second', '00000000-0000-0000-0000-0000000000aa')$$, 'organisers can create events');
select pg_temp.logout();

select * from finish();
rollback;
