import { supabaseServer } from "@/lib/supabase/server";
import { CompaniesEditor } from "./companies-editor";

export const metadata = { title: "Companies" };

export default async function CompaniesPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const [{ data: companies }, { data: event }] = await Promise.all([
    supabase.from("companies").select("*").eq("event_id", eventId).order("sort_order"),
    supabase.from("events").select("status").eq("id", eventId).single(),
  ]);
  return <CompaniesEditor eventId={eventId} companies={companies ?? []} locked={event?.status !== "draft"} />;
}
