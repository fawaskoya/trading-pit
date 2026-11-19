-- Automatic round-end prices.
--
-- A normal round (no Act of God fired) finishes by itself: the moment its trading window closes,
-- the % moves the organiser planned for it (round_notes.suggested_moves, e.g. "TCS -7%, INFY +3%")
-- are applied and the round is done. After an Act of God the organiser's shock already moved prices,
-- so the round is left for a single "Finish round" click instead of being auto-applied.
-- Organisers can switch this off per event (events.auto_apply_prices).

alter table public.events add column auto_apply_prices boolean not null default true;

-- ---------------------------------------------------------------- core apply
-- The body of apply_round_prices without the organiser check, so the timer path can use it too.
-- Not callable by clients: only the security-definer functions below reach it.
create or replace function public._apply_round_prices_core(p_round_id uuid, p_prices jsonb) returns public.rounds
language plpgsql security definer set search_path = public as $$
declare
  v_round  public.rounds;
  v_item   jsonb;
  v_cid    uuid;
  v_new    numeric(18,2);
  v_old    numeric(18,2);
  v_total_rounds int;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found then
    raise exception 'NOT_FOUND' using hint = 'Round not found.';
  end if;
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
revoke execute on function public._apply_round_prices_core(uuid, jsonb) from public, anon, authenticated;

create or replace function public.apply_round_prices(p_round_id uuid, p_prices jsonb) returns public.rounds
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_round(p_round_id);  -- organiser-only
  return public._apply_round_prices_core(p_round_id, p_prices);
end $$;

-- ------------------------------------------------------------- planned moves
-- "TCS -7%, INFY +3%" → [{company_id, new_price}] from the companies' current prices.
-- Unknown tickers and unreadable fragments are skipped; a ticker listed twice: the last one wins.
create or replace function public.planned_prices(p_round_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_event uuid;
  v_text  text;
  v_part  text;
  m       text[];
  v_cid   uuid;
  v_cur   numeric;
  v_new   numeric;
  v_map   jsonb := '{}'::jsonb;
begin
  select r.event_id, n.suggested_moves into v_event, v_text
    from public.rounds r left join public.round_notes n on n.round_id = r.id
   where r.id = p_round_id;
  v_text := regexp_replace(coalesce(v_text, ''), '^\s*suggested moves?:', '', 'i');

  for v_part in select trim(x) from unnest(regexp_split_to_array(v_text, '[,;\n]')) as x loop
    continue when v_part = '';
    m := regexp_match(v_part, '^([A-Za-z0-9&.-]+)\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*%?$');
    continue when m is null;
    v_cid := null;
    select id, current_price into v_cid, v_cur from public.companies
     where event_id = v_event and upper(ticker) = upper(m[1]);
    continue when v_cid is null;
    v_new := round(v_cur * (1 + m[2]::numeric / 100), 2);
    continue when v_new <= 0;
    v_map := v_map || jsonb_build_object(v_cid::text, v_new);
  end loop;

  return coalesce((select jsonb_agg(jsonb_build_object('company_id', k, 'new_price', v)) from jsonb_each(v_map) as e(k, v)), '[]'::jsonb);
end $$;
revoke execute on function public.planned_prices(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------- auto finish
-- Idempotent and row-locked: whoever gets there first applies; everyone else finds the round done.
create or replace function public.auto_finish_round(p_round_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_round public.rounds;
  v_auto  boolean;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if not found or v_round.state <> 'window_closed' or v_round.shock_at is not null then return; end if;
  select auto_apply_prices into v_auto from public.events where id = v_round.event_id;
  if not coalesce(v_auto, false) then return; end if;
  perform public._apply_round_prices_core(p_round_id, public.planned_prices(p_round_id));
end $$;
revoke execute on function public.auto_finish_round(uuid) from public, anon, authenticated;

-- Timer path: anyone's browser (or cron) may call it; it only acts on windows whose deadline passed.
create or replace function public.close_expired_windows() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  r record;
begin
  for r in
    with closed as (
      update public.rounds set state = 'window_closed'
       where state = 'window_open' and window_closes_at <= now()
      returning id)
    select id from closed
  loop
    n := n + 1;
    perform public.auto_finish_round(r.id);
  end loop;
  return n;
end $$;

-- Manual "Close window now" finishes the round the same way.
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
   where id = p_round_id;
  perform public.auto_finish_round(p_round_id);
  select * into v_round from public.rounds where id = p_round_id;
  return v_round;
end $$;
