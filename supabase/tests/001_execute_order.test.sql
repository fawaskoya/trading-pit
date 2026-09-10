begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '', now(), now(), now(), '{}', '{}'),
       ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, now(), now(), '{}', '{}'),
       ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '', null, now(), now(), '{}', '{}');

insert into public.events (id, name, starting_capital, total_rounds, round_duration_sec, fee_pct, created_by)
values ('e0000000-0000-0000-0000-000000000001', 'Test Fest', 100000, 2, 60, 0.5, '00000000-0000-0000-0000-00000000000a');

insert into public.companies (id, event_id, name, ticker, starting_price, current_price)
values ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Infosys', 'INFY', 1234.55, 1234.55),
       ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Reliance', 'RIL', 2500.00, 2500.00);

insert into public.rounds (id, event_id, round_no, headline)
values ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'IT boom'),
       ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'Rate hike');

insert into public.teams (id, event_id, name, join_code)
values ('b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Alpha', 'AAAAAA'),
       ('b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Beta',  'BBBBBB');

-- helper to impersonate a user
create or replace function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- join
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select is((select name from public.claim_team('aaa-aaa', 'Alpha Wolves')), 'Alpha Wolves', 'claim_team normalises the code and sets the name');
select throws_like($$select public.claim_team('ZZZZZZ')$$, 'BAD_CODE', 'unknown code is rejected');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-000000000002');
select throws_like($$select public.claim_team('AAAAAA')$$, 'ALREADY_CLAIMED', 'a claimed team cannot be taken by another user');
select lives_ok($$select public.claim_team('BBBBBB')$$, 'second user claims second team');
select pg_temp.logout();

-- ---------------------------------------------------------------- window closed
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select throws_like($$select public.execute_order('c0000000-0000-0000-0000-000000000001', 'buy', 1)$$, 'WINDOW_CLOSED', 'no trading while round is pending');
select pg_temp.logout();

-- ---------------------------------------------------------------- state machine (admin)
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select throws_like($$select public.release_headline('a0000000-0000-0000-0000-000000000001')$$, 'FORBIDDEN', 'a team cannot drive the round');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_like($$select public.open_window('a0000000-0000-0000-0000-000000000001')$$, 'BAD_STATE', 'cannot open window before headline release');
select is((select state from public.release_headline('a0000000-0000-0000-0000-000000000001')), 'headline_released', 'headline released');
select throws_like($$select public.release_headline('a0000000-0000-0000-0000-000000000002')$$, 'PREVIOUS_ROUND_INCOMPLETE', 'only one active round at a time');
select is((select state from public.open_window('a0000000-0000-0000-0000-000000000001')), 'window_open', 'window opened');
select ok((select window_closes_at - window_opens_at = interval '60 seconds' from public.rounds where id = 'a0000000-0000-0000-0000-000000000001'), 'window length comes from the event');
select pg_temp.logout();

-- ---------------------------------------------------------------- trading
select pg_temp.login('00000000-0000-0000-0000-000000000001');
-- 3 × 1234.55 = 3703.65 ; fee 0.5% = 18.51825 → 18.52
select is((select fee from public.execute_order('c0000000-0000-0000-0000-000000000001', 'buy', 3)), 18.52::numeric, 'fee rounds half-up to paise');
select is((select cash from public.teams where id = 'b0000000-0000-0000-0000-000000000001'), (100000 - 3703.65 - 18.52)::numeric, 'cash debited value + fee');
select is((select shares from public.holdings where team_id = 'b0000000-0000-0000-0000-000000000001' and company_id = 'c0000000-0000-0000-0000-000000000001'), 3::bigint, 'holdings upserted');
select throws_like($$select public.execute_order('c0000000-0000-0000-0000-000000000002', 'buy', 1000)$$, 'INSUFFICIENT_CASH', 'cannot spend more than cash');
select throws_like($$select public.execute_order('c0000000-0000-0000-0000-000000000001', 'sell', 4)$$, 'INSUFFICIENT_SHARES', 'cannot sell more than held');
select throws_like($$select public.execute_order('c0000000-0000-0000-0000-000000000001', 'buy', 0)$$, 'INVALID_QUANTITY', 'zero shares rejected');
select throws_like($$select public.execute_order('c0000000-0000-0000-0000-000000000001', 'buy', -5)$$, 'INVALID_QUANTITY', 'negative shares rejected');
select lives_ok($$select public.execute_order('c0000000-0000-0000-0000-000000000001', 'sell', 3)$$, 'selling exactly what you hold works');
select is((select shares from public.holdings where team_id = 'b0000000-0000-0000-0000-000000000001' and company_id = 'c0000000-0000-0000-0000-000000000001'), 0::bigint, 'holdings back to zero');
select is((select count(*) from public.orders where team_id = 'b0000000-0000-0000-0000-000000000001'), 2::bigint, 'two orders recorded');
-- team 2 buys Reliance and holds it through the price update
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000002');
select lives_ok($$select public.execute_order('c0000000-0000-0000-0000-000000000002', 'buy', 10)$$, 'team 2 buys 10 RIL');
select pg_temp.logout();

-- ---------------------------------------------------------------- expiry is authoritative
update public.rounds set window_closes_at = now() - interval '1 second' where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select throws_like($$select public.execute_order('c0000000-0000-0000-0000-000000000001', 'buy', 1)$$, 'WINDOW_CLOSED', 'orders after the deadline are rejected even if state is still window_open');
select pg_temp.logout();
select is(public.close_expired_windows(), 1, 'cron fallback closes the expired window');

-- ---------------------------------------------------------------- price application
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select state from public.apply_round_prices('a0000000-0000-0000-0000-000000000001',
            '[{"company_id":"c0000000-0000-0000-0000-000000000002","new_price":2750}]')), 'prices_applied', 'prices applied');
select pg_temp.logout();
select is((select current_price from public.companies where id = 'c0000000-0000-0000-0000-000000000002'), 2750::numeric, 'RIL moved');
select is((select current_price from public.companies where id = 'c0000000-0000-0000-0000-000000000001'), 1234.55::numeric, 'INFY untouched');

select * from finish();
rollback;
