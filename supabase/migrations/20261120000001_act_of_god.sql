-- "Act of God": a round within a round. While a trading window is open the organiser can fire one
-- breaking-news shock per round. It moves prices immediately (trades after it use the new prices),
-- adds time to the window, and shows a BREAKING banner on every phone and the projector.
--
-- Drafts are written ahead of time in round_notes (organiser-only). The shock text is copied onto the
-- round only when it fires, so teams learn of it through the round updates they already receive.

alter table public.events alter column total_rounds set default 10;

alter table public.round_notes
  add column shock_headline   text,
  add column shock_detail     text,
  add column shock_moves      text,
  add column shock_extend_sec int not null default 60 check (shock_extend_sec between 0 and 600);

alter table public.rounds
  add column shock_headline   text,
  add column shock_detail     text,
  add column shock_extend_sec int,
  add column shock_at         timestamptz;

-- Kept apart from price_updates (one row per company per round), so the end-of-round price step and
-- its undo behave exactly as before. A shock only ever happens inside an open window, i.e. after the
-- companies are public, so these rows are safe to show to everyone.
create table public.shock_price_changes (
  id         bigserial primary key,
  round_id   uuid not null references public.rounds(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  old_price  numeric(18,2) not null,
  new_price  numeric(18,2) not null check (new_price > 0),
  created_at timestamptz not null default now(),
  unique (round_id, company_id)
);
alter table public.shock_price_changes enable row level security;
revoke insert, update, delete on public.shock_price_changes from anon, authenticated;
create policy "shock_price_changes: public read" on public.shock_price_changes for select using (true);

create or replace function public.fire_act_of_god(
  p_round_id uuid, p_headline text, p_detail text, p_extend_sec int, p_prices jsonb)
returns public.rounds
language plpgsql security definer set search_path = public as $$
declare
  v_round public.rounds;
  v_item  jsonb;
  v_cid   uuid;
  v_new   numeric(18,2);
  v_old   numeric(18,2);
begin
  v_round := public._admin_round(p_round_id);  -- organiser-only, locks the round
  if v_round.state <> 'window_open' or v_round.window_closes_at <= now() then
    raise exception 'BAD_STATE' using hint = 'An Act of God can only fire while the trading window is open.';
  end if;
  if v_round.shock_at is not null then
    raise exception 'SHOCK_USED' using hint = 'This round has already had its Act of God.';
  end if;
  if nullif(trim(coalesce(p_headline, '')), '') is null or length(p_headline) > 200 or length(coalesce(p_detail, '')) > 2000 then
    raise exception 'INVALID_SHOCK' using hint = 'Give the Act of God a headline (up to 200 characters).';
  end if;
  if p_extend_sec is null or p_extend_sec not between 0 and 600 then
    raise exception 'INVALID_SHOCK' using hint = 'Extra time must be between 0 and 600 seconds.';
  end if;
  if p_prices is null or jsonb_typeof(p_prices) <> 'array' then
    raise exception 'INVALID_PRICES' using hint = 'Prices must be a list.';
  end if;

  -- The market list now shows only what the shock moved.
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
    insert into public.shock_price_changes (round_id, company_id, old_price, new_price)
         values (p_round_id, v_cid, v_old, v_new);
    update public.companies
       set current_price = v_new, last_change_pct = round((v_new - v_old) / v_old * 100, 2)
     where id = v_cid;
  end loop;

  update public.rounds
     set shock_headline   = trim(p_headline),
         shock_detail     = nullif(trim(coalesce(p_detail, '')), ''),
         shock_extend_sec = p_extend_sec,
         shock_at         = now(),
         window_closes_at = window_closes_at + make_interval(secs => p_extend_sec)
   where id = p_round_id
   returning * into v_round;
  return v_round;
end $$;
revoke execute on function public.fire_act_of_god(uuid, text, text, int, jsonb) from public, anon;
grant execute on function public.fire_act_of_god(uuid, text, text, int, jsonb) to authenticated;
