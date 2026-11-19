import { supabaseServer } from "@/lib/supabase/server";
import { flattenRoundNotes } from "@/lib/round-notes";
import { HeadlinesEditor } from "./headlines-editor";

export const metadata = { title: "Headlines" };

export default async function HeadlinesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const [{ data: rounds }, { data: companies }] = await Promise.all([
    supabase.from("rounds").select("*, round_notes(suggested_moves, shock_headline, shock_detail, shock_moves, shock_extend_sec)").eq("event_id", eventId).order("round_no"),
    supabase.from("companies").select("ticker").eq("event_id", eventId),
  ]);
  return <HeadlinesEditor tickers={(companies ?? []).map((c) => c.ticker)} rounds={(rounds ?? []).map(flattenRoundNotes)} />;
}
