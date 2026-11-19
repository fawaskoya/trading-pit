begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_anonymous)
values ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'shock@test.local', '', now(), now(), '{}', '{}', false),
       ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', now(), now(), '{}', '{}', true);
insert into public.events (id, name, starting_capital, total_rounds, round_duration_sec, created_by, fee_pct)
values ('e0000000-0000-0000-0000-0000000000c1', 'Shock Fest', 100000, 2, 120, '00000000-0000-0000-0000-0000000000ca', 0);
insert into public.companies (id, event_id, name, ticker, starting_price, current_price)
values ('c0000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 'Alpha Corp', 'ALPHA', 1000, 1000),
       ('c0000000-0000-0000-0000-0000000000c2', 'e0000000-0000-0000-0000-0000000000c1', 'Beta Ltd', 'BETA', 500, 500);
insert into public.rounds (id, event_id, round_no)
values ('a0000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 1),
       ('a0000000-0000-0000-0000-0000000000c2', 'e0000000-0000-0000-0000-0000000000c1', 2);
insert into public.round_notes (round_id, shock_headline, shock_moves)
values ('a0000000-0000-0000-0000-0000000000c1', 'Secret flood', 'ALPHA -10%');
insert into public.teams (id, event_id, name, join_code, user_id)
values ('b0000000-0000-0000-0000-0000000000c1', 'e0000000-0000-0000-0000-0000000000c1', 'SPC-01', 'SSSSSS', '00000000-0000-0000-0000-0000000000c1');

create or replace function pg_temp.login(uid uuid, anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;

\set fire 'select public.fire_act_of_god(''a0000000-0000-0000-0000-0000000000c1'', ''Flood!'', ''Crops lost'', 60, ''[{"company_id":"c0000000-0000-0000-0000-0000000000c1","new_price":900}]''::jsonb)'

-- Before the window opens it can't fire.
select pg_temp.login('00000000-0000-0000-0000-0000000000ca');
select public.release_headline('a0000000-0000-0000-0000-0000000000c1');
select throws_ok(:'fire', 'P0001', 'BAD_STATE', 'cannot fire before the window opens');
select public.open_window('a0000000-0000-0000-0000-0000000000c1');
select pg_temp.logout();

-- Teams can't fire it and can't read the drafts.
select pg_temp.login('00000000-0000-0000-0000-0000000000c1', true);
select throws_ok(:'fire', 'P0001', 'FORBIDDEN', 'a team cannot fire an Act of God');
select is((select count(*)::int from public.round_notes), 0, 'teams cannot read Act of God drafts');
select is((select shock_headline from public.rounds where id = 'a0000000-0000-0000-0000-0000000000c1'), null, 'nothing on the round before it fires');
-- A trade before the shock happens at the old price.
select public.execute_order('c0000000-0000-0000-0000-0000000000c1', 'buy', 10);
select pg_temp.logout();

-- The organiser fires it.
select pg_temp.login('00000000-0000-0000-0000-0000000000ca');
create temp table before_fire as select window_closes_at from public.rounds where id = 'a0000000-0000-0000-0000-0000000000c1';
select lives_ok(:'fire', 'the organiser fires an Act of God during an open window');
select pg_temp.logout();

select is((select current_price from public.companies where id = 'c0000000-0000-0000-0000-0000000000c1'), 900::numeric, 'the price moves at once');
select is((select last_change_pct from public.companies where id = 'c0000000-0000-0000-0000-0000000000c1'), -10::numeric, 'the move shows as the latest change');
select is((select window_closes_at - (select window_closes_at from before_fire) from public.rounds where id = 'a0000000-0000-0000-0000-0000000000c1'), interval '60 seconds', 'the window is extended');
select is((select shock_headline from public.rounds where id = 'a0000000-0000-0000-0000-0000000000c1'), 'Flood!', 'the breaking headline is on the round');
select is((select count(*)::int from public.shock_price_changes where round_id = 'a0000000-0000-0000-0000-0000000000c1'), 1, 'the move is recorded');

-- Trades after the shock use the new price.
select pg_temp.login('00000000-0000-0000-0000-0000000000c1', true);
select is((select price from public.execute_order('c0000000-0000-0000-0000-0000000000c1', 'buy', 5)), 900::numeric, 'a trade after the shock uses the new price');
select pg_temp.logout();

-- Only one per round.
select pg_temp.login('00000000-0000-0000-0000-0000000000ca');
select throws_ok(:'fire', 'P0001', 'SHOCK_USED', 'a second Act of God in the same round is refused');

-- The end-of-round step and its undo still work on top of the shock.
select public.close_window('a0000000-0000-0000-0000-0000000000c1');
select public.apply_round_prices('a0000000-0000-0000-0000-0000000000c1', '[{"company_id":"c0000000-0000-0000-0000-0000000000c1","new_price":800}]'::jsonb);
select is((select old_price from public.price_updates where round_id = 'a0000000-0000-0000-0000-0000000000c1'), 900::numeric, 'end-of-round move starts from the shocked price');
select public.undo_last_price_application('a0000000-0000-0000-0000-0000000000c1');
select is((select current_price from public.companies where id = 'c0000000-0000-0000-0000-0000000000c1'), 900::numeric, 'undo returns to the shocked price, not before it');
select pg_temp.logout();

select * from finish();
rollback;
