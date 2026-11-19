import { notFound } from "next/navigation";
import { loadScoreData } from "@/lib/score-data";
import { scoreEvent } from "@/lib/scoring";
import { supabaseServer } from "@/lib/supabase/server";
import { ScoresBoard } from "./scores-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scores" };

export default async function ScoresPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const data = await loadScoreData(await supabaseServer(), eventId);
  if (!data) notFound();
  const scores = scoreEvent(data.input);
  const played = data.rounds.filter((r) => r.state === "prices_applied").length;
  return (
    <ScoresBoard
      eventId={eventId}
      finished={data.event.status === "finished"}
      played={played}
      totalRounds={data.event.total_rounds}
      scores={scores}
      orderCount={data.orders.length}
      activityCount={data.activity.length}
    />
  );
}
