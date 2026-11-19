import { loadScoreData } from "@/lib/score-data";
import { SECTIONS, scoreEvent } from "@/lib/scoring";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";

/** Organiser-only CSV downloads: scores, every order with its context, and the activity log. */
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return new Response("Sign in as the organiser.", { status: 401 });
  const data = await loadScoreData(supabase, eventId);
  if (!data) return new Response("Not found", { status: 404 });

  const kind = new URL(request.url).searchParams.get("kind") ?? "scores";
  const team = Object.fromEntries(data.teams.map((t) => [t.id, t]));
  const round = Object.fromEntries(data.rounds.map((r) => [r.id, r]));
  const ticker = Object.fromEntries(data.companies.map((c) => [c.id, c.ticker]));
  let body: string;
  if (kind === "orders") {
    body = csv([
      ["time", "round", "team", "college", "side", "ticker", "shares", "price", "value", "fee", "seconds_into_window", "after_act_of_god", "cash_before", "portfolio_before", "position_pct_after"],
      ...data.orders.map((o) => [o.created_at, round[o.round_id]?.round_no, team[o.team_id]?.name, team[o.team_id]?.college, o.side, ticker[o.company_id], o.shares, o.price, o.value, o.fee, o.seconds_into_window, o.after_shock, o.cash_before, o.portfolio_before, o.position_pct_after]),
    ]);
  } else if (kind === "activity") {
    body = csv([
      ["time", "round", "team", "kind", "ticker", "detail"],
      ...data.activity.map((a) => [a.created_at, a.round_id ? round[a.round_id]?.round_no : "", team[a.team_id]?.name, a.kind, a.company_id ? ticker[a.company_id] : "", a.detail]),
    ]);
  } else {
    const scores = scoreEvent(data.input);
    body = csv([
      ["rank", "team", "college", ...SECTIONS.flatMap((s) => [`${s.key} auto`, `${s.key} judge`, `${s.key} final`]), "total_out_of_20", "final_value", "return_pct", "trades", "cash_rounds", "judge_notes"],
      ...scores.map((t) => [t.rank, t.name, t.college, ...SECTIONS.flatMap((s) => [t.sections[s.key].auto, t.sections[s.key].adjust, t.sections[s.key].final]), t.total, Math.round(t.finalValue), (t.returnPct * 100).toFixed(2), t.stats.trades, t.stats.cashRounds,
        SECTIONS.map((s) => t.sections[s.key].note && `${s.key}: ${t.sections[s.key].note}`).filter(Boolean).join(" | ")]),
    ]);
  }
  const safe = data.event.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(body, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${safe}-${kind}.csv"`, "cache-control": "no-store" },
  });
}
