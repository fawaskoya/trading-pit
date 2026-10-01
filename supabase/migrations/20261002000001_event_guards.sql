-- Keep team cash in step with the event's starting capital, and stop anonymous (team) sessions
-- from creating events.

-- Teams get their cash from events.starting_capital when they are inserted. If the organiser then
-- edits the starting capital, existing teams kept the old cash while the leaderboard measured P&L
-- against the new figure, so every team started the game "up" or "down". Re-fund untouched teams,
-- and refuse the change once anyone has traded (it would rewrite history).
create or replace function public.events_after_capital_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.orders o join public.teams t on t.id = o.team_id where t.event_id = new.id) then
    raise exception 'CAPITAL_LOCKED' using hint = 'Starting capital is locked once any team has traded.';
  end if;
  update public.teams set cash = new.starting_capital where event_id = new.id;
  return new;
end $$;
revoke execute on function public.events_after_capital_change() from public, anon, authenticated;

create trigger events_after_capital_change after update of starting_capital on public.events
  for each row when (new.starting_capital is distinct from old.starting_capital)
  execute function public.events_after_capital_change();

-- Team phones sign in anonymously; they must not be able to create events of their own.
drop policy "events: owner insert" on public.events;
create policy "events: owner insert" on public.events for insert to authenticated
  with check (created_by = auth.uid() and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);
