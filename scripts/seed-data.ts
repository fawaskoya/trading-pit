/** Demo data shared by the local seed and the live SQL generator. */
// name, ticker, sector, price (₹, roughly realistic, rounded)
export const COMPANIES: [string, string, string, number][] = [
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
export type Shock = { headline: string; detail: string; moves: Record<string, number>; extend_sec: number };
const BASE_HEADLINES: { headline: string; detail: string; moves: Record<string, number>; shock?: Shock }[] = [
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

// An Act of God is ready in every round, so the organiser can fire one whenever the mood needs it. They're
// written to hurt whoever followed the obvious trade (heavy losses, a few small hedges) and are editable
// in the control room before firing. Rounds 4, 7 and 9 carry their own, above.
const EXTRA_SHOCKS: Record<number, Shock> = {
  1: {
    headline: "Surprise windfall tax on infrastructure contractors",
    detail: "The finance ministry slaps a one-time 18% levy on profits from public projects, effective immediately. Contractors scramble to re-price their order books.",
    moves: { LT: -9, ULTRACEMCO: -8, ADANIPORTS: -10, COALINDIA: -3, SUNPHARMA: 2 },
    extend_sec: 60,
  },
  2: {
    headline: "Competition Commission raids cement makers and L&T offices",
    detail: "Dawn raids over alleged bid-rigging on highway tenders; officials seize documents and servers. Tender awards are put on hold.",
    moves: { LT: -12, ULTRACEMCO: -11, ADANIPORTS: -4, HUL: 1 },
    extend_sec: 60,
  },
  3: {
    headline: "TCS confirms data leak at its European banking client",
    detail: "Regulators freeze the new contract pending a security audit. Rival IT firms face the same questions from their own clients.",
    moves: { TCS: -11, INFY: -5, WIPRO: -4, HDFCBANK: 1 },
    extend_sec: 60,
  },
  5: {
    headline: "₹9,000 crore fraud uncovered at a large private bank",
    detail: "A forensic audit finds fictitious loans booked over three years. The central bank orders a sector-wide asset-quality review.",
    moves: { ICICIBANK: -10, HDFCBANK: -8, AXISBANK: -12, MARUTI: -3, TATAMOTORS: -3 },
    extend_sec: 60,
  },
  6: {
    headline: "RBI calls an emergency meeting and signals it may reverse the rate cut",
    detail: "The rupee slides to a record low and imported inflation jumps. Car loans and dealer financing tighten overnight.",
    moves: { MARUTI: -9, TATAMOTORS: -10, BAJAJAUTO: -8, ULTRACEMCO: -5, SUNPHARMA: 2 },
    extend_sec: 60,
  },
  8: {
    headline: "Government caps prices on packaged food and edible oils",
    detail: "A surprise ordinance limits retail prices to curb food inflation. Consumer-goods makers say margins will be squeezed hard.",
    moves: { HUL: -9, NESTLEIND: -10, ITC: -7, BAJAJAUTO: -3, SUNPHARMA: 2 },
    extend_sec: 60,
  },
  10: {
    headline: "Exit-poll flip: opposition surges, Sensex futures crash 6%",
    detail: "Late exit polls point to a hung result. Foreign funds dump Indian equities at the open; only defensives hold.",
    moves: { RELIANCE: -9, HDFCBANK: -10, ICICIBANK: -10, TCS: -6, INFY: -6, LT: -11, ADANIPORTS: -13, MARUTI: -7, COALINDIA: -4, SUNPHARMA: 3, ITC: 2 },
    extend_sec: 60,
  },
};

export const HEADLINES = BASE_HEADLINES.map((h, i) => ({ ...h, shock: h.shock ?? EXTRA_SHOCKS[i + 1] }));


export const fmtMoves = (m: Record<string, number>) => Object.entries(m).map(([t, p]) => `${t} ${p > 0 ? "+" : ""}${p}%`).join(", ");

// Each team trades as a company named after its chest number. [chest, captain, college]
export const TEAMS = [
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
  // Spare chest numbers for late registrations: rename or add the captain/college on the Teams page.
  ["SPC-11", "", ""],
  ["SPC-12", "", ""],
  ["SPC-13", "", ""],
  ["SPC-14", "", ""],
  ["SPC-15", "", ""],
];
