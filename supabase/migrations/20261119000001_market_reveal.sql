-- Teams see only their own portfolio until the organiser opens round 1's trading window.
-- Before that the scrips (companies) are hidden — from team phones and from the projector —
-- so nobody can research or plan against the list ahead of the first headline.
--
-- Team names are the organiser's to set (chest numbers), so teams can no longer name or rename
-- themselves.

-- True once any round of the event has had its trading window opened. Stays true for the rest of
-- the event (undo only steps a round back to 'window_closed').
create or replace function public.market_opened(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rounds
     where event_id = p_event_id and state in ('window_open', 'window_closed', 'prices_applied'));
$$;
-- Policy helper: Realtime evaluates policies as the subscriber's role, including anon (projector).
revoke execute on function public.market_opened(uuid) from public;
grant execute on function public.market_opened(uuid) to anon, authenticated;

drop policy "companies: public read" on public.companies;
create policy "companies: read once trading opens" on public.companies for select
  using (public.market_opened(event_id) or public.is_event_admin(event_id));

-- Only the organiser renames teams.
drop policy "teams: own or admin update" on public.teams;
create policy "teams: admin update" on public.teams for update to authenticated
  using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));

-- claim_team keeps its signature (older clients may still send a name) but ignores the name.
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
         joined_at = coalesce(joined_at, now())
   where id = v_team.id
   returning * into v_team;
  return v_team;
end $$;
