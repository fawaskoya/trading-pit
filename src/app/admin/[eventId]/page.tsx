import { supabaseServer } from "@/lib/supabase/server";
import { ControlRoom } from "./control-room";

export const metadata = { title: "Control room" };

export default async function ControlPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const [{ data: event }, { data: rounds }, { data: companies }, { data: orders }, { data: leaderboard }, { data: teamCount }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    supabase.from("rounds").select("*, round_notes(suggested_moves)").eq("event_id", eventId).order("round_no"),
    supabase.from("companies").select("*").eq("event_id", eventId).order("sort_order"),
    supabase.from("orders").select("id, side, shares, price, value, created_at, team:teams!inner(name, join_code, event_id), company:companies!inner(ticker)").eq("team.event_id", eventId).order("created_at", { ascending: false }).limit(40),
    supabase.from("leaderboard_view").select("*").eq("event_id", eventId).order("rank"),
    supabase.from("teams").select("id, joined_at").eq("event_id", eventId),
  ]);
  if (!event) return null;
  return (
    <ControlRoom
      event={event}
      rounds={(rounds ?? []).map((r) => ({ ...r, suggested_moves: (Array.isArray(r.round_notes) ? r.round_notes[0] : r.round_notes)?.suggested_moves ?? null }))}
      companies={companies ?? []}
      orders={(orders ?? []).map((o) => ({ ...o, team: Array.isArray(o.team) ? o.team[0] : o.team, company: Array.isArray(o.company) ? o.company[0] : o.company }))}
      leaderboard={leaderboard ?? []}
      teams={{ total: teamCount?.length ?? 0, joined: teamCount?.filter((t) => t.joined_at).length ?? 0 }}
    />
  );
}
