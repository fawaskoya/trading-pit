import { supabaseServer } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) return null;
  return <SettingsForm event={event} />;
}
