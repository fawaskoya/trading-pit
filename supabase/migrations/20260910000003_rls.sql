-- Trading Pit — Row Level Security, grants, realtime, cron

alter table public.events              enable row level security;
alter table public.companies           enable row level security;
alter table public.rounds              enable row level security;
alter table public.price_updates       enable row level security;
alter table public.teams               enable row level security;
alter table public.holdings            enable row level security;
alter table public.orders              enable row level security;
alter table public.portfolio_snapshots enable row level security;

-- Ledger tables are written only by security-definer functions.
revoke insert, update, delete on public.holdings, public.orders, public.price_updates, public.portfolio_snapshots
  from anon, authenticated;
revoke update on public.teams from anon, authenticated;
grant  update (name, college, member_names) on public.teams to authenticated;

-- ---------------------------------------------------------------- events
create policy "events: public read"   on public.events for select using (true);
create policy "events: owner insert"  on public.events for insert to authenticated with check (created_by = auth.uid());
create policy "events: owner update"  on public.events for update to authenticated using (created_by = auth.uid());
create policy "events: owner delete"  on public.events for delete to authenticated using (created_by = auth.uid());

-- ------------------------------------------------------------- companies
create policy "companies: public read" on public.companies for select using (true);
create policy "companies: admin write" on public.companies for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- ---------------------------------------------------------------- rounds
-- Pending rounds (unreleased headlines) are visible only to the admin.
create policy "rounds: read released or admin" on public.rounds for select
  using (state <> 'pending' or public.is_event_admin(event_id));
create policy "rounds: admin write" on public.rounds for all to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- --------------------------------------------------------- price_updates
create policy "price_updates: public read" on public.price_updates for select using (true);

-- ----------------------------------------------------------------- teams
create policy "teams: own or admin read" on public.teams for select to authenticated
  using (user_id = auth.uid() or public.is_event_admin(event_id));
create policy "teams: admin insert" on public.teams for insert to authenticated
  with check (public.is_event_admin(event_id));
create policy "teams: own or admin update" on public.teams for update to authenticated
  using (user_id = auth.uid() or public.is_event_admin(event_id));
create policy "teams: admin delete" on public.teams for delete to authenticated
  using (public.is_event_admin(event_id));

-- -------------------------------------------------- holdings / orders / snapshots
create policy "holdings: own or admin read" on public.holdings for select to authenticated
  using (team_id = public.my_team_id()
         or exists (select 1 from public.teams t where t.id = team_id and public.is_event_admin(t.event_id)));
create policy "orders: own or admin read" on public.orders for select to authenticated
  using (team_id = public.my_team_id()
         or exists (select 1 from public.teams t where t.id = team_id and public.is_event_admin(t.event_id)));
create policy "snapshots: own or admin read" on public.portfolio_snapshots for select to authenticated
  using (team_id = public.my_team_id()
         or exists (select 1 from public.teams t where t.id = team_id and public.is_event_admin(t.event_id)));

-- ---------------------------------------------------------------- views
grant select on public.leaderboard_view, public.equity_curve_view to anon, authenticated;

-- ------------------------------------------------------------- functions
revoke execute on all functions in schema public from public, anon;
grant execute on function public.server_time()            to anon, authenticated;
grant execute on function public.close_expired_windows()  to anon, authenticated;
grant execute on function public.claim_team(text, text)   to authenticated;
grant execute on function public.execute_order(uuid, public.order_side, bigint) to authenticated;
grant execute on function public.is_event_admin(uuid)     to authenticated;
grant execute on function public.my_team_id()             to authenticated;
grant execute on function public.team_total_value(uuid)   to anon, authenticated; -- needed by leaderboard_view
grant execute on function public.reset_team_login(uuid)   to authenticated;
grant execute on function public.release_headline(uuid)   to authenticated;
grant execute on function public.open_window(uuid)        to authenticated;
grant execute on function public.close_window(uuid)       to authenticated;
grant execute on function public.apply_round_prices(uuid, jsonb) to authenticated;
grant execute on function public.undo_last_price_application(uuid) to authenticated;
revoke execute on function public._admin_round(uuid) from authenticated;

-- -------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.rounds, public.companies, public.teams, public.holdings, public.orders;
alter table public.holdings replica identity full;
alter table public.teams    replica identity full;

-- ------------------------------------------------------------------ cron
-- Fallback auto-close (1-minute resolution). execute_order enforces the deadline regardless.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('trading-pit-close-windows', '* * * * *', $$select public.close_expired_windows()$$);
