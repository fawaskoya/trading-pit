import { supabaseServer } from "@/lib/supabase/server";
import { HeadlinesEditor } from "./headlines-editor";

export const metadata = { title: "Headlines" };

export default async function HeadlinesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const { data: rounds } = await supabase.from("rounds").select("*, round_notes(suggested_moves)").eq("event_id", eventId).order("round_no");
  return <HeadlinesEditor rounds={(rounds ?? []).map((r) => ({ ...r, suggested_moves: (Array.isArray(r.round_notes) ? r.round_notes[0] : r.round_notes)?.suggested_moves ?? "" }))} />;
}
