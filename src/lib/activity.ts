"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

export type ActivityKind = "join" | "reconnect" | "open_company" | "close_company_no_trade" | "order_failed" | "tab_view";

/**
 * Records what a team looks at and tries, for scoring after the game. Fire-and-forget: it never waits,
 * never throws and never shows an error, so logging can't get in the way of trading.
 * The database only accepts rows for the caller's own team, and rate-limits them.
 */
export function logActivity(kind: ActivityKind, companyId?: string | null, detail?: Record<string, unknown>) {
  try {
    void supabaseBrowser()
      .rpc("log_activity", { p_kind: kind, p_company_id: companyId ?? undefined, p_detail: (detail ?? {}) as never })
      .then(() => undefined, () => undefined);
  } catch { /* logging must never break the screen */ }
}
