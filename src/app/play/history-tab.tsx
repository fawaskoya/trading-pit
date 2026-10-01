"use client";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { compactRupees, integer, pct, price as fmtPrice, rupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Company, Event, Order, PriceUpdate, Round, Snapshot } from "./play-screen";

export function HistoryTab({ event, rounds, companies, orders, priceUpdates, snapshots, currentTotal }: {
  event: Event; rounds: Round[]; companies: Company[]; orders: Order[]; priceUpdates: PriceUpdate[]; snapshots: Snapshot[]; currentTotal: number;
}) {
  const byId = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const done = rounds.filter((r) => r.state === "prices_applied");
  const snapByRound = Object.fromEntries(snapshots.map((s) => [s.round_id, s]));

  const curve = [
    { label: "Start", value: Number(event.starting_capital) },
    ...done.map((r) => ({ label: `R${r.round_no}`, value: Number(snapByRound[r.id]?.total_value ?? NaN) })).filter((p) => !Number.isNaN(p.value)),
  ];
  const active = rounds.find((r) => r.state !== "prices_applied");
  if (active && active.state !== "pending") curve.push({ label: "Now", value: currentTotal });

  if (!done.length && !orders.length) {
    return <Card className="p-5 text-sm text-muted-foreground">Your round-by-round story will appear here once the first round finishes.</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your portfolio over time</p>
        <div className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => compactRupees(v)} domain={["auto", "auto"]} />
              <Tooltip formatter={(v) => rupees(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--muted-foreground)" }} />
              <ReferenceLine y={Number(event.starting_capital)} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Dashed line = your starting capital.</p>
      </Card>

      {[...done].reverse().map((r) => {
        const moves = priceUpdates.filter((p) => p.round_id === r.id).map((p) => ({ ...p, c: byId[p.company_id], chg: ((Number(p.new_price) - Number(p.old_price)) / Number(p.old_price)) * 100 })).filter((m) => m.c).sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg));
        const mine = orders.filter((o) => o.round_id === r.id);
        const snap = snapByRound[r.id];
        const prevSnap = done.filter((d) => d.round_no < r.round_no).map((d) => snapByRound[d.id]).filter(Boolean).pop();
        const before = Number(prevSnap?.total_value ?? event.starting_capital);
        const delta = snap ? Number(snap.total_value) - before : null;
        return (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Round {r.round_no}</p>
                <p className="font-semibold leading-snug">{r.headline ?? "No headline"}</p>
              </div>
              {delta !== null && (
                <div className={cn("shrink-0 rounded-lg px-2 py-1 text-right text-sm font-semibold", delta > 0 && "bg-gain-soft text-gain", delta < 0 && "bg-loss-soft text-loss", delta === 0 && "bg-muted text-muted-foreground")}>
                  {delta === 0 ? "±0" : `${delta > 0 ? "+" : "−"}${compactRupees(Math.abs(delta))}`}
                </div>
              )}
            </div>
            {moves.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Price moves</p>
                <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  {moves.map((m) => (
                    <li key={m.company_id} className="flex justify-between"><span className="font-mono">{m.c.ticker}</span><span className={cn("num font-mono", m.chg > 0 ? "text-gain" : "text-loss")}>{pct(m.chg, 1)}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">Your trades</p>
              {mine.length ? (
                <ul className="mt-1 space-y-1 text-sm">
                  {mine.map((o) => (
                    <li key={o.id} className="flex justify-between">
                      <span><span className={cn("mr-1.5 rounded px-1 text-[10px] font-bold uppercase", o.side === "buy" ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss")}>{o.side}</span>{integer(o.shares)} {byId[o.company_id]?.ticker} @ {fmtPrice(o.price)}</span>
                      <span className="num font-mono text-muted-foreground">{compactRupees(o.value)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-muted-foreground">You held.</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
