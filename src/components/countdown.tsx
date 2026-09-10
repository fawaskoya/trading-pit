"use client";
import { useCountdown } from "@/hooks/use-server-clock";
import { mmss } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Countdown({ closesAt, className, onZero }: { closesAt: string | null | undefined; className?: string; onZero?: () => void }) {
  const left = useCountdown(closesAt);
  const urgent = left !== null && left <= 10;
  if (left !== null && left === 0) onZero?.();
  return (
    <span className={cn("num font-mono tabular-nums", urgent && "text-loss", className)} aria-live={urgent ? "assertive" : "off"}>
      {left === null ? "--:--" : mmss(left)}
    </span>
  );
}
