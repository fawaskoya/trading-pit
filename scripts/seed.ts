/**
 * Seeds a demo event: 20 Indian large caps, 10 trap headlines (3 with an Act of God) and suggested moves, 10 teams (chest numbers), 1 admin.
 * Usage: pnpm seed   (reads .env.local; needs SUPABASE_SERVICE_ROLE_KEY)
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { COMPANIES, HEADLINES, TEAMS, fmtMoves } from "./seed-data";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@tradingpit.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "tradingpit";
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });


async function ensureAdmin() {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === adminEmail);
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: "admin" },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const adminId = await ensureAdmin();

  // Idempotent: wipe a previous demo event.
  await db.from("events").delete().eq("name", "Demo Fest 2026").eq("created_by", adminId);

  const { data: event, error: eErr } = await db
    .from("events")
    .insert({ name: "Demo Fest 2026", created_by: adminId, total_rounds: HEADLINES.length, round_duration_sec: 180 })
    .select()
    .single();
  if (eErr) throw eErr;

  const { error: cErr } = await db.from("companies").insert(
    COMPANIES.map(([name, ticker, sector, price], i) => ({
      event_id: event.id, name, ticker, sector, starting_price: price, current_price: price, sort_order: i,
    })),
  );
  if (cErr) throw cErr;

  const { data: rounds, error: rErr } = await db.from("rounds").insert(
    HEADLINES.map((h, i) => ({ event_id: event.id, round_no: i + 1, headline: h.headline, headline_detail: h.detail })),
  ).select("id, round_no");
  if (rErr) throw rErr;
  // Private organiser hints live in round_notes, which teams can never read.
  const { error: nErr } = await db.from("round_notes").insert(
    (rounds ?? []).map((r) => ({
      round_id: r.id,
      suggested_moves: fmtMoves(HEADLINES[r.round_no - 1].moves),
      // Every row carries every column, so a bulk insert never sends NULL for the NOT NULL extra-time column.
      shock_headline: HEADLINES[r.round_no - 1].shock?.headline ?? null,
      shock_detail: HEADLINES[r.round_no - 1].shock?.detail ?? null,
      shock_moves: HEADLINES[r.round_no - 1].shock ? fmtMoves(HEADLINES[r.round_no - 1].shock!.moves) : null,
      shock_extend_sec: HEADLINES[r.round_no - 1].shock?.extend_sec ?? 60,
    })),
  );
  if (nErr) throw nErr;

  const { data: teams, error: tErr } = await db
    .from("teams")
    .insert(TEAMS.map(([name, captain, college]) => ({ event_id: event.id, name, college, member_names: [captain] })))
    .select("name, join_code, member_names");
  if (tErr) throw tErr;

  console.log(`\nSeeded event "${event.name}" (${event.id})`);
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log("Team join codes (one-tap link: /join/<code>):");
  for (const t of teams ?? []) console.log(`  ${t.join_code}  ${t.name}  ${t.member_names[0] ?? ""}`);
  console.log(`\nDisplay URL: /display/${event.id}`);
  console.log("Set DEMO_MODE=1 in .env.local to add a no-login \"Try the demo\" panel to the home page.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
