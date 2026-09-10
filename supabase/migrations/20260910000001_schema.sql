-- Trading Pit — core schema
-- Money is numeric(18,2) (rupees, paise precision). Shares are whole bigints.

create extension if not exists pgcrypto;

create type public.event_status as enum ('draft', 'live', 'finished');
create type public.round_state  as enum ('pending', 'headline_released', 'window_open', 'window_closed', 'prices_applied');
create type public.order_side   as enum ('buy', 'sell');

-- ---------------------------------------------------------------- events
create table public.events (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(name) between 1 and 120),
  starting_capital   numeric(18,2) not null default 100000000.00 check (starting_capital > 0), -- ₹10 crore
  total_rounds       int  not null default 6 check (total_rounds between 1 and 30),
  round_duration_sec int  not null default 180 check (round_duration_sec between 10 and 3600),
  fee_pct            numeric(5,2) not null default 0 check (fee_pct >= 0 and fee_pct < 100),
  allow_short        boolean not null default false,
  max_position_pct   numeric(5,2) not null default 100 check (max_position_pct between 1 and 100),
  status             public.event_status not null default 'draft',
  created_by         uuid not null references auth.users(id) on delete cascade,
  created_at         timestamptz not null default now()
);

-- ------------------------------------------------------------- companies
create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  name            text not null check (length(name) between 1 and 80),
  ticker          text not null check (ticker ~ '^[A-Z0-9&.-]{1,12}$'),
  sector          text,
  logo_url        text,
  starting_price  numeric(18,2) not null check (starting_price > 0),
  current_price   numeric(18,2) not null check (current_price > 0),
  last_change_pct numeric(8,2) not null default 0,   -- % move from the most recent price application
  sort_order      int  not null default 0,
  unique (event_id, ticker)
);
create index companies_event_idx on public.companies(event_id, sort_order);

-- ---------------------------------------------------------------- rounds
create table public.rounds (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  round_no         int  not null check (round_no >= 1),
  headline         text,
  headline_detail  text,
  state            public.round_state not null default 'pending',
  window_opens_at  timestamptz,
  window_closes_at timestamptz,
  applied_at       timestamptz,
  unique (event_id, round_no)
);
-- Only one round may be "in progress" per event at any time.
create unique index rounds_one_active_per_event
  on public.rounds(event_id)
  where state in ('headline_released', 'window_open', 'window_closed');

-- --------------------------------------------------------- price_updates
create table public.price_updates (
  id         bigserial primary key,
  round_id   uuid not null references public.rounds(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  old_price  numeric(18,2) not null,
  new_price  numeric(18,2) not null check (new_price > 0),
  created_at timestamptz not null default now(),
  unique (round_id, company_id)
);
create index price_updates_company_idx on public.price_updates(company_id, created_at);

-- ----------------------------------------------------------------- teams
create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  name         text check (name is null or length(name) between 1 and 40),
  college      text,
  member_names text[] not null default '{}',
  cash         numeric(18,2) not null default 0,   -- 0 = "fill from event" (see trigger)
  join_code    text not null default '' unique check (join_code ~ '^[A-Z0-9]{6}$'), -- '' = generate (see trigger)
  user_id      uuid unique references auth.users(id) on delete set null,
  joined_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index teams_event_idx on public.teams(event_id);

-- Generate an unambiguous 6-char join code and default cash from the event.
create or replace function public.teams_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text;
begin
  if new.cash is null or new.cash = 0 then
    select starting_capital into new.cash from public.events where id = new.event_id;
  end if;
  if new.join_code is null or new.join_code = '' then
    loop
      code := '';
      for i in 1..6 loop
        code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from public.teams where join_code = code);
    end loop;
    new.join_code := code;
  end if;
  return new;
end $$;
create trigger teams_before_insert before insert on public.teams
  for each row execute function public.teams_before_insert();

-- -------------------------------------------------------------- holdings
create table public.holdings (
  team_id    uuid not null references public.teams(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  shares     bigint not null default 0,
  primary key (team_id, company_id)
);

-- ---------------------------------------------------------------- orders
create table public.orders (
  id         bigserial primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  round_id   uuid not null references public.rounds(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  side       public.order_side not null,
  shares     bigint not null check (shares > 0),
  price      numeric(18,2) not null,
  value      numeric(18,2) not null,   -- shares * price
  fee        numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);
create index orders_round_created_idx on public.orders(round_id, created_at desc);
create index orders_team_idx on public.orders(team_id, created_at desc);

-- --------------------------------------------------- portfolio_snapshots
create table public.portfolio_snapshots (
  team_id        uuid not null references public.teams(id) on delete cascade,
  round_id       uuid not null references public.rounds(id) on delete cascade,
  cash           numeric(18,2) not null,
  holdings_value numeric(18,2) not null,
  total_value    numeric(18,2) not null,
  created_at     timestamptz not null default now(),
  primary key (team_id, round_id)
);
