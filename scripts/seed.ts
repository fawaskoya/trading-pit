/**
 * Seeds a demo event: 20 Indian large caps, 10 trap headlines (3 with an Act of God) and suggested moves, 10 teams (chest numbers), 1 admin.
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

// The ten rounds come in reward → trap pairs. A reward round's obvious trade pays off; the next round
// offers an even more bullish follow-up on the same stocks, and the organiser's prices punish it. The
// round after explains what went wrong. Rounds 4, 7 and 9 also carry an Act of God the organiser fires
// mid-window. `moves` are the organiser's private end-of-round hints (% by ticker).
type Shock = { headline: string; detail: string; moves: Record<string, number>; extend_sec: number };
const HEADLINES: { headline: string; detail: string; moves: Record<string, number>; shock?: Shock }[] = [
  {
    headline: "Union Budget unveils ₹11 lakh crore infrastructure push",
    detail: "Record capex on roads, ports and housing. Cement, construction and logistics names expected to benefit.",
    moves: { LT: 8, ULTRACEMCO: 7, ADANIPORTS: 6, COALINDIA: 3 },
  },
  {
    headline: "Govt fast-tracks ₹2 lakh crore highway tenders — L&T seen as front-runner",
    detail: "The road ministry will award 40 mega projects this quarter. Brokerages raise L&T and UltraTech targets by 20%.",
    moves: { LT: -7, ULTRACEMCO: -5, ADANIPORTS: -3, HDFCBANK: 1 },
  },
  {
    headline: "TCS bags record $2 bn deal as L&T loses mega expressway tender",
    detail: "A European consortium undercut L&T on the expressway package, and the CCI has opened a price-fixing probe into cement makers. TCS, meanwhile, signs the largest contract in Indian IT history.",
    moves: { TCS: 6, INFY: 4, WIPRO: 3, LT: -3, ULTRACEMCO: -4 },
  },
  {
    headline: "Infosys and Wipro sign AI megadeals — analysts call it IT's 'golden decade'",
    detail: "Both firms announce multi-year generative-AI contracts with Fortune 50 clients. Foreign funds pour ₹15,000 crore into IT stocks in a week.",
    moves: { TCS: -3, INFY: -3, WIPRO: -4, SUNPHARMA: 2, HUL: 2 },
    shock: {
      headline: "US imposes 25% levy on outsourced IT services",
      detail: "Washington fast-tracks a bill taxing offshore services contracts, effective immediately. Clients freeze new deals.",
      moves: { TCS: -10, INFY: -12, WIPRO: -12 },
      extend_sec: 60,
    },
  },
  {
    headline: "RBI holds rates, signals cuts as inflation cools to 3.1%",
    detail: "The Governor says the tightening cycle is over. Cheaper loans ahead for homes and cars.",
    moves: { HDFCBANK: 4, ICICIBANK: 5, AXISBANK: 4, MARUTI: 3, BAJAJAUTO: 3, TATAMOTORS: 3 },
  },
  {
    headline: "RBI delivers biggest rate cut in five years — repo slashed 50 bps",
    detail: "Markets cheer as EMIs fall. Banks expect a credit boom; auto dealers report record enquiries.",
    moves: { HDFCBANK: -5, ICICIBANK: -4, AXISBANK: -7, MARUTI: 2, TATAMOTORS: 2 },
  },
  {
    headline: "Crude crashes to $60 — paints, FMCG and autos cheer",
    detail: "Lower input costs are set to fatten margins at paint and consumer makers. Last round's bank sell-off: the rate cut squeezed lending margins and Axis Bank flagged ₹20,000 crore of stressed loans.",
    moves: { ASIANPAINT: -2, HUL: -1, RELIANCE: 2, COALINDIA: 2, AXISBANK: 2 },
    shock: {
      headline: "Strait of Hormuz closed — crude spikes to $120",
      detail: "Shipping halted after naval clashes; oil doubles intraday. Input costs for paints, FMCG and autos soar.",
      moves: { ASIANPAINT: -8, HUL: -4, NESTLEIND: -3, MARUTI: -3, RELIANCE: 6, COALINDIA: 4 },
      extend_sec: 60,
    },
  },
  {
    headline: "IMD forecasts strongest monsoon in a decade",
    detail: "Rural demand outlook brightens. FMCG, two-wheelers and consumer names stand to gain, and food inflation should ease.",
    moves: { HUL: 5, ITC: 5, NESTLEIND: 3, BAJAJAUTO: 4, MARUTI: 2 },
  },
  {
    headline: "Monsoon arrives 10 days early — sowing hits record high",
    detail: "Kharif acreage is up 18%. Analysts upgrade FMCG and rural plays across the board.",
    moves: { ITC: -2, HUL: -2, ULTRACEMCO: 2, LT: 2 },
    shock: {
      headline: "Flash floods across six states destroy standing crops",
      detail: "Cloudbursts in the north and east wipe out lakhs of hectares. Rural incomes take a hit and food prices are set to spike.",
      moves: { ITC: -6, HUL: -5, NESTLEIND: -4, BAJAJAUTO: -5, SUNPHARMA: 3, ULTRACEMCO: 3 },
      extend_sec: 60,
    },
  },
  {
    headline: "Election results: stable majority returns, Sensex futures jump 4%",
    detail: "Markets brace for a euphoric open as policy continuity is assured. Brokerages call it a once-in-a-decade buying opportunity.",
    moves: { RELIANCE: -3, HDFCBANK: -3, ICICIBANK: -3, TCS: -2, INFY: -2, LT: -4, ADANIPORTS: -4, MARUTI: -2, COALINDIA: 5, AIRTEL: 3, ITC: 1 },
  },
];

const fmtMoves = (m: Record<string, number>) => Object.entries(m).map(([t, p]) => `${t} ${p > 0 ? "+" : ""}${p}%`).join(", ");

// Each team trades as a company named after its chest number. [chest, captain, college]
const TEAMS = [
  ["SPC-01", "Shone Philips Thomas", "School of Management Studies, CUSAT"],
  ["SPC-02", "Anusha R", "Christ University"],
  ["SPC-03", "Vishal Ramachandran", "Christ University, Bangalore"],
  ["SPC-04", "Alfred Bobby", "School of Management Studies, CUSAT"],
  ["SPC-05", "Faaiz Roshan A H", "Rajagiri Business School"],
  ["SPC-06", "Aisha Ayalil Suneer", "JMC School of Management Studies, Thrissur"],
  ["SPC-07", "Akash Verma", "XIME Kochi"],
  ["SPC-08", "Ananya M", "School of Management Studies, Palakkad"],
  ["SPC-09", "Abdul Basith", "MBITS"],
  ["SPC-10", "Tom Philip", "Girideepam Institute of Advanced Learning"],
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
