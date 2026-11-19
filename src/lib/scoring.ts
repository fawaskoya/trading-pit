/**
 * Judged score out of 20. The winner isn't simply the team with the most money: four sections of 5 points
 * reward logical decisions when it mattered, good script selection, balanced risk, and outcome plus discipline.
 *
 * Pure function of the game's recorded data (no database access), so it can be unit-tested with small
 * hand-made games and re-run at any time. Every section is scaled against the other teams in the same event,
 * so scores stay fair however easy or hard the headlines turned out to be.
 */
import { compactRupees } from "./format";

export type Section = "A" | "B" | "C" | "D";
export const SECTIONS: { key: Section; title: string; blurb: string; criteria: string[] }[] = [
  { key: "A", title: "Decisions under pressure", blurb: "Trades and positioning in high-impact windows (Act of God, or a move of 8%+) and the reaction to breaking news.",
    criteria: [
      "4 marks: in each high-impact round, the team's return (trades and holdings) against the market, each round capped at ±10%.",
      "Sitting in cash through a high-impact round without trading loses 0.5 each time.",
      "1 mark: reaction to the Act of God. Cut the hit scripts or bought the winners = 1; held the hit scripts and did nothing = ½; bought more of the crashing scripts or sat in cash = 0.",
    ] },
  { key: "B", title: "Script selection", blurb: "How the chosen scripts did against the average script, round by round, while actually invested.",
    criteria: [
      "Half: consistency, the share of invested rounds in which the picks beat the average script.",
      "Half: size of that edge against the other teams, each round capped at ±10% so one lucky round can't carry it.",
      "Rounds spent entirely in cash count as zero (the first 2 are forgiven).",
    ] },
  { key: "C", title: "Risk management", blurb: "Drawdown, position sizing, and willingness to take risk rather than sit in cash.",
    criteria: [
      "1.5 marks: the smallest worst drawdown across rounds.",
      "1.5 marks: position sizing; the largest single script above 60% of the portfolio loses marks (all-in).",
      "2 marks: willingness to take risk. A round spent entirely with 80%+ in cash is a cash round; the first 2 are free, each extra costs 0.5. Never investing beyond 30% scores 0.",
    ] },
  { key: "D", title: "Outcome & discipline", blurb: "Final return against the field, and clean trading: little churn, few failed orders, active every round.",
    criteria: [
      "3 marks: final portfolio return, scaled from the lowest to the highest team.",
      "2 marks: discipline. Buying and selling the same script in one round, failed or impossible orders, and rounds with no activity at all each cost marks.",
    ] },
];
export const SECTION_MAX = 5;
export const ADJUST_LIMIT = 2;
/** A round that closes with less than this share invested counts as "sitting on cash". */
export const CASH_ROUND_INVESTED = 0.2;
/** Cash rounds that cost nothing. */
export const FREE_CASH_ROUNDS = 2;
/** A round is high-impact if an Act of God fired or any script moved at least this much. */
export const HIGH_IMPACT_MOVE = 0.08;
/** No single round can swing a team's A or B score by more than this, so one lucky round can't carry the game. */
export const ROUND_CAP = 0.1;

export type ScoreInput = {
  startingCapital: number;
  rounds: { id: string; round_no: number; state: string; shock_at: string | null }[];
  companies: { id: string; ticker: string; starting_price: number }[];
  teams: { id: string; name: string | null; college: string | null; join_code?: string }[];
  orders: { team_id: string; round_id: string; company_id: string; side: "buy" | "sell"; shares: number; price: number; fee: number; created_at: string }[];
  /** End-of-round price changes. */
  priceUpdates: { round_id: string; company_id: string; old_price: number; new_price: number }[];
  /** Act of God price changes. */
  shockMoves: { round_id: string; company_id: string; old_price: number; new_price: number }[];
  activity: { team_id: string; round_id: string | null; kind: string }[];
  adjustments: { team_id: string; section: Section; delta: number; note: string | null }[];
};

