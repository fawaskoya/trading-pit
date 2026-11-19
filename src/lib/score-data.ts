import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { ScoreInput, Section } from "@/lib/scoring";

type DB = SupabaseClient<Database>;

/** Supabase returns at most 1,000 rows per request; page through the rest. */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/**
 * Everything the score needs, read as the organiser (RLS returns nothing for anyone else).
 * Used by the Scores page, the printable sheets and the CSV export, so they always agree.
 */
export async function loadScoreData(supabase: DB, eventId: string) {
  const [{ data: event }, { data: rounds }, { data: companies }, { data: teams }, { data: adjustments }] = await Promise.all([
    supabase.from("events").select("id, name, status, starting_capital, total_rounds, created_at").eq("id", eventId).single(),
    supabase.from("rounds").select("id, round_no, state, shock_at, shock_headline, headline, window_opens_at, window_closes_at").eq("event_id", eventId).order("round_no"),
    supabase.from("companies").select("id, ticker, name, starting_price").eq("event_id", eventId).order("sort_order"),
    supabase.from("teams").select("id, name, college, join_code, member_names, joined_at, created_at").eq("event_id", eventId).order("created_at").order("name"),
    supabase.from("score_adjustments").select("team_id, section, delta, note").eq("event_id", eventId),
  ]);
  if (!event) return null;
  const [orders, priceUpdates, shockMoves, activity] = await Promise.all([
    all((a, b) => supabase.from("orders")
      .select("id, team_id, round_id, company_id, side, shares, price, value, fee, created_at, seconds_into_window, after_shock, cash_before, portfolio_before, position_pct_after, teams!inner(event_id)")
      .eq("teams.event_id", eventId).order("id").range(a, b)),
    all((a, b) => supabase.from("price_updates").select("round_id, company_id, old_price, new_price, rounds!inner(event_id)").eq("rounds.event_id", eventId).order("id").range(a, b)),
    all((a, b) => supabase.from("shock_price_changes").select("round_id, company_id, old_price, new_price, rounds!inner(event_id)").eq("rounds.event_id", eventId).order("id").range(a, b)),
    all((a, b) => supabase.from("team_activity").select("id, team_id, round_id, kind, company_id, detail, created_at").eq("event_id", eventId).order("id").range(a, b)),
  ]);

  const input: ScoreInput = {
    startingCapital: Number(event.starting_capital),
    rounds: (rounds ?? []).map((r) => ({ id: r.id, round_no: r.round_no, state: r.state, shock_at: r.shock_at })),
    companies: (companies ?? []).map((c) => ({ id: c.id, ticker: c.ticker, starting_price: Number(c.starting_price) })),
    teams: (teams ?? []).map((t) => ({ id: t.id, name: t.name, college: t.college, join_code: t.join_code })),
    orders: orders.map((o) => ({ team_id: o.team_id, round_id: o.round_id, company_id: o.company_id, side: o.side, shares: Number(o.shares), price: Number(o.price), fee: Number(o.fee), created_at: o.created_at })),
    priceUpdates: priceUpdates.map((p) => ({ round_id: p.round_id, company_id: p.company_id, old_price: Number(p.old_price), new_price: Number(p.new_price) })),
    shockMoves: shockMoves.map((p) => ({ round_id: p.round_id, company_id: p.company_id, old_price: Number(p.old_price), new_price: Number(p.new_price) })),
    activity: activity.map((a) => ({ team_id: a.team_id, round_id: a.round_id, kind: a.kind })),
    adjustments: (adjustments ?? []).map((a) => ({ team_id: a.team_id, section: a.section as Section, delta: Number(a.delta), note: a.note })),
  };
  return { event, rounds: rounds ?? [], companies: companies ?? [], teams: teams ?? [], orders, activity, input };
}
