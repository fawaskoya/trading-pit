"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Table = "rounds" | "companies" | "teams" | "holdings" | "orders";

/**
 * Subscribes to Postgres changes for an event and re-fetches the server-rendered page (debounced).
 * Server Components stay the single source of truth, so a refresh never shows stale or partial state.
 */
export function useEventRealtime(eventId: string, tables: Table[] = ["rounds", "companies", "teams", "holdings", "orders"], onChange?: () => void, pollMs = 4000) {
  const router = useRouter();
  // At most one page refresh in flight, and not more often than every 1.2s. A burst of realtime events plus the
  // poll used to fire several overlapping refreshes, each one hitting the login-token refresh at the same moment.
  const [refreshing, startRefresh] = useTransition();
  const inFlight = useRef(false);
  inFlight.current = refreshing;
  const lastRefresh = useRef(0);
  const refresh = () => {
    if (inFlight.current || Date.now() - lastRefresh.current < 1200) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    lastRefresh.current = Date.now();
    startRefresh(() => router.refresh());
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const supabase = supabaseBrowser();
    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { cb.current?.(); refreshRef.current(); }, 250);
    };
    let channel = supabase.channel(`event:${eventId}:${tables.join(",")}`);
    for (const table of tables) {
      // teams/companies/rounds carry event_id; holdings/orders don't, so we listen unfiltered (RLS still applies).
      const filter = table === "rounds" || table === "companies" || table === "teams" ? `event_id=eq.${eventId}` : undefined;
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, bump);
    }
    channel.subscribe((status, err) => { if (process.env.NODE_ENV !== "production") console.debug("[realtime]", status, err?.message ?? ""); });

    // Belt and braces: refresh when the tab becomes visible again (phones sleep, sockets drop),
    // and poll gently so a missed message can never leave a screen stale during the event.
    const onVisible = () => { if (document.visibilityState === "visible") bump(); };
    document.addEventListener("visibilitychange", onVisible);
    const poll = pollMs > 0 ? setInterval(() => { if (document.visibilityState === "visible") refreshRef.current(); }, pollMs) : null;
    return () => {
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, tables.join(","), pollMs]);
}
