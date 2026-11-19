/** Run with: pnpm test:unit   (node:test through tsx, no extra dependency) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreEvent, type ScoreInput } from "./scoring";

const CAP = 1_000_000;
const companies = ["X", "Y", "Z", "W"].map((t) => ({ id: t, ticker: t, starting_price: 100 }));
const at = (round: number, sec: number) => new Date(Date.UTC(2026, 0, 1, 10, round, sec)).toISOString();

/** A tiny game builder. `moves[r]` = end-of-round % moves; `shocks[r]` = Act of God % moves (fired at second 30). */
function game(rounds: number, moves: Record<number, Record<string, number>>, shocks: Record<number, Record<string, number>> = {}) {
  const input: ScoreInput = {
    startingCapital: CAP, companies, teams: [], orders: [], priceUpdates: [], shockMoves: [], activity: [], adjustments: [],
    rounds: Array.from({ length: rounds }, (_, i) => ({ id: `r${i + 1}`, round_no: i + 1, state: "prices_applied", shock_at: shocks[i + 1] ? at(i + 1, 30) : null })),
  };
  const price: Record<string, number> = Object.fromEntries(companies.map((c) => [c.id, 100]));
  const priceAt: Record<number, { open: Record<string, number>; mid: Record<string, number> }> = {};
  for (let r = 1; r <= rounds; r++) {
    priceAt[r] = { open: { ...price }, mid: { ...price } };
    for (const [c, p] of Object.entries(shocks[r] ?? {})) {
      const np = Math.round(price[c] * (1 + p / 100) * 100) / 100;
      input.shockMoves.push({ round_id: `r${r}`, company_id: c, old_price: price[c], new_price: np });
      price[c] = np;
    }
    priceAt[r].mid = { ...price };
    for (const [c, p] of Object.entries(moves[r] ?? {})) {
      const np = Math.round(price[c] * (1 + p / 100) * 100) / 100;
      input.priceUpdates.push({ round_id: `r${r}`, company_id: c, old_price: price[c], new_price: np });
      price[c] = np;
    }
  }
  const api = {
    input,
    team(id: string) { input.teams.push({ id, name: id, college: null }); return api; },
    /** `afterShock` trades at the post-shock price, otherwise at the window-open price. */
    trade(team: string, round: number, c: string, side: "buy" | "sell", shares: number, afterShock = false) {
      const p = afterShock ? priceAt[round].mid[c] : priceAt[round].open[c];
      input.orders.push({ team_id: team, round_id: `r${round}`, company_id: c, side, shares, price: p, fee: 0, created_at: at(round, afterShock ? 45 : 10 + input.orders.length % 10) });
      return api;
    },
    browse(team: string, round: number) { input.activity.push({ team_id: team, round_id: `r${round}`, kind: "open_company" }); return api; },
  };
  return api;
}
const byId = (scores: ReturnType<typeof scoreEvent>) => Object.fromEntries(scores.map((s) => [s.team_id, s]));

test("a team that cut the hit script right after the Act of God beats one that held it", () => {
  const g = game(1, { 1: { X: -5 } }, { 1: { X: -20 } }).team("seller").team("holder");
  g.trade("seller", 1, "X", "buy", 5000).trade("seller", 1, "X", "sell", 5000, true);
  g.trade("holder", 1, "X", "buy", 5000);
  const s = byId(scoreEvent(g.input));
  assert.ok(s.seller.sections.A.final > s.holder.sections.A.final, `A: seller ${s.seller.sections.A.final} vs holder ${s.holder.sections.A.final}`);
  assert.ok(s.seller.sections.A.reasons.some((r) => r.includes("Act of God")));
  assert.equal(s.seller.rank, 1);
});

test("holding is judged too: riding a crash scores below the midpoint, holding the winners above it", () => {
  // Round 1 is quiet (everyone buys); in round 2 X crashes 20% and Y jumps 10%, and nobody trades.
  const g = game(2, { 1: { X: 1 }, 2: { X: -20, Y: 10 } }).team("crashed").team("winner").team("flat");
  g.trade("crashed", 1, "X", "buy", 8000);
  g.trade("winner", 1, "Y", "buy", 8000);
  g.trade("flat", 1, "Z", "buy", 8000);
  const s = byId(scoreEvent(g.input));
  // No Act of God in this game, so the reaction point is the neutral 0.5 and the midpoint is 2.5.
  assert.ok(s.crashed.sections.A.auto < 2.5, `crashed ${s.crashed.sections.A.auto}`);
  assert.ok(s.winner.sections.A.auto > 2.5, `winner ${s.winner.sections.A.auto}`);
  assert.ok(s.crashed.sections.A.reasons.some((r) => r.includes("held without trading")));
});

