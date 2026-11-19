"use server";
import { redirect } from "next/navigation";
import { demoConfig, demoEnabled, demoServiceClient, findDemoEvent } from "@/lib/demo";
import { friendlyError } from "@/lib/errors";
import { teamJoinPath } from "@/lib/paths";
import { supabaseServer } from "@/lib/supabase/server";

type DemoResult = { ok: false; error: string };
const MAX_GUEST_TEAMS = 60;
const NO_DEMO = "The demo isn't set up on this server. Run `pnpm seed` and set DEMO_MODE=1.";

/** Creates a fresh guest team in the demo event and sends the visitor to its one-tap join link. */
export async function joinDemoAsGuest(): Promise<DemoResult> {
  let joinCode: string;
  try {
    if (!demoEnabled()) return { ok: false, error: NO_DEMO };
    const event = await findDemoEvent();
    if (!event) return { ok: false, error: NO_DEMO };
    const db = demoServiceClient();
    const { count } = await db.from("teams").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("college", "Guest");
    if ((count ?? 0) >= MAX_GUEST_TEAMS) return { ok: false, error: "The demo is full right now. Ask the organiser for a team code." };
    const { data: team, error } = await db.from("teams")
      .insert({ event_id: event.id, name: `Guest ${(count ?? 0) + 1}`, college: "Guest" })
      .select("join_code").single();
    if (error) throw error;
    joinCode = team.join_code;
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  redirect(teamJoinPath(joinCode));
}

/** Signs this browser in as the seeded demo organiser and opens the demo event's control room. */
export async function openDemoAsOrganiser(): Promise<DemoResult> {
  let eventId: string;
  try {
    if (!demoEnabled()) return { ok: false, error: NO_DEMO };
    const event = await findDemoEvent();
    if (!event) return { ok: false, error: NO_DEMO };
    const { adminEmail, adminPassword } = demoConfig();
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    if (error) throw error;
    eventId = event.id;
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
  redirect(`/admin/${eventId}`);
}