export type SectionScore = { auto: number; adjust: number; final: number; note: string | null; reasons: string[] };
export type TeamScore = {
  team_id: string; name: string; college: string | null;
  sections: Record<Section, SectionScore>;
  total: number; rank: number;
  finalValue: number; returnPct: number;
  stats: { trades: number; cashRounds: number; highImpactRounds: number; maxDrawdownPct: number };
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pctText = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`;
const money = (n: number) => `${n >= 0 ? "+" : "−"}${compactRupees(Math.abs(n))}`;
/** −1..1 relative to the team with the largest absolute value (0 when everyone is 0). */
const relative = (v: number, all: number[]) => { const m = Math.max(0, ...all.map(Math.abs)); return m > 0 ? clamp(v / m, -1, 1) : 0; };

type Prices = Record<string, number>;
type RoundPrices = { open: Prices; mid: Prices; end: Prices; shocked: boolean; maxMove: number };

/** Each played round's prices at window open, after the Act of God, and at round end. */
function priceTimeline(input: ScoreInput, played: ScoreInput["rounds"]) {
  let current: Prices = Object.fromEntries(input.companies.map((c) => [c.id, Number(c.starting_price)]));
  const out = new Map<string, RoundPrices>();
  for (const r of played) {
    const open = { ...current };
    const mid = { ...open };
    let maxMove = 0;
    for (const s of input.shockMoves.filter((m) => m.round_id === r.id)) {
      mid[s.company_id] = Number(s.new_price);
      maxMove = Math.max(maxMove, Math.abs(Number(s.new_price) / Number(s.old_price) - 1));
    }
    const end = { ...mid };
    for (const u of input.priceUpdates.filter((m) => m.round_id === r.id)) {
      end[u.company_id] = Number(u.new_price);
      maxMove = Math.max(maxMove, Math.abs(Number(u.new_price) / Number(u.old_price) - 1));
    }
    out.set(r.id, { open, mid, end, shocked: !!r.shock_at, maxMove });
    current = end;
  }
  return out;
}

type Book = { cash: number; shares: Record<string, number> };
const valueOf = (b: Book, p: Prices) => b.cash + Object.entries(b.shares).reduce((s, [c, n]) => s + n * (p[c] ?? 0), 0);
const investedOf = (b: Book, p: Prices) => Object.entries(b.shares).reduce((s, [c, n]) => s + Math.max(0, n) * (p[c] ?? 0), 0);
const apply = (b: Book, o: ScoreInput["orders"][number]) => {
  const v = Number(o.shares) * Number(o.price);
  b.cash += o.side === "buy" ? -v - Number(o.fee) : v - Number(o.fee);
  b.shares[o.company_id] = (b.shares[o.company_id] ?? 0) + (o.side === "buy" ? Number(o.shares) : -Number(o.shares));
};

type RoundStat = {
  round: ScoreInput["rounds"][number];
  prices: RoundPrices;
  valueOpen: number; valueEnd: number; investedFrac: number; maxPosition: number;
  /** In cash from the start of the round to its end (an exit during the round is a decision, not sitting out). */
  isCash: boolean;
  orders: ScoreInput["orders"]; highImpact: boolean;
  edge: number;               // ₹ made or saved by this round's trades, by the round's end
  positionEdge: number;       // round return minus what the same invested share of the average script did (capped)
  roundReturn: number; marketMove: number;
  alpha: number;              // basket return minus average script, this round
  reaction: number | null;    // 0..1, only for Act of God rounds
  reactionText: string | null;
  churn: number;              // scripts both bought and sold this round
  browsed: boolean;           // opened any script this round
};

export function scoreEvent(input: ScoreInput): TeamScore[] {
  const played = [...input.rounds].filter((r) => r.state !== "pending").sort((a, b) => a.round_no - b.round_no);
  const timeline = priceTimeline(input, played);
  const companyIds = input.companies.map((c) => c.id);

  // ---------------------------------------------------------------- per-team, per-round facts
  const perTeam = input.teams.map((team) => {
    const book: Book = { cash: input.startingCapital, shares: {} };
    const mine = input.orders.filter((o) => o.team_id === team.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const stats: RoundStat[] = [];
    for (const r of played) {
      const p = timeline.get(r.id)!;
      const valueOpen = valueOf(book, p.open);
      const investedOpen = valueOpen > 0 ? investedOf(book, p.open) / valueOpen : 0;
      const orders = mine.filter((o) => o.round_id === r.id);
      const shockAt = r.shock_at ? Date.parse(r.shock_at) : null;

      // Holdings at the moment the Act of God hit (for the reaction score).
      const atShock: Book = { cash: book.cash, shares: { ...book.shares } };
      for (const o of orders) if (shockAt !== null && Date.parse(o.created_at) < shockAt) apply(atShock, o);
      for (const o of orders) apply(book, o);

      const valueEnd = valueOf(book, p.end);
      const valueMid = valueOf(book, p.mid);
      const invested = investedOf(book, p.mid);
      const investedFrac = valueMid > 0 ? invested / valueMid : 0;
      const maxPosition = valueMid > 0 ? Math.max(0, ...Object.entries(book.shares).map(([c, n]) => (Math.max(0, n) * (p.mid[c] ?? 0)) / valueMid)) : 0;

      // Edge: did each trade point the right way, judged at the round's end?
      const edge = orders.reduce((s, o) => {
        const after = p.end[o.company_id] ?? Number(o.price);
        const move = (after - Number(o.price)) * Number(o.shares);
        return s + (o.side === "buy" ? move : -move) - Number(o.fee);
      }, 0);

      // Alpha: the team's basket against the average script, from window close to round end
      // (plus, in an Act of God round, the basket held when the shock hit).
      const avg = (from: Prices, to: Prices) => companyIds.reduce((s, c) => s + (to[c] / from[c] - 1), 0) / Math.max(1, companyIds.length);
      const basket = (b: Book, from: Prices, to: Prices) => {
        const inv = investedOf(b, from);
        if (inv <= 0) return 0;
        return Object.entries(b.shares).reduce((s, [c, n]) => s + (Math.max(0, n) * from[c] / inv) * (to[c] / from[c] - 1), 0);
      };
      let alpha = basket(book, p.mid, p.end) - avg(p.mid, p.end);
      if (p.shocked) alpha += basket(atShock, p.open, p.mid) - avg(p.open, p.mid);
      alpha = clamp(alpha, -ROUND_CAP, ROUND_CAP);

      // Positioning: holding is a decision too. Compare the round's return (trades and holdings) with what the
      // same invested share would have done in the average script.
      const marketMove = avg(p.open, p.end);
      const roundReturn = valueOpen > 0 ? valueEnd / valueOpen - 1 : 0;
      const positionEdge = clamp(roundReturn - Math.max(investedOpen, investedFrac) * marketMove, -ROUND_CAP, ROUND_CAP);

      // Reaction to the Act of God.
      let reaction: number | null = null;
      let reactionText: string | null = null;
      if (p.shocked && shockAt !== null) {
        const hit = new Set(companyIds.filter((c) => p.mid[c] / p.open[c] - 1 <= -0.03));
        const gain = new Set(companyIds.filter((c) => p.mid[c] / p.open[c] - 1 >= 0.02));
        const exposed = [...hit].reduce((s, c) => s + Math.max(0, atShock.shares[c] ?? 0) * p.open[c], 0);
        const shockValue = valueOf(atShock, p.open);
        const shockInvested = investedOf(atShock, p.open) / Math.max(1, shockValue);
        let good = 0, bad = 0;
        let firstGoodSec: number | null = null;
        for (const o of orders) {
          const t = Date.parse(o.created_at);
          if (t < shockAt) continue;
          const v = Number(o.shares) * Number(o.price);
          const isGood = (o.side === "sell" && hit.has(o.company_id)) || (o.side === "buy" && gain.has(o.company_id));
          const isBad = o.side === "buy" && hit.has(o.company_id);
          if (isGood) { good += v; firstGoodSec ??= Math.round((t - shockAt) / 1000); }
          if (isBad) bad += v;
        }
        if (good + bad > 0) {
          reaction = good / (good + bad);
          reactionText = `Round ${r.round_no} Act of God: ${good > 0 ? `cut hit scripts or bought winners (${compactRupees(good)}) ${firstGoodSec}s after the news` : ""}${good > 0 && bad > 0 ? "; " : ""}${bad > 0 ? `bought ${compactRupees(bad)} more of the crashing scripts` : ""}.`;
        } else if (shockInvested < CASH_ROUND_INVESTED) {
          reaction = 0; reactionText = `Round ${r.round_no} Act of God: sitting in cash, no decision taken.`;
        } else if (exposed > 0) {
          reaction = 0.5; reactionText = `Round ${r.round_no} Act of God: held ${compactRupees(exposed)} of the hit scripts and did nothing.`;
        } else {
          reaction = 1; reactionText = `Round ${r.round_no} Act of God: invested, and none of it in the hit scripts.`;
        }
      }

      const bought = new Set(orders.filter((o) => o.side === "buy").map((o) => o.company_id));
      const churn = new Set(orders.filter((o) => o.side === "sell" && bought.has(o.company_id)).map((o) => o.company_id)).size;
      const browsed = input.activity.some((a) => a.team_id === team.id && a.round_id === r.id && a.kind === "open_company");
      stats.push({ round: r, prices: p, valueOpen, valueEnd, investedFrac, maxPosition, isCash: investedOpen < CASH_ROUND_INVESTED && investedFrac < CASH_ROUND_INVESTED, orders, highImpact: p.shocked || p.maxMove >= HIGH_IMPACT_MOVE, edge, positionEdge, roundReturn, marketMove, alpha, reaction, reactionText, churn, browsed });
    }
    const finalPrices = played.length ? timeline.get(played[played.length - 1].id)!.end : Object.fromEntries(input.companies.map((c) => [c.id, Number(c.starting_price)]));
    const finalValue = valueOf(book, finalPrices);
    const failed = input.activity.filter((a) => a.team_id === team.id && a.kind === "order_failed").length;
    return { team, stats, finalValue, trades: mine.length, failed };
  });

  // ------------------------------------------------------------------- raw metrics per team
  const raw = perTeam.map(({ team, stats, finalValue, trades, failed }) => {
    const hi = stats.filter((s) => s.highImpact);
    const edgePct = hi.reduce((s, x) => s + x.positionEdge, 0);
    const cashHi = hi.filter((x) => x.isCash && x.orders.length === 0).length;
    const reactions = stats.filter((s) => s.reaction !== null);
    const reaction = reactions.length ? reactions.reduce((s, x) => s + x.reaction!, 0) / reactions.length : 0.5;
    const cashRounds = stats.filter((s) => s.isCash).length;
    const investedRounds = stats.length - cashRounds;
    const investedStats = stats.filter((x) => !x.isCash);
    const weightedAlpha = investedStats.reduce((s, x) => s + x.alpha * x.investedFrac, 0) / Math.max(1, investedRounds);
    const hitRate = investedStats.length ? investedStats.filter((x) => x.alpha > 0).length / investedStats.length : 0;
    // Share of the game spent invested, with the first FREE_CASH_ROUNDS cash rounds forgiven.
    const participation = !stats.length ? 0 : cashRounds <= FREE_CASH_ROUNDS ? 1 : investedRounds / (stats.length - FREE_CASH_ROUNDS);
    const values = [input.startingCapital, ...stats.map((s) => s.valueEnd)];
    let peak = values[0], maxDD = 0;
    for (const v of values) { peak = Math.max(peak, v); maxDD = Math.max(maxDD, peak > 0 ? (peak - v) / peak : 0); }
    const avgMaxPos = stats.length ? stats.reduce((s, x) => s + x.maxPosition, 0) / stats.length : 0;
    const peakInvested = Math.max(0, ...stats.map((s) => s.investedFrac));
    const churn = stats.reduce((s, x) => s + x.churn, 0);
    const idleRounds = stats.filter((s) => s.orders.length === 0 && !s.browsed && s.round.state !== "headline_released").length;
    return { team, stats, finalValue, trades, failed, hi, edgePct, cashHi, reaction, reactions, cashRounds, weightedAlpha, hitRate, participation, maxDD, avgMaxPos, peakInvested, churn, idleRounds, ret: finalValue / input.startingCapital - 1 };
  });

  const allEdge = raw.map((r) => r.edgePct);
  const allAlpha = raw.map((r) => r.weightedAlpha);
  const worstDD = Math.max(0, ...raw.map((r) => r.maxDD));
  const rets = raw.map((r) => r.ret);
  const minRet = Math.min(...rets), maxRet = Math.max(...rets);

  // ------------------------------------------------------------------------------ sections
  const scored = raw.map((r) => {
    const reasons: Record<Section, string[]> = { A: [], B: [], C: [], D: [] };

    // A — decisions under pressure (4 for the edge in high-impact rounds, 1 for the Act of God reaction)
    let aEdge = 2 + 2 * relative(r.edgePct, allEdge);
    aEdge = Math.max(0, aEdge - 0.5 * r.cashHi);
    const A = clamp(aEdge + r.reaction, 0, 5);
    if (!r.hi.length) reasons.A.push("No high-impact rounds have been played yet.");
    for (const x of r.hi) {
      const label = `Round ${x.round.round_no}${x.prices.shocked ? " (Act of God)" : ""}`;
      if (x.isCash && !x.orders.length) { reasons.A.push(`${label}: sat in cash through a high-impact round (−0.5).`); continue; }
      const trades = !x.orders.length ? "; held without trading"
        : Math.abs(x.edge) < 1 ? "; its trades broke even by the round's end"
        : `; its trades ${x.edge > 0 ? "made or saved" : "cost"} ${compactRupees(Math.abs(x.edge))}`;
      reasons.A.push(`${label}: portfolio ${pctText(x.roundReturn)} vs market ${pctText(x.marketMove)}${trades}.`);
    }
    for (const x of r.reactions) if (x.reactionText) reasons.A.push(x.reactionText);

    // B — script selection, discounted by how little of the game the team was actually invested
    // Half for consistency (share of invested rounds where the picks beat the average script), half for the
    // size of the edge against the field. Each round is capped, so one lucky round can't carry it.
    const B = clamp(5 * r.participation * (0.5 * r.hitRate + 0.5 * (0.5 + 0.5 * relative(r.weightedAlpha, allAlpha))), 0, 5);
    reasons.B.push(`Picks beat the average script in ${Math.round(r.hitRate * 100)}% of invested rounds; average edge ${pctText(r.weightedAlpha)} per round (capped at ±${ROUND_CAP * 100}% a round).`);
    const best = [...r.stats].filter((s) => !s.isCash).sort((a, b) => b.alpha - a.alpha);
    if (best[0]) reasons.B.push(`Best round: ${best[0].round.round_no} (${pctText(best[0].alpha)} vs the market).`);
    if (best.length > 1) reasons.B.push(`Worst round: ${best[best.length - 1].round.round_no} (${pctText(best[best.length - 1].alpha)} vs the market).`);
    if (r.participation < 1) reasons.B.push(`Invested in only ${r.stats.length - r.cashRounds} of ${r.stats.length} rounds, so picking skill counts for less.`);

    // C — risk: drawdown 1.5, sizing 1.5, willingness to take risk 2. Drawdown and sizing only count for the
    // share of the game the team was actually invested: avoiding losses by never playing isn't risk management.
    const dd = r.participation * (worstDD > 0 ? 1.5 * (1 - r.maxDD / worstDD) : 1.5);
    const sizing = r.participation * (r.avgMaxPos <= 0.6 ? 1.5 : 1.5 * clamp(1 - (r.avgMaxPos - 0.6) / 0.4, 0, 1));
    let willing = clamp(2 - 0.5 * Math.max(0, r.cashRounds - FREE_CASH_ROUNDS), 0, 2);
    if (r.stats.length && r.peakInvested < 0.3) willing = 0;
    const C = clamp(dd + sizing + willing, 0, 5);
    reasons.C.push(`Worst drawdown ${(r.maxDD * 100).toFixed(1)}% (${round1(dd)}/1.5)${r.participation < 1 ? `, scaled by time invested (${Math.round(r.participation * 100)}%)` : ""}.`);
    reasons.C.push(`Largest single position averaged ${(r.avgMaxPos * 100).toFixed(0)}% of the portfolio (${round1(sizing)}/1.5)${r.avgMaxPos > 0.6 ? " — too concentrated" : ""}.`);
    reasons.C.push(r.stats.length && r.peakInvested < 0.3
      ? "Never more than 30% invested: too risk-averse (0/2)."
      : `${r.cashRounds} round${r.cashRounds === 1 ? "" : "s"} sitting on cash; the first ${FREE_CASH_ROUNDS} are free (${round1(willing)}/2).`);

    // D — outcome 3 (again scaled by time invested: keeping cash safe by not playing isn't a result), discipline 2
    const outcome = r.participation * (maxRet > minRet ? 3 * (r.ret - minRet) / (maxRet - minRet) : 1.5);
    const discipline = clamp(2 - Math.min(1, 0.25 * r.churn) - Math.min(0.5, 0.1 * r.failed) - Math.min(1, 0.25 * r.idleRounds), 0, 2);
    const D = clamp(outcome + discipline, 0, 5);
    reasons.D.push(`Final value ${compactRupees(r.finalValue)} (${pctText(r.ret)}), ${round1(outcome)}/3 against the field${r.participation < 1 ? `, scaled by time invested (${Math.round(r.participation * 100)}%)` : ""}.`);
    if (r.trades === 0) reasons.D.push("Made no trades at all.");
    reasons.D.push(`Discipline ${round1(discipline)}/2: ${r.churn} same-round in-and-out trade${r.churn === 1 ? "" : "s"}, ${r.failed} failed order${r.failed === 1 ? "" : "s"}, ${r.idleRounds} idle round${r.idleRounds === 1 ? "" : "s"}.`);

    const autos: Record<Section, number> = { A, B, C, D };
    const sections = Object.fromEntries((["A", "B", "C", "D"] as Section[]).map((k) => {
      const adj = input.adjustments.find((a) => a.team_id === r.team.id && a.section === k);
      const adjust = clamp(Number(adj?.delta ?? 0), -ADJUST_LIMIT, ADJUST_LIMIT);
      return [k, { auto: round2(autos[k]), adjust, final: round2(clamp(autos[k] + adjust, 0, SECTION_MAX)), note: adj?.note ?? null, reasons: reasons[k] }];
    })) as Record<Section, SectionScore>;
    const total = round2((Object.values(sections) as SectionScore[]).reduce((s, x) => s + x.final, 0));
    return {
      team_id: r.team.id, name: r.team.name ?? `Team ${r.team.join_code ?? ""}`.trim(), college: r.team.college,
      sections, total, rank: 0, finalValue: r.finalValue, returnPct: r.ret,
      stats: { trades: r.trades, cashRounds: r.cashRounds, highImpactRounds: r.hi.length, maxDrawdownPct: r.maxDD * 100 },
    } satisfies TeamScore;
  });

  // Rank by total; ties go to the better decisions section, then the better outcome.
  scored.sort((a, b) => b.total - a.total || b.sections.A.final - a.sections.A.final || b.finalValue - a.finalValue);
  scored.forEach((s, i) => { s.rank = i > 0 && s.total === scored[i - 1].total ? scored[i - 1].rank : i + 1; });
  return scored;
}

/** "Bought 70% more…" helpers for the UI. */
export const formatMoney = money;
export const SECTION_TITLE = Object.fromEntries(SECTIONS.map((s) => [s.key, s.title])) as Record<Section, string>;
