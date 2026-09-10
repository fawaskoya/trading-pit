"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Table = "rounds" | "companies" | "teams" | "holdings" | "orders";

/**
 * Subscribes to Postgres changes for an event and re-fetches the server-rendered page (debounced).
 * Server Components stay the single source of truth, so a refresh never shows stale or partial state.
 */
export function useEventRealtime(eventId: string, tables: Table[] = ["rounds", "companies", "teams", "holdings", "orders"], onChange?: () => void) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const supabase = supabaseBrowser();
    const bump = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { cb.current?.(); router.refresh(); }, 250);
    };
    let channel = supabase.channel(`event:${eventId}:${tables.join(",")}`);
    for (const table of tables) {
      // teams/companies/rounds carry event_id; holdings/orders don't, so we listen unfiltered (RLS still applies).
      const filter = table === "rounds" || table === "companies" || table === "teams" ? `event_id=eq.${eventId}` : undefined;
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, bump);
    }
    channel.subscribe();

    // Belt and braces: refresh when the tab becomes visible again (phones sleep, sockets drop).
    const onVisible = () => { if (document.visibilityState === "visible") bump(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, tables.join(",")]);
}
