"use client";
import { useEffect, useRef, useState } from "react";

let cachedOffset: number | null = null;

/** Returns a function giving the current server time (ms). Syncs once per page load using a round-trip estimate. */
export function useServerClock() {
  const [offset, setOffset] = useState<number>(cachedOffset ?? 0);
  const synced = useRef(cachedOffset !== null);
  useEffect(() => {
    if (synced.current) return;
    let cancelled = false;
    (async () => {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/time", { cache: "no-store" });
        const { now } = (await res.json()) as { now: number };
        const t1 = Date.now();
        const est = now + (t1 - t0) / 2;
        if (!cancelled) { cachedOffset = est - t1; setOffset(cachedOffset); synced.current = true; }
      } catch { /* fall back to the local clock */ }
    })();
    return () => { cancelled = true; };
  }, []);
  return { now: () => Date.now() + offset, offset };
}

/** Seconds left until `iso`, ticking every 250ms, clamped at 0. */
export function useCountdown(iso: string | null | undefined) {
  const { now } = useServerClock();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) { setLeft(null); return; }
    const end = new Date(iso).getTime();
    const tick = () => setLeft(Math.max(0, (end - now()) / 1000));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, now().toString().slice(0, -3)]);
  return left;
}
