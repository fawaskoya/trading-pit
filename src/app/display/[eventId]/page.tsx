import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { DisplayBoard } from "./display-board";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("events").select("name").eq("id", eventId).maybeSingle();
  return { title: data ? `${data.name} — Live board` : "Live board" };
}

export default async function DisplayPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { eventId } = await params;
  const { view } = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: event }, { data: rounds }, { data: companies }, { data: leaders }, { data: curve }] = await Promise.all([
    supabase.from("events").select("id, name, status, total_rounds, starting_capital").eq("id", eventId).maybeSingle(),
    supabase.from("rounds").select("id, round_no, headline, headline_detail, state, window_closes_at").eq("event_id", eventId).order("round_no"),
    supabase.from("companies").select("id, name, ticker, sector, current_price, last_change_pct").eq("event_id", eventId).order("sort_order"),
    supabase.from("leaderboard_view").select("team_id, name, college, total_value, rank, change_this_round, change_this_round_pct, pnl").eq("event_id", eventId).order("rank"),
    supabase.from("equity_curve_view").select("team_id, round_no, total_value").eq("event_id", eventId).order("round_no"),
  ]);
  if (!event) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return <DisplayBoard host={host} event={event} rounds={rounds ?? []} companies={companies ?? []} leaders={leaders ?? []} curve={curve ?? []} pinned={view === "leaderboard" || view === "headline" || view === "prices" ? view : null} />;
}
