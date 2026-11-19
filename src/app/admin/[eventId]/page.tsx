import { supabaseServer } from "@/lib/supabase/server";
import { flattenRoundNotes } from "@/lib/round-notes";
import { ControlRoom } from "./control-room";

export const metadata = { title: "Control room" };

const ORDER_COLUMNS = "id, round_id, side, shares, price, value, created_at, team:teams!inner(id, name, join_code, event_id), company:companies!inner(id, ticker)" as const;

export default async function ControlPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const [{ data: event }, { data: rounds }, { data: companies }, { data: leaderboard }, { data: teamCount }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    supabase.from("rounds").select("*, round_notes(suggested_moves, shock_headline, shock_detail, shock_moves, shock_extend_sec)").eq("event_id", eventId).order("round_no"),
    supabase.from("companies").select("*").eq("event_id", eventId).order("sort_order"),
    supabase.rpc("admin_leaderboard", { p_event_id: eventId }),  // organiser-only: teams never see each other's values
    supabase.from("teams").select("id, joined_at").eq("event_id", eventId),
  ]);
  if (!event) return null;

  // During a round the organiser sees every order of that round (for the order-flow panel);
  // between rounds, just the most recent ones.
  const active = (rounds ?? []).find((r) => r.state !== "prices_applied" && r.state !== "pending");
  const ordersQuery = supabase.from("orders").select(ORDER_COLUMNS).eq("team.event_id", eventId).order("created_at", { ascending: false });
  const { data: orders } = active ? await ordersQuery.eq("round_id", active.id).limit(2000) : await ordersQuery.limit(40);

  return (
    <ControlRoom
      event={event}
      rounds={(rounds ?? []).map(flattenRoundNotes)}
      companies={companies ?? []}
      orders={(orders ?? []).map((o) => ({ ...o, team: Array.isArray(o.team) ? o.team[0] : o.team, company: Array.isArray(o.company) ? o.company[0] : o.company }))}
      leaderboard={leaderboard ?? []}
      teams={{ total: teamCount?.length ?? 0, joined: teamCount?.filter((t) => t.joined_at).length ?? 0 }}
    />
  );
}
