-- Trading Pit — all game logic lives here. Clients never write cash/holdings/orders directly.
-- Errors use a machine-readable MESSAGE (e.g. INSUFFICIENT_CASH) and a human HINT.

-- ================================================================ helpers
create or replace function public.is_event_admin(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = p_event_id and created_by = auth.uid());
$$;

create or replace function public.my_team_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.teams where user_id = auth.uid();
$$;

create or replace function public.team_total_value(p_team_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select t.cash + coalesce((
           select sum(h.shares * c.current_price)
           from public.holdings h join public.companies c on c.id = h.company_id
           where h.team_id = t.id), 0)
  from public.teams t where t.id = p_team_id;
$$;

create or replace function public.server_time() returns timestamptz
language sql stable as $$ select now(); $$;

-- ============================================================ team join
-- An (anonymous) authenticated user claims a join code. Re-claiming your own team is allowed
-- so a team can log in again after clearing their browser.
create or replace function public.claim_team(p_join_code text, p_team_name text default null)
returns public.teams
language plpgsql security definer set search_path = public as $$
declare
  v_team public.teams;
  v_code text := upper(regexp_replace(coalesce(p_join_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using hint = 'Please reload the page and try again.';
  end if;

  select * into v_team from public.teams where join_code = v_code for update;
  if not found then
    raise exception 'BAD_CODE' using hint = 'That team code was not found. Check it with your organiser.';
  end if;

  if v_team.user_id is not null and v_team.user_id <> auth.uid() then
    raise exception 'ALREADY_CLAIMED' using hint = 'This team is already logged in on another device. Ask your organiser to reset it.';
  end if;

  if exists (select 1 from public.teams where user_id = auth.uid() and id <> v_team.id) then
    raise exception 'USER_HAS_TEAM' using hint = 'This device is already logged in as another team.';
  end if;

  update public.teams
     set user_id   = auth.uid(),
         name      = coalesce(nullif(trim(p_team_name), ''), name),
         joined_at = coalesce(joined_at, now())
   where id = v_team.id
   returning * into v_team;
  return v_team;
end $$;

-- Admin: detach the device from a team so a new phone can claim it.
create or replace function public.reset_team_login(p_team_id uuid) returns public.teams
language plpgsql security definer set search_path = public as $$
declare v_team public.teams;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found or not public.is_event_admin(v_team.event_id) then
    raise exception 'FORBIDDEN' using hint = 'Only the event admin can do this.';
  end if;
  update public.teams set user_id = null, joined_at = null where id = p_team_id returning * into v_team;
  return v_team;
end $$;

-- ============================================================== trading
create or replace function public.execute_order(p_company_id uuid, p_side public.order_side, p_shares bigint)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_team     public.teams;
  v_event    public.events;
  v_company  public.companies;
  v_round    public.rounds;
  v_held     bigint;
  v_after    bigint;
  v_price    numeric(18,2);
  v_value    numeric(18,2);
  v_fee      numeric(18,2);
  v_total    numeric;
  v_order    public.orders;
begin
  if p_shares is null or p_shares <= 0 then
    raise exception 'INVALID_QUANTITY' using hint = 'Enter a whole number of shares greater than zero.';
  end if;

  -- Serialise all orders for this team; different teams never block each other.
  select * into v_team from public.teams where user_id = auth.uid() for update;
  if not found then
    raise exception 'NO_TEAM' using hint = 'Join a team with your team code first.';
  end if;

  select * into v_event from public.events where id = v_team.event_id;

  select * into v_company from public.companies
   where id = p_company_id and event_id = v_team.event_id;
  if not found then
    raise exception 'UNKNOWN_COMPANY' using hint = 'That company is not part of this event.';
  end if;

  -- The time check is authoritative even if the auto-close job is late.
  select * into v_round from public.rounds
   where event_id = v_team.event_id and state = 'window_open' and now() < window_closes_at;
  if not found then
    raise exception 'WINDOW_CLOSED' using hint = 'Trading is closed right now. Wait for the next window.';
  end if;

  v_price := v_company.current_price;
  v_value := round(v_price * p_shares, 2);
  v_fee   := round(v_value * v_event.fee_pct / 100, 2);

  select coalesce(shares, 0) into v_held from public.holdings
   where team_id = v_team.id and company_id = v_company.id;
  v_held := coalesce(v_held, 0);

  if p_side = 'buy' then
    v_after := v_held + p_shares;
    if v_team.cash < v_value + v_fee then
      raise exception 'INSUFFICIENT_CASH'
        using hint = format('You need ₹%s but only have ₹%s.', to_char(v_value + v_fee, 'FM999,999,999,999.00'), to_char(v_team.cash, 'FM999,999,999,999.00'));
    end if;
    if v_event.max_position_pct < 100 then
      v_total := public.team_total_value(v_team.id) - v_fee;
      if v_after * v_price > v_total * v_event.max_position_pct / 100 then
        raise exception 'POSITION_LIMIT'
          using hint = format('You may hold at most %s%% of your portfolio in one company.', v_event.max_position_pct);
      end if;
    end if;
    update public.teams set cash = cash - v_value - v_fee where id = v_team.id;
  else
    v_after := v_held - p_shares;
    if v_after < 0 and not v_event.allow_short then
      raise exception 'INSUFFICIENT_SHARES'
        using hint = format('You only have %s share(s) to sell.', v_held);
    end if;
    if v_team.cash + v_value - v_fee < 0 then
      raise exception 'INSUFFICIENT_CASH' using hint = 'Not enough cash to cover the fee.';
    end if;
    update public.teams set cash = cash + v_value - v_fee where id = v_team.id;
  end if;

  insert into public.holdings (team_id, company_id, shares)
       values (v_team.id, v_company.id, v_after)
  on conflict (team_id, company_id) do update set shares = excluded.shares;

  insert into public.orders (team_id, round_id, company_id, side, shares, price, value, fee)
       values (v_team.id, v_round.id, v_company.id, p_side, p_shares, v_price, v_value, v_fee)
  returning * into v_order;
  return v_order;
end $$;

-- ================================================== round state machine
create or replace function public._admin_round(p_round_id uuid) returns public.rounds
language plpgsql security definer set search_path = public as $$
declare v_round public.rounds;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Round not found.';
  end if;
  if not public.is_event_admin(v_round.event_id) then
    raise exception 'FORBIDDEN' using hint = 'Only the event admin can do this.';
  end if;
  return v_round;
end $$;

create or replace function public.release_headline(p_round_id uuid) returns public.rounds
language plpgsql security definer set search_path = public as $$
declare v_round public.rounds;
begin
  v_round := public._admin_round(p_round_id);
  if v_round.state <> 'pending' then
    raise exception 'BAD_STATE' using hint = format('Round is already %s.', v_round.state);
  end if;
  if exists (select 1 from public.rounds
              where event_id = v_round.event_id and round_no < v_round.round_no and state <> 'prices_applied') then
    raise exception 'PREVIOUS_ROUND_INCOMPLETE' using hint = 'Finish the earlier round first.';
  end if;
  update public.events set status = 'live' where id = v_round.event_id and status = 'draft';
  update public.rounds set state = 'headline_released' where id = p_round_id returning * into v_round;
  return v_round;
end $$;

create or replace function public.open_window(p_round_id uuid) returns public.rounds
language plpgsql security definer set search_path = public as $$
declare v_round public.rounds; v_dur int;
begin
  v_round := public._admin_round(p_round_id);
  if v_round.state <> 'headline_released' then
    raise exception 'BAD_STATE' using hint = 'Release the headline before opening the window.';
  end if;
  select round_duration_sec into v_dur from public.events where id = v_round.event_id;
  update public.rounds
     set state = 'window_open', window_opens_at = now(), window_closes_at = now() + make_interval(secs => v_dur)
   where id = p_round_id returning * into v_round;
  return v_round;
end $$;

create or replace function public.close_window(p_round_id uuid) returns public.rounds
language plpgsql security definer set search_path = public as $$
declare v_round public.rounds;
begin
  v_round := public._admin_round(p_round_id);
  if v_round.state <> 'window_open' then
    raise exception 'BAD_STATE' using hint = 'The window is not open.';
  end if;
  update public.rounds
     set state = 'window_closed', window_closes_at = least(window_closes_at, now())
   where id = p_round_id returning * into v_round;
  return v_round;
end $$;

-- Idempotent fallback: anyone may call it, it only flips windows whose deadline has passed.
create or replace function public.close_expired_windows() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.rounds set state = 'window_closed'
   where state = 'window_open' and window_closes_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

-- ======================================================= price updates
-- p_prices: [{"company_id": uuid, "new_price": number}, ...]  (subset of companies; others unchanged)
create or replace function public.apply_round_prices(p_round_id uuid, p_prices jsonb) returns public.rounds
language plpgsql security definer set search_path = public as $$
declare
  v_round  public.rounds;
  v_item   jsonb;
  v_cid    uuid;
  v_new    numeric(18,2);
  v_old    numeric(18,2);
  v_total_rounds int;
begin
  v_round := public._admin_round(p_round_id);
  if v_round.state <> 'window_closed' then
    raise exception 'BAD_STATE' using hint = 'Close the trading window before applying prices.';
  end if;
  if p_prices is null or jsonb_typeof(p_prices) <> 'array' then
    raise exception 'INVALID_PRICES' using hint = 'Prices must be a list.';
  end if;

  -- Companies not mentioned stay unchanged: reset their "this round" change to 0.
  update public.companies set last_change_pct = 0 where event_id = v_round.event_id;

  for v_item in select * from jsonb_array_elements(p_prices) loop
    v_cid := (v_item->>'company_id')::uuid;
    v_new := round((v_item->>'new_price')::numeric, 2);
    if v_new is null or v_new <= 0 then
      raise exception 'INVALID_PRICES' using hint = 'Every new price must be greater than zero.';
    end if;
    select current_price into v_old from public.companies
     where id = v_cid and event_id = v_round.event_id for update;
    if not found then
      raise exception 'UNKNOWN_COMPANY' using hint = 'A company in the list does not belong to this event.';
    end if;
    if v_new = v_old then continue; end if;
    insert into public.price_updates (round_id, company_id, old_price, new_price)
         values (p_round_id, v_cid, v_old, v_new);
    update public.companies
       set current_price = v_new,
           last_change_pct = round((v_new - v_old) / v_old * 100, 2)
     where id = v_cid;
  end loop;

  insert into public.portfolio_snapshots (team_id, round_id, cash, holdings_value, total_value)
  select t.id, p_round_id, t.cash,
         coalesce(hv.value, 0),
         t.cash + coalesce(hv.value, 0)
    from public.teams t
    left join lateral (
      select sum(h.shares * c.current_price) as value
        from public.holdings h join public.companies c on c.id = h.company_id
       where h.team_id = t.id) hv on true
   where t.event_id = v_round.event_id;

  update public.rounds set state = 'prices_applied', applied_at = now()
   where id = p_round_id returning * into v_round;

  select total_rounds into v_total_rounds from public.events where id = v_round.event_id;
  if v_round.round_no >= v_total_rounds then
    update public.events set status = 'finished' where id = v_round.event_id;
  end if;
  return v_round;
end $$;

-- Reverts the most recent price application, as long as the next round has not started.
create or replace function public.undo_last_price_application(p_round_id uuid) returns public.rounds
language plpgsql security definer set search_path = public as $$
declare v_round public.rounds; r record;
begin
  v_round := public._admin_round(p_round_id);
  if v_round.state <> 'prices_applied' then
    raise exception 'BAD_STATE' using hint = 'This round has no applied prices to undo.';
  end if;
  if exists (select 1 from public.rounds
              where event_id = v_round.event_id and round_no > v_round.round_no and state <> 'pending') then
    raise exception 'NEXT_ROUND_STARTED' using hint = 'The next round has already begun; prices can no longer be undone.';
  end if;

  for r in select * from public.price_updates where round_id = p_round_id loop
    update public.companies set current_price = r.old_price where id = r.company_id;
  end loop;
  delete from public.price_updates where round_id = p_round_id;
  delete from public.portfolio_snapshots where round_id = p_round_id;

  -- Restore last_change_pct from the previous applied round (0 if none).
  update public.companies c
     set last_change_pct = coalesce((
           select round((pu.new_price - pu.old_price) / pu.old_price * 100, 2)
             from public.price_updates pu join public.rounds rr on rr.id = pu.round_id
            where pu.company_id = c.id and rr.event_id = v_round.event_id and rr.round_no = v_round.round_no - 1), 0)
   where c.event_id = v_round.event_id;

  update public.rounds set state = 'window_closed', applied_at = null
   where id = p_round_id returning * into v_round;
  update public.events set status = 'live' where id = v_round.event_id and status = 'finished';
  return v_round;
end $$;

-- ======================================================= leaderboard view
-- Owner-privileged view (bypasses RLS on teams/holdings) exposing only public-safe columns.
create or replace view public.leaderboard_view with (security_invoker = false) as
  select t.event_id,
         t.id as team_id,
         coalesce(t.name, 'Team ' || t.join_code) as name,
         t.college,
         v.total_value,
         rank() over (partition by t.event_id order by v.total_value desc, o.trade_count asc, t.created_at asc) as rank,
         v.total_value - coalesce(s.total_value, e.starting_capital) as change_this_round,
         case when coalesce(s.total_value, e.starting_capital) > 0
              then round((v.total_value - coalesce(s.total_value, e.starting_capital)) / coalesce(s.total_value, e.starting_capital) * 100, 2)
              else 0 end as change_this_round_pct,
         v.total_value - e.starting_capital as pnl,
         o.trade_count,
         t.joined_at is not null as joined
    from public.teams t
    join public.events e on e.id = t.event_id
    cross join lateral (select public.team_total_value(t.id) as total_value) v
    left join lateral (select count(*)::int as trade_count from public.orders where team_id = t.id) o on true
    -- "this round" compares against the snapshot before the latest applied round
    left join lateral (
      select ps.total_value from public.portfolio_snapshots ps join public.rounds r on r.id = ps.round_id
       where ps.team_id = t.id
       order by r.round_no desc offset 1 limit 1) s on true;

-- Public equity curve (per team per round) — safe columns only.
create or replace view public.equity_curve_view with (security_invoker = false) as
  select ps.team_id, r.event_id, r.round_no, ps.total_value
    from public.portfolio_snapshots ps join public.rounds r on r.id = ps.round_id;
