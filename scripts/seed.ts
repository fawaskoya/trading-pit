/**
 * Seeds a demo event: 20 Indian large caps, 6 headlines with suggested moves, 6 teams, 1 admin.
 * Usage: pnpm seed   (reads .env.local; needs SUPABASE_SERVICE_ROLE_KEY)
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@tradingpit.local";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "tradingpit";
if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// name, ticker, sector, price (₹, roughly realistic, rounded)
const COMPANIES: [string, string, string, number][] = [
  ["Reliance Industries", "RELIANCE", "Energy", 2950],
  ["Tata Consultancy Services", "TCS", "IT", 3850],
  ["HDFC Bank", "HDFCBANK", "Banking", 1650],
  ["ICICI Bank", "ICICIBANK", "Banking", 1180],
  ["Infosys", "INFY", "IT", 1560],
  ["Bharti Airtel", "AIRTEL", "Telecom", 1420],
  ["ITC", "ITC", "FMCG", 430],
  ["Hindustan Unilever", "HUL", "FMCG", 2480],
  ["Larsen & Toubro", "LT", "Infrastructure", 3600],
  ["Axis Bank", "AXISBANK", "Banking", 1150],
  ["Sun Pharma", "SUNPHARMA", "Pharma", 1620],
  ["Maruti Suzuki", "MARUTI", "Auto", 12400],
  ["Tata Motors", "TATAMOTORS", "Auto", 980],
  ["Bajaj Auto", "BAJAJAUTO", "Auto", 9200],
  ["UltraTech Cement", "ULTRACEMCO", "Cement", 10800],
  ["Asian Paints", "ASIANPAINT", "Consumer", 2900],
  ["Nestlé India", "NESTLEIND", "FMCG", 2450],
  ["Coal India", "COALINDIA", "Energy", 450],
  ["Wipro", "WIPRO", "IT", 470],
  ["Adani Ports", "ADANIPORTS", "Infrastructure", 1350],
];

// headline, detail, suggested % moves by ticker (admin sees these as hints in the price editor)
const HEADLINES: { headline: string; detail: string; moves: Record<string, number> }[] = [
  {
    headline: "Union Budget unveils ₹11 lakh crore infrastructure push",
    detail: "Record capex on roads, ports and housing. Cement, construction and logistics names expected to benefit.",
    moves: { LT: 8, ULTRACEMCO: 7, ADANIPORTS: 6, COALINDIA: 3, ASIANPAINT: 2 },
  },
  {
    headline: "RBI surprises with 50 bps rate hike to tame inflation",
    detail: "Borrowing costs rise. Banks may see margin gains short-term; auto and housing demand could soften.",
    moves: { HDFCBANK: 3, ICICIBANK: 3, AXISBANK: 2, MARUTI: -5, TATAMOTORS: -4, BAJAJAUTO: -4, ULTRACEMCO: -3 },
  },
  {
    headline: "Major cyber attack hits Indian IT services clients",
    detail: "Several global clients pause outsourcing contracts pending security audits. IT stocks under pressure.",
    moves: { TCS: -7, INFY: -8, WIPRO: -9 },
  },
  {
    headline: "Government doubles EV incentives under FAME-III",
    detail: "Subsidies for electric two-wheelers and cars extended to 2030. Auto makers with EV pipelines rally.",
    moves: { TATAMOTORS: 10, BAJAJAUTO: 6, MARUTI: 3, RELIANCE: 2 },
  },
  {
    headline: "Crude oil surges past $110 on Middle East tensions",
    detail: "Fuel and input costs jump. Paint, airline and FMCG margins squeezed; upstream energy gains.",
    moves: { RELIANCE: 5, COALINDIA: 4, ASIANPAINT: -6, HUL: -3, NESTLEIND: -2, MARUTI: -3, AIRTEL: -1 },
  },
  {
    headline: "IMD forecasts strongest monsoon in a decade",
    detail: "Rural demand outlook brightens. FMCG, two-wheelers and consumer names gain; food inflation eases.",
    moves: { HUL: 6, ITC: 5, NESTLEIND: 4, BAJAJAUTO: 4, SUNPHARMA: 2, ICICIBANK: 2 },
  },
];

const TEAMS = [
  ["Bull Run", "St. Xavier's College"],
  ["Nifty Ninjas", "Christ University"],
  ["Sensex Sharks", "Loyola College"],
  ["Dalal Street Dons", "IIM Indore"],
  ["Rupee Raiders", "SRCC"],
  ["Margin Callers", "NMIMS"],
];

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

  const { error: rErr } = await db.from("rounds").insert(
    HEADLINES.map((h, i) => ({
      event_id: event.id,
      round_no: i + 1,
      headline: h.headline,
      headline_detail: h.detail + "\n\nSuggested moves: " +
        Object.entries(h.moves).map(([t, p]) => `${t} ${p > 0 ? "+" : ""}${p}%`).join(", "),
    })),
  );
  if (rErr) throw rErr;

  const { data: teams, error: tErr } = await db
    .from("teams")
    .insert(TEAMS.map(([name, college]) => ({ event_id: event.id, name, college })))
    .select("name, join_code");
  if (tErr) throw tErr;

  console.log(`\nSeeded event "${event.name}" (${event.id})`);
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log("Team join codes:");
  for (const t of teams ?? []) console.log(`  ${t.join_code}  ${t.name}`);
  console.log(`\nDisplay URL: /display/${event.id}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
