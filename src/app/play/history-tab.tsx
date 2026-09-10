"use client";
import { Card } from "@/components/ui/card";
import type { Company, Event, Order, Round, Team } from "./play-screen";

// Step 6 fills this in with per-round headlines, price moves, trades and the equity curve.
export function HistoryTab({ rounds, orders }: { team: Team; event: Event; rounds: Round[]; companies: Company[]; orders: Order[] }) {
  const done = rounds.filter((r) => r.state === "prices_applied");
  return (
    <Card className="p-5 text-sm text-muted-foreground">
      {done.length ? `${done.length} round${done.length === 1 ? "" : "s"} complete · ${orders.length} trade${orders.length === 1 ? "" : "s"} so far.` : "Your round-by-round story will appear here once the first round finishes."}
    </Card>
  );
}
