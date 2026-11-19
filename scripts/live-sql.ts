/**
 * Prints one SQL script that creates the demo event (10 trap rounds, Acts of God, 20 companies,
 * SPC-01..SPC-10 teams) on a hosted project. Paste it into the Supabase dashboard's SQL editor.
 * No credentials are used or created: the event is owned by an organiser account you already have.
 * Usage: pnpm tsx scripts/live-sql.ts > live-demo.sql
 */
import { COMPANIES, HEADLINES, TEAMS, fmtMoves } from "./seed-data";

const q = (s: string | null | undefined) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);

const out: string[] = [];
out.push(`-- Trading Pit: replace the old demo with the 10-round chest-number event.
-- 1. Replace YOUR_ORGANISER_EMAIL below with the email you sign in with at /login?as=organiser.
-- 2. Paste the whole script into Supabase > SQL Editor > Run. It runs as one transaction:
--    if anything fails, nothing changes.
begin;

do $$
declare
  v_owner uuid;
  v_event uuid;
  v_round uuid;
begin
  select id into v_owner from auth.users where email = 'YOUR_ORGANISER_EMAIL' and not coalesce(is_anonymous, false);
  if v_owner is null then
    raise exception 'No organiser account with that email. Edit YOUR_ORGANISER_EMAIL at the top of this script.';
  end if;

  -- The old game (teams, trades and results go with it).
  delete from public.events where name = 'Demo Fest 2026';

  insert into public.events (name, created_by, total_rounds, round_duration_sec)
  values ('Demo Fest 2026', v_owner, ${HEADLINES.length}, 180) returning id into v_event;
`);
COMPANIES.forEach(([name, ticker, sector, price], i) => {
  out.push(`  insert into public.companies (event_id, name, ticker, sector, starting_price, current_price, sort_order) values (v_event, ${q(name)}, ${q(ticker)}, ${q(sector)}, ${price}, ${price}, ${i});`);
});
out.push("");
HEADLINES.forEach((h, i) => {
  const s = h.shock;
  out.push(`  insert into public.rounds (event_id, round_no, headline, headline_detail) values (v_event, ${i + 1}, ${q(h.headline)}, ${q(h.detail)}) returning id into v_round;`);
  out.push(`  insert into public.round_notes (round_id, suggested_moves, shock_headline, shock_detail, shock_moves, shock_extend_sec) values (v_round, ${q(fmtMoves(h.moves))}, ${q(s?.headline)}, ${q(s?.detail)}, ${s ? q(fmtMoves(s.moves)) : "null"}, ${s?.extend_sec ?? 60});`);
});
out.push("");
TEAMS.forEach(([name, captain, college]) => {
  out.push(`  insert into public.teams (event_id, name, college, member_names) values (v_event, ${q(name)}, ${q(college)}, array[${q(captain)}]);`);
});
out.push(`end $$;

commit;

-- Check: should list 10 teams with fresh join codes.
select t.name, t.join_code, t.college from public.teams t join public.events e on e.id = t.event_id where e.name = 'Demo Fest 2026' order by t.name;
`);
console.log(out.join("\n"));
