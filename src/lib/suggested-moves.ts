/**
 * The organiser's private "suggested moves" for a round, e.g. `TCS -7%, INFY +3%`.
 * The headline editor previews them and the control room fills the price sheet from them.
 */
export type SuggestedMove = { ticker: string; pct: number };
export type ParsedSuggestedMoves = {
  moves: SuggestedMove[];
  /** Fragments that are not "TICKER ±N%" and will be ignored by "Fill suggested". */
  unreadable: string[];
};

const MOVE = /^([A-Z0-9&.-]+)\s*([+-]?\d+(?:\.\d+)?)\s*%?$/i;

export function parseSuggestedMoves(text: string | null | undefined): ParsedSuggestedMoves {
  const byTicker = new Map<string, number>(); // a ticker listed twice: the last one wins
  const unreadable: string[] = [];
  if (text) {
    for (const raw of text.replace(/^\s*suggested moves?:/i, "").split(/,|;|\n/)) {
      const part = raw.trim();
      if (!part) continue;
      const m = part.match(MOVE);
      if (m) byTicker.set(m[1].toUpperCase(), Number(m[2]));
      else unreadable.push(part);
    }
  }
  return { moves: [...byTicker].map(([ticker, pct]) => ({ ticker, pct })), unreadable };
}

/** Ticker → % move lookup for the price sheet. */
export function suggestedMovesByTicker(text: string | null | undefined): Record<string, number> {
  return Object.fromEntries(parseSuggestedMoves(text).moves.map((m) => [m.ticker, m.pct]));
}
