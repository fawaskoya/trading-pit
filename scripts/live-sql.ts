/**
 * Prints one SQL script that sets up the hosted project's events: by default two demo events for practice and
 * the main game-day event. Each gets 10 trap rounds with Act of God drafts, the 20 companies and the
 * SPC-01..SPC-15 teams (with their own join codes). Any earlier events with these names, and the old
 * "Demo Fest 2026", are replaced. No credentials are used or created: the events are owned by the project's
 * one organiser account.
 *
 * Usage: pnpm tsx scripts/live-sql.ts > live-demo.sql                         (the default three events)
 *        pnpm tsx scripts/live-sql.ts "Demo Event 1" "Trading Pit — Game Day"  (choose your own names)
 * Then paste it into the Supabase SQL Editor, or run it with `supabase db push --linked --include-seed`.
 */
import { COMPANIES, HEADLINES, TEAMS, fmtMoves } from "./seed-data";

const DEFAULT_EVENTS = ["Demo Event 1", "Demo Event 2", "Trading Pit — Game Day"];
/** Removed too, so the organiser is left with exactly the events above. */
const RETIRED = ["Demo Fest 2026"];

const names = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_EVENTS;
const q = (s: string | null | undefined) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);

const out: string[] = [];
out.push(`-- Trading Pit: set up ${names.length} fresh event${names.length === 1 ? "" : "s"}: ${names.join(", ")}.
-- Each has 10 rounds, 20 companies, Act of God drafts and teams SPC-01..SPC-15 with their own join codes.
-- Paste into Supabase > SQL Editor > Run (or: supabase db push --linked --include-seed).
-- It runs as one transaction: if anything fails, nothing changes.
begin;

do $$
declare
  v_owner uuid;
  v_count int;
  v_event uuid;
  v_round uuid;
begin
  -- The events are owned by the project's organiser: the one real (non-anonymous) account.
  select count(*) into v_count from auth.users where email is not null and not coalesce(is_anonymous, false);
  if v_count <> 1 then
    raise exception 'Expected exactly one organiser account but found %. Nothing was changed.', v_count;
  end if;
  select id into v_owner from auth.users where email is not null and not coalesce(is_anonymous, false);

  -- Replace earlier copies (their teams, trades and results go with them).
  delete from public.events where created_by = v_owner and name in (${[...names, ...RETIRED].map(q).join(", ")});
`);

for (const eventName of names) {
  out.push(`
  -- ======================================================== ${eventName}
  insert into public.events (name, created_by, total_rounds, round_duration_sec)
  values (${q(eventName)}, v_owner, ${HEADLINES.length}, 180) returning id into v_event;`);
  COMPANIES.forEach(([name, ticker, sector, price], i) => {
    out.push(`  insert into public.companies (event_id, name, ticker, sector, starting_price, current_price, sort_order) values (v_event, ${q(name)}, ${q(ticker)}, ${q(sector)}, ${price}, ${price}, ${i});`);
  });
  HEADLINES.forEach((h, i) => {
    const s = h.shock;
    out.push(`  insert into public.rounds (event_id, round_no, headline, headline_detail) values (v_event, ${i + 1}, ${q(h.headline)}, ${q(h.detail)}) returning id into v_round;`);
    out.push(`  insert into public.round_notes (round_id, suggested_moves, shock_headline, shock_detail, shock_moves, shock_extend_sec) values (v_round, ${q(fmtMoves(h.moves))}, ${q(s?.headline)}, ${q(s?.detail)}, ${s ? q(fmtMoves(s.moves)) : "null"}, ${s?.extend_sec ?? 60});`);
  });
  TEAMS.forEach(([name, captain, college]) => {
    out.push(`  insert into public.teams (event_id, name, college, member_names) values (v_event, ${q(name)}, ${college ? q(college) : "null"}, ${captain ? `array[${q(captain)}]` : "'{}'"});`);
  });
}

out.push(`end $$;

commit;

-- Check: every event with its teams' fresh join codes.
select e.name as event, t.name as team, t.join_code
  from public.teams t join public.events e on e.id = t.event_id
 where e.name in (${names.map(q).join(", ")})
 order by e.name, t.name;
`);
console.log(out.join("\n"));
