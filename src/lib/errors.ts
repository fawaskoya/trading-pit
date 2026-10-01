/** Postgres functions raise `CODE` as the message and a friendly `hint`. Turn either into something a beginner understands. */
const FRIENDLY: Record<string, string> = {
  INSUFFICIENT_CASH: "You don't have enough cash for that.",
  INSUFFICIENT_SHARES: "You can't sell more shares than you own.",
  WINDOW_CLOSED: "Trading is closed right now — wait for the next window.",
  INVALID_QUANTITY: "Enter a whole number of shares greater than zero.",
  POSITION_LIMIT: "That would put too much of your portfolio in one company.",
  BAD_CODE: "That team code wasn't found. Check it with your organiser.",
  ALREADY_CLAIMED: "This team is already logged in on another phone. Ask your organiser to reset it.",
  USER_HAS_TEAM: "This phone is already logged in as another team.",
  NO_TEAM: "Join a team with your team code first.",
  FORBIDDEN: "Only the organiser can do that.",
  BAD_STATE: "That action isn't available right now.",
  PREVIOUS_ROUND_INCOMPLETE: "Finish the earlier round first.",
  NEXT_ROUND_STARTED: "The next round has already begun; prices can no longer be undone.",
  CAPITAL_LOCKED: "Starting capital is locked once any team has traded.",
  ROUNDS_IN_USE: "You can't remove rounds that have already started.",
  NOT_AUTHENTICATED: "Please reload the page and try again.",
};

export function friendlyError(err: unknown): string {
  if (!err) return "Something went wrong.";
  const e = err as { message?: string; hint?: string; details?: string };
  const code = (e.message ?? "").trim();
  if (e.hint && FRIENDLY[code]) return e.hint;
  if (FRIENDLY[code]) return FRIENDLY[code];
  if (code.includes("Failed to fetch") || code.includes("NetworkError")) return "Network problem — check your connection and try again.";
  return code || "Something went wrong.";
}
