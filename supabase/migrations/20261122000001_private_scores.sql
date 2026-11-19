-- Equity is private, every move is recorded, and judges can adjust the score.
--
-- 1. No public leaderboard: only the event's organiser can see other teams' values or ranks.
-- 2. Each trade stores the context it was made in (timing, Act of God, portfolio size), and the team
--    screen logs what teams look at and try, so the game can be scored on decisions, not just equity.
-- 3. Judges' adjustments to the automatic score out of 20 are stored per team and section.

-- ------------------------------------------------------------------ privacy
revoke select on public.leaderboard_view, public.equity_curve_view from anon, authenticated;
-- Called directly it would hand out any team's value; only security-definer code needs it now.
revoke execute on function public.team_total_value(uuid) from anon, authenticated;

create or replace function public.admin_leaderboard(p_event_id uuid) returns setof public.leaderboard_view
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event_id) then
    raise exception 'FORBIDDEN' using hint = 'Only the organiser can see every team''s value.';
  end if;
  return query select * from public.leaderboard_view where event_id = p_event_id order by rank;
end $$;

create or replace function public.admin_equity_curve(p_event_id uuid) returns setof public.equity_curve_view
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_event_admin(p_event_id) then
    raise exception 'FORBIDDEN' using hint = 'Only the organiser can see every team''s value.';
  end if;
  return query select * from public.equity_curve_view where event_id = p_event_id order by round_no;
end $$;
revoke execute on function public.admin_leaderboard(uuid), public.admin_equity_curve(uuid) from public, anon;
grant execute on function public.admin_leaderboard(uuid), public.admin_equity_curve(uuid) to authenticated;

-- ------------------------------------------------------------ trade context
alter table public.orders
  add column seconds_into_window int,
  add column after_shock         boolean,
  add column cash_before         numeric(18,2),
  add column portfolio_before    numeric(18,2),
  add column position_pct_after  numeric(7,2);

-- Same rules as before; it now also records the context of the trade.
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
  v_before   numeric;
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

  v_price  := v_company.current_price;
  v_value  := round(v_price * p_shares, 2);
  v_fee    := round(v_value * v_event.fee_pct / 100, 2);
  v_before := public.team_total_value(v_team.id);

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
      v_total := v_before - v_fee;
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

  insert into public.orders (team_id, round_id, company_id, side, shares, price, value, fee,
                             seconds_into_window, after_shock, cash_before, portfolio_before, position_pct_after)
       values (v_team.id, v_round.id, v_company.id, p_side, p_shares, v_price, v_value, v_fee,
               greatest(0, extract(epoch from now() - coalesce(v_round.window_opens_at, now()))::int),
               v_round.shock_at is not null,
               v_team.cash,
               v_before,
               case when v_before - v_fee > 0 then round(v_after * v_price / (v_before - v_fee) * 100, 2) end)
  returning * into v_order;
  return v_order;
end $$;

-- ------------------------------------------------------------- activity log
create table public.team_activity (
  id         bigserial primary key,
  event_id   uuid not null references public.events(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  round_id   uuid references public.rounds(id) on delete set null,
  kind       text not null check (kind in ('join', 'reconnect', 'open_company', 'close_company_no_trade', 'order_failed', 'tab_view')),
  company_id uuid references public.companies(id) on delete set null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index team_activity_team_idx on public.team_activity(team_id, created_at);
create index team_activity_event_idx on public.team_activity(event_id, created_at);
alter table public.team_activity enable row level security;
revoke insert, update, delete on public.team_activity from anon, authenticated;
create policy "team_activity: admin read" on public.team_activity for select to authenticated
  using (public.is_event_admin(event_id));

-- Teams write their own activity only through this, and never faster than 2 rows a second on average.
create or replace function public.log_activity(p_kind text, p_company_id uuid default null, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team  public.teams;
  v_round uuid;
begin
  select * into v_team from public.teams where user_id = auth.uid();
  if not found then return; end if;
  if (select count(*) from public.team_activity
       where team_id = v_team.id and created_at > now() - interval '1 minute') >= 120 then
    return;
  end if;
  select id into v_round from public.rounds
   where event_id = v_team.event_id and state in ('headline_released', 'window_open', 'window_closed')
   limit 1;
  insert into public.team_activity (event_id, team_id, round_id, kind, company_id, detail)
  values (v_team.event_id, v_team.id, v_round, p_kind,
          (select id from public.companies where id = p_company_id and event_id = v_team.event_id),
          case when p_detail is null or length(p_detail::text) > 2000 then '{}'::jsonb else p_detail end);
end $$;
revoke execute on function public.log_activity(text, uuid, jsonb) from public, anon;
grant execute on function public.log_activity(text, uuid, jsonb) to authenticated;

-- -------------------------------------------------------- judge adjustments
create table public.score_adjustments (
  event_id   uuid not null references public.events(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  section    text not null check (section in ('A', 'B', 'C', 'D')),
  delta      numeric(3,1) not null default 0 check (delta between -2 and 2),
  note       text check (length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (team_id, section)
);
alter table public.score_adjustments enable row level security;
create policy "score_adjustments: admin only" on public.score_adjustments for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
