begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_anonymous)
values ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'private@test.local', '', now(), now(), '{}', '{}', false),
       ('00000000-0000-0000-0000-0000000000eb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.local', '', now(), now(), '{}', '{}', false),
       ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', now(), now(), '{}', '{}', true),
       ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', now(), now(), '{}', '{}', true);
insert into public.events (id, name, starting_capital, total_rounds, round_duration_sec, created_by, auto_apply_prices)
values ('e0000000-0000-0000-0000-0000000000e1', 'Private Fest', 100000, 2, 120, '00000000-0000-0000-0000-0000000000ea', false);
insert into public.companies (id, event_id, name, ticker, starting_price, current_price)
values ('c0000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-0000000000e1', 'Alpha Corp', 'ALPHA', 1000, 1000);
insert into public.rounds (id, event_id, round_no)
values ('a0000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-0000000000e1', 1),
       ('a0000000-0000-0000-0000-0000000000e2', 'e0000000-0000-0000-0000-0000000000e1', 2);
insert into public.teams (id, event_id, name, join_code, user_id)
values ('b0000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-0000000000e1', 'SPC-01', 'EEEEE1', '00000000-0000-0000-0000-0000000000e1'),
       ('b0000000-0000-0000-0000-0000000000e2', 'e0000000-0000-0000-0000-0000000000e1', 'SPC-02', 'EEEEE2', '00000000-0000-0000-0000-0000000000e2');

create or replace function pg_temp.login(uid uuid, anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claims', '', true); end $$;

-- Teams can't see anyone's equity.
select pg_temp.login('00000000-0000-0000-0000-0000000000e1', true);
select throws_ok($$select * from public.leaderboard_view$$, '42501', null, 'a team cannot read the leaderboard view');
select throws_ok($$select * from public.equity_curve_view$$, '42501', null, 'a team cannot read the equity curve');
select throws_ok($$select public.team_total_value('b0000000-0000-0000-0000-0000000000e2')$$, '42501', null, 'a team cannot look up another team''s value');
select throws_ok($$select * from public.admin_leaderboard('e0000000-0000-0000-0000-0000000000e1')$$, 'P0001', 'FORBIDDEN', 'a team cannot use the organiser leaderboard');
select pg_temp.logout();

-- Another organiser can't either; the event's own organiser can.
select pg_temp.login('00000000-0000-0000-0000-0000000000eb');
select throws_ok($$select * from public.admin_leaderboard('e0000000-0000-0000-0000-0000000000e1')$$, 'P0001', 'FORBIDDEN', 'another organiser cannot see this event''s values');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000ea');
select is((select count(*)::int from public.admin_leaderboard('e0000000-0000-0000-0000-0000000000e1')), 2, 'the organiser sees every team');
select public.release_headline('a0000000-0000-0000-0000-0000000000e1');
select public.open_window('a0000000-0000-0000-0000-0000000000e1');
select pg_temp.logout();

insert into public.score_adjustments (event_id, team_id, section, delta, note) values ('e0000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-0000000000e1', 'A', 1.5, 'Great call');

-- Trade context is recorded.
select pg_temp.login('00000000-0000-0000-0000-0000000000e1', true);
select public.execute_order('c0000000-0000-0000-0000-0000000000e1', 'buy', 50);
select pg_temp.logout();
select is((select cash_before from public.orders where team_id = 'b0000000-0000-0000-0000-0000000000e1'), 100000::numeric, 'cash before the trade is stored');
select is((select portfolio_before from public.orders where team_id = 'b0000000-0000-0000-0000-0000000000e1'), 100000::numeric, 'portfolio before the trade is stored');
select is((select position_pct_after from public.orders where team_id = 'b0000000-0000-0000-0000-0000000000e1'), 50::numeric, 'position size after the trade is stored');
select is((select after_shock from public.orders where team_id = 'b0000000-0000-0000-0000-0000000000e1'), false, 'a trade before any Act of God');
select ok((select seconds_into_window >= 0 from public.orders where team_id = 'b0000000-0000-0000-0000-0000000000e1'), 'seconds into the window is stored');

select pg_temp.login('00000000-0000-0000-0000-0000000000ea');
select public.fire_act_of_god('a0000000-0000-0000-0000-0000000000e1', 'Flood', null, 0, '[]'::jsonb);
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-0000000000e1', true);
select public.execute_order('c0000000-0000-0000-0000-0000000000e1', 'sell', 10);

-- Activity: teams log their own, can't read it, and are rate-limited.
select public.log_activity('open_company', 'c0000000-0000-0000-0000-0000000000e1', '{"from":"market"}');
select is((select count(*)::int from public.team_activity), 0, 'a team cannot read the activity log');
select throws_ok($$insert into public.team_activity (event_id, team_id, kind) values ('e0000000-0000-0000-0000-0000000000e1', 'b0000000-0000-0000-0000-0000000000e2', 'join')$$, '42501', null, 'a team cannot write activity directly');
select public.log_activity('tab_view', null, '{}') from generate_series(1, 200);
select is((select count(*)::int from public.score_adjustments), 0, 'a team cannot read judge adjustments');
select pg_temp.logout();

select is((select after_shock from public.orders where team_id = 'b0000000-0000-0000-0000-0000000000e1' and side = 'sell'), true, 'a trade after the Act of God is marked');
select is((select count(*)::int from public.team_activity where team_id = 'b0000000-0000-0000-0000-0000000000e1'), 120, 'activity is rate-limited at 120 a minute');

select * from finish();
rollback;
