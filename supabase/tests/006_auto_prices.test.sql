begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_anonymous)
values ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auto@test.local', '', now(), now(), '{}', '{}', false),
       ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', now(), now(), '{}', '{}', true);
insert into public.events (id, name, starting_capital, total_rounds, round_duration_sec, created_by)
values ('e0000000-0000-0000-0000-0000000000d1', 'Auto Fest', 100000, 3, 60, '00000000-0000-0000-0000-0000000000da');
insert into public.companies (id, event_id, name, ticker, starting_price, current_price)
values ('c0000000-0000-0000-0000-0000000000d1', 'e0000000-0000-0000-0000-0000000000d1', 'Alpha Corp', 'ALPHA', 1000, 1000),
       ('c0000000-0000-0000-0000-0000000000d2', 'e0000000-0000-0000-0000-0000000000d1', 'Beta Ltd', 'BETA', 500, 500);
insert into public.rounds (id, event_id, round_no)
values ('a0000000-0000-0000-0000-0000000000d1', 'e0000000-0000-0000-0000-0000000000d1', 1),
       ('a0000000-0000-0000-0000-0000000000d2', 'e0000000-0000-0000-0000-0000000000d1', 2),
       ('a0000000-0000-0000-0000-0000000000d3', 'e0000000-0000-0000-0000-0000000000d1', 3);
insert into public.round_notes (round_id, suggested_moves)
values ('a0000000-0000-0000-0000-0000000000d1', 'suggested moves: alpha +10%, BETA -20%, NOPE +5%, rubbish, ALPHA +20%'),
       ('a0000000-0000-0000-0000-0000000000d2', 'ALPHA -50%, BETA +10%'),
       ('a0000000-0000-0000-0000-0000000000d3', 'BETA +10%');
insert into public.teams (id, event_id, name, join_code, user_id)
values ('b0000000-0000-0000-0000-0000000000d1', 'e0000000-0000-0000-0000-0000000000d1', 'SPC-01', 'DDDDDD', '00000000-0000-0000-0000-0000000000d1');

create or replace function pg_temp.login(uid uuid, anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;

-- The planned-move parser: unknown tickers and junk skipped, a repeated ticker (last wins), % applied to current prices.
select is((select jsonb_array_length(public.planned_prices('a0000000-0000-0000-0000-0000000000d1'))), 2, 'parser keeps the two known tickers');
select is((select (e->>'new_price')::numeric from jsonb_array_elements(public.planned_prices('a0000000-0000-0000-0000-0000000000d1')) e where e->>'company_id' = 'c0000000-0000-0000-0000-0000000000d1'), 1200::numeric, 'a repeated ticker: the last value wins');
select is((select (e->>'new_price')::numeric from jsonb_array_elements(public.planned_prices('a0000000-0000-0000-0000-0000000000d1')) e where e->>'company_id' = 'c0000000-0000-0000-0000-0000000000d2'), 400::numeric, 'a negative move');

-- Clients can't call the internals.
select pg_temp.login('00000000-0000-0000-0000-0000000000d1', true);
select throws_ok($$select public.auto_finish_round('a0000000-0000-0000-0000-0000000000d1')$$, '42501', null, 'a team cannot call auto_finish_round directly');
select pg_temp.logout();

-- Round 1: no Act of God. The window expires; any browser calling close_expired_windows finishes the round.
select pg_temp.login('00000000-0000-0000-0000-0000000000da');
select public.release_headline('a0000000-0000-0000-0000-0000000000d1');
select public.open_window('a0000000-0000-0000-0000-0000000000d1');
select pg_temp.logout();
update public.rounds set window_closes_at = now() - interval '1 second' where id = 'a0000000-0000-0000-0000-0000000000d1';
select pg_temp.login('00000000-0000-0000-0000-0000000000d1', true);
select is(public.close_expired_windows(), 1, 'the timer path closes the expired window');
select pg_temp.logout();
select is((select state::text from public.rounds where id = 'a0000000-0000-0000-0000-0000000000d1'), 'prices_applied', 'the round finishes by itself');
select is((select current_price from public.companies where id = 'c0000000-0000-0000-0000-0000000000d1'), 1200::numeric, 'planned prices were applied');
select is((select count(*)::int from public.portfolio_snapshots where round_id = 'a0000000-0000-0000-0000-0000000000d1'), 1, 'snapshots were recorded');
select is(public.close_expired_windows(), 0, 'calling it again does nothing');

-- Round 2: manual "Close window now" also finishes it; Undo works afterwards.
select pg_temp.login('00000000-0000-0000-0000-0000000000da');
select public.release_headline('a0000000-0000-0000-0000-0000000000d2');
select public.open_window('a0000000-0000-0000-0000-0000000000d2');
select is((select state::text from public.close_window('a0000000-0000-0000-0000-0000000000d2')), 'prices_applied', 'manual close finishes the round too');
select public.undo_last_price_application('a0000000-0000-0000-0000-0000000000d2');
select is((select current_price from public.companies where id = 'c0000000-0000-0000-0000-0000000000d1'), 1200::numeric, 'undo restores prices after an automatic finish');
select is((select state::text from public.rounds where id = 'a0000000-0000-0000-0000-0000000000d2'), 'window_closed', 'undo leaves the round at window_closed');
select pg_temp.logout();

-- Round 2 again is now a manual round (window closed, nothing to do automatically): the organiser can still finish it by hand.
select pg_temp.login('00000000-0000-0000-0000-0000000000da');
select lives_ok($$select public.apply_round_prices('a0000000-0000-0000-0000-0000000000d2', '[]'::jsonb)$$, 'the organiser can still finish a round by hand');

-- Round 3: an Act of God fired, so the round is NOT auto-applied.
select public.release_headline('a0000000-0000-0000-0000-0000000000d3');
select public.open_window('a0000000-0000-0000-0000-0000000000d3');
select public.fire_act_of_god('a0000000-0000-0000-0000-0000000000d3', 'Flood', 'Crops lost', 30, '[{"company_id":"c0000000-0000-0000-0000-0000000000d2","new_price":300}]'::jsonb);
select public.close_window('a0000000-0000-0000-0000-0000000000d3');
select is((select state::text from public.rounds where id = 'a0000000-0000-0000-0000-0000000000d3'), 'window_closed', 'after an Act of God the round waits for the organiser');
select public.apply_round_prices('a0000000-0000-0000-0000-0000000000d3', '[]'::jsonb);
select is((select current_price from public.companies where id = 'c0000000-0000-0000-0000-0000000000d2'), 300::numeric, 'finishing with no extra moves keeps the shocked price');
select pg_temp.logout();

select * from finish();
rollback;
