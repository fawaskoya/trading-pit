import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Demo mode lets a visitor try the game without credentials (a guest team, or the seeded
 * organiser account). It is OFF unless DEMO_MODE=1 is set on the server, and it needs the
 * service-role key and seed admin login — none of which are configured on the production deploy.
 */
const env = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  adminEmail: process.env.SEED_ADMIN_EMAIL,
  adminPassword: process.env.SEED_ADMIN_PASSWORD,
  eventName: process.env.DEMO_EVENT_NAME ?? "Demo Fest 2026",
});

export function demoEnabled(): boolean {
  const e = env();
  return process.env.DEMO_MODE === "1" && !!e.url && !!e.serviceKey && !!e.adminEmail && !!e.adminPassword;
}

export function demoConfig() {
  if (!demoEnabled()) throw new Error("FORBIDDEN");
  const e = env();
  return { adminEmail: e.adminEmail!, adminPassword: e.adminPassword!, eventName: e.eventName };
}

/** Service-role client: bypasses RLS. Only ever used by demo server actions. */
export function demoServiceClient() {
  if (!demoEnabled()) throw new Error("FORBIDDEN");
  const e = env();
  return createClient<Database>(e.url!, e.serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The seeded demo event (newest, if `pnpm seed` was run more than once). */
export async function findDemoEvent() {
  if (!demoEnabled()) return null;
  const { data } = await demoServiceClient()
    .from("events").select("id, name, status")
    .eq("name", env().eventName)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}