test("sitting in cash for 4 of 10 rounds costs points in A, B and C; 2 rounds costs nothing in C", () => {
  const moves: Record<number, Record<string, number>> = {};
  for (let r = 1; r <= 10; r++) moves[r] = { X: r % 2 ? 3 : -2, Y: 1 };
  moves[3] = { X: 9, Y: 1 }; // high-impact round while one team is still in cash
  const g = game(10, moves).team("cash4").team("cash2");
  g.trade("cash2", 3, "X", "buy", 3000).trade("cash2", 3, "Y", "buy", 3000);
  g.trade("cash4", 5, "X", "buy", 3000).trade("cash4", 5, "Y", "buy", 3000);
  for (let r = 1; r <= 10; r++) g.browse("cash2", r).browse("cash4", r);
  const s = byId(scoreEvent(g.input));
  assert.equal(s.cash2.stats.cashRounds, 2);
  assert.equal(s.cash4.stats.cashRounds, 4);
  assert.ok(s.cash4.sections.A.final < s.cash2.sections.A.final, "A");
  assert.ok(s.cash4.sections.B.final < s.cash2.sections.B.final, "B");
  assert.ok(s.cash4.sections.C.final < s.cash2.sections.C.final, "C");
  assert.ok(s.cash2.sections.C.reasons.some((r) => r.includes("2 rounds sitting on cash") && r.includes("(2/2)")));
});

test("a lucky all-in team does not automatically win", () => {
  // X crashes, then rockets in the last round. "allin" rides it all the way; "smart" sells before the crash
  // and spreads its money, finishing with a little less money but far better decisions.
  const g = game(4, { 1: { X: 2, Y: 2, Z: 2 }, 2: { X: -25, Y: 3, Z: 3 }, 3: { X: -10, Y: 2, Z: 2 }, 4: { X: 60, Y: 4, Z: 4 } }).team("allin").team("smart");
  g.trade("allin", 1, "X", "buy", 9900);
  g.trade("smart", 1, "Y", "buy", 3000).trade("smart", 1, "Z", "buy", 3000).trade("smart", 1, "X", "buy", 3000);
  g.trade("smart", 2, "X", "sell", 3000);
  for (let r = 1; r <= 4; r++) g.browse("allin", r).browse("smart", r);
  const s = byId(scoreEvent(g.input));
  assert.ok(s.allin.finalValue > s.smart.finalValue, "the all-in team ends with more money");
  assert.equal(s.smart.rank, 1, `smart ${s.smart.total} vs allin ${s.allin.total}`);
});

test("judge adjustments are capped at ±2 and sections stay within 0–5", () => {
  const g = game(1, { 1: { X: 10 } }).team("a").team("b");
  g.trade("a", 1, "X", "buy", 9000);
  g.input.adjustments.push({ team_id: "a", section: "A", delta: 9, note: "Brilliant" }, { team_id: "b", section: "D", delta: -9, note: null });
  const s = byId(scoreEvent(g.input));
  assert.equal(s.a.sections.A.adjust, 2);
  assert.ok(s.a.sections.A.final <= 5);
  assert.equal(s.a.sections.A.note, "Brilliant");
  assert.equal(s.b.sections.D.adjust, -2);
  assert.ok(s.b.sections.D.final >= 0);
  for (const t of Object.values(s)) assert.ok(t.total >= 0 && t.total <= 20);
});

test("a team that never trades scores far below every team that played", () => {
  const g = game(6, { 1: { X: 3 }, 2: { X: -9, Y: 4 }, 3: { Y: 2 }, 4: { X: -5 }, 5: { Y: 3 }, 6: { X: 2 } }, { 2: { X: -10 } }).team("idle").team("allin").team("steady");
  g.trade("allin", 1, "X", "buy", 9900);
  g.trade("steady", 1, "X", "buy", 3000).trade("steady", 1, "Y", "buy", 3000).trade("steady", 1, "Z", "buy", 3000);
  for (let r = 1; r <= 6; r++) g.browse("allin", r).browse("steady", r);
  const s = byId(scoreEvent(g.input));
  assert.ok(s.idle.finalValue >= s.allin.finalValue, "sitting out preserved the most money");
  assert.ok(s.idle.total < s.allin.total && s.idle.total < s.steady.total, `idle ${s.idle.total}, allin ${s.allin.total}, steady ${s.steady.total}`);
  assert.ok(s.idle.total <= 3, `idle ${s.idle.total}`);
});
