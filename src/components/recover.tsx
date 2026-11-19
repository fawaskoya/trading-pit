"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { logActivity } from "@/lib/activity";

const KEY = "tp-recover";
const isStaleChunk = (e: Error) => /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported|error loading dynamically imported|Importing a module script failed/i.test(`${e.name} ${e.message}`);

/**
 * Shown instead of the crash screen. Most crashes here are momentary (a dropped connection, or a page opened
 * before a new version went live), so we retry by ourselves a few times and only then ask for a manual reload.
 */
export function Recover({ error, reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    console.error("[recover]", error);
    logActivity("reconnect", null, { message: String(error?.message ?? "").slice(0, 200) });
    let tries = 0;
    try { tries = Number(sessionStorage.getItem(KEY) ?? 0); } catch { /* private mode */ }
    if (tries >= 4) { setGaveUp(true); return; }
    try { sessionStorage.setItem(KEY, String(tries + 1)); } catch { /* ignore */ }
    const id = setTimeout(() => {
      if (isStaleChunk(error) || !reset) window.location.reload();
      else reset();
    }, 1200 + tries * 1500);
    return () => clearTimeout(id);
  }, [error, reset]);
  // A calm minute resets the counter, so a later hiccup gets its own retries.
  useEffect(() => { const id = setTimeout(() => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } }, 60_000); return () => clearTimeout(id); }, []);

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm space-y-3">
        <p className="font-heading text-2xl font-bold">{gaveUp ? "Still can't reconnect" : "Reconnecting…"}</p>
        <p className="text-sm text-muted-foreground">
          {gaveUp ? "Your team and portfolio are safe. Reload the page to carry on." : "Hold on a moment, this fixes itself. Your team and portfolio are safe."}
        </p>
        {gaveUp && <Button onClick={() => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } window.location.reload(); }}>Reload</Button>}
      </div>
    </div>
  );
}
