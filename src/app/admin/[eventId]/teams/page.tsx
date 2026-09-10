import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { TeamsManager } from "./teams-manager";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const { data: teams } = await supabase.from("teams").select("id, name, college, join_code, joined_at, cash").eq("event_id", eventId).order("created_at");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return <TeamsManager eventId={eventId} teams={teams ?? []} origin={origin} />;
}
