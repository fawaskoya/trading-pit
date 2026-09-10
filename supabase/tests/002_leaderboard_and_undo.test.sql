begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '', now(), now(), '{}', '{}'),
       ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', now(), now(), '{}', '{}'),
       ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', now(), now(), '{}', '{}');
insert into public.events (id, name, starting_capital, total_rounds, round_duration_sec, created_by)
values ('e0000000-0000-0000-0000-000000000001', 'Test Fest', 100000, 1, 60, '00000000-0000-0000-0000-00000000000a');
insert into public.companies (id, event_id, name, ticker, starting_price, current_price)
values ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Infosys', 'INFY', 1000, 1000);
insert into public.rounds (id, event_id, round_no, headline)
values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'IT boom');
insert into public.teams (id, event_id, name, join_code, user_id)
values ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Alpha', 'AAAAAA', '00000000-0000-0000-0000-000000000001'),
       ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Beta',  'BBBBBB', '00000000-0000-0000-0000-000000000002');

create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.release_headline('a0000000-0000-0000-0000-000000000001');
select public.open_window('a0000000-0000-0000-0000-000000000001');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-000000000001');
select public.execute_order('c0000000-0000-0000-0000-000000000001', 'buy', 50);   -- Alpha: 50k INFY + 50k cash
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.close_window('a0000000-0000-0000-0000-000000000001');
select public.apply_round_prices('a0000000-0000-0000-0000-000000000001', '[{"company_id":"c0000000-0000-0000-0000-000000000001","new_price":1200}]');
select pg_temp.logout();

-- Alpha = 50k + 50×1200 = 110k ; Beta = 100k
select results_eq($$select name, rank::int, total_value from public.leaderboard_view order by rank$$,
                  $$values ('Alpha', 1, 110000::numeric), ('Beta', 2, 100000::numeric)$$, 'leaderboard ranks by portfolio value');
select is((select change_this_round from public.leaderboard_view where name = 'Alpha'), 10000::numeric, 'Δ this round vs starting capital');
select is((select status from public.events where id = 'e0000000-0000-0000-0000-000000000001'), 'finished', 'final round finishes the event');
select is((select count(*) from public.portfolio_snapshots where round_id = 'a0000000-0000-0000-0000-000000000001'), 2::bigint, 'snapshot per team');

-- anon can read the leaderboard but not teams/holdings
set local role anon;
select is((select count(*) from public.leaderboard_view), 2::bigint, 'anon reads leaderboard view');
select is((select count(*) from public.teams), 0::bigint, 'anon sees no team rows');
reset role;

-- undo
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select state from public.undo_last_price_application('a0000000-0000-0000-0000-000000000001')), 'window_closed', 'undo returns round to window_closed');
select pg_temp.logout();
select is((select current_price from public.companies where id = 'c0000000-0000-0000-0000-000000000001'), 1000::numeric, 'undo restores the price');
select is((select count(*) from public.portfolio_snapshots), 0::bigint, 'undo removes snapshots');

select * from finish();
rollback;
