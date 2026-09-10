import { supabaseServer } from "@/lib/supabase/server";
import { HeadlinesEditor } from "./headlines-editor";

export const metadata = { title: "Headlines" };

export default async function HeadlinesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const { data: rounds } = await supabase.from("rounds").select("*").eq("event_id", eventId).order("round_no");
  return <HeadlinesEditor rounds={rounds ?? []} />;
}
