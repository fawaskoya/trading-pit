"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Megaphone, Play, Square, Undo2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Countdown } from "@/components/countdown";
import { useEventRealtime } from "@/hooks/use-event-realtime";
import { compactRupees, integer, pct, price as fmtPrice, rupees } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { applyPrices, closeWindow, openWindow, releaseHeadline, undoPrices } from "../actions";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Round = Database["public"]["Tables"]["rounds"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
type Leader = Database["public"]["Views"]["leaderboard_view"]["Row"];
type FeedOrder = { id: number; side: "buy" | "sell"; shares: number; price: number; value: number; created_at: string; team: { name: string | null; join_code: string } | null; company: { ticker: string } | null };

const STATE_LABEL: Record<Round["state"], string> = {
  pending: "Not started", headline_released: "Headline out", window_open: "Trading open", window_closed: "Window closed", prices_applied: "Done",
};

export function ControlRoom({ event, rounds, companies, orders, leaderboard, teams }: {
  event: Event; rounds: Round[]; companies: Company[]; orders: FeedOrder[]; leaderboard: Leader[]; teams: { total: number; joined: number };
}) {
  useEventRealtime(event.id);
  const [pending, start] = useTransition();
  const active = rounds.find((r) => r.state !== "prices_applied") ?? null;
  const lastApplied = [...rounds].reverse().find((r) => r.state === "prices_applied") ?? null;
  const finished = !active;

  const run = (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else toast.success(label);
    });

  const autoClose = async () => {
    // Window hit zero on our clock: ask the DB to flip state (idempotent, safe to call from anywhere).
    await supabaseBrowser().rpc("close_expired_windows");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* round stepper */}
        <ol className="flex flex-wrap gap-2">
          {rounds.map((r) => (
            <li key={r.id} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              r.state === "prices_applied" && "border-gain/40 bg-gain-soft text-gain",
              r.id === active?.id && "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30",
              r.state === "pending" && r.id !== active?.id && "text-muted-foreground")}>
              {r.state === "prices_applied" ? <Check className="size-3" /> : <span className="font-mono">{r.round_no}</span>}
              <span>Round {r.round_no}</span>
            </li>
          ))}
        </ol>

        {finished ? (
          <Card className="p-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Event complete</p>
            <h2 className="mt-2 text-3xl font-extrabold">🏆 {leaderboard[0]?.name ?? "—"}</h2>
            <p className="mt-1 text-muted-foreground">{rupees(leaderboard[0]?.total_value)} · {leaderboard[0]?.trade_count} trades</p>
            {lastApplied && (
              <Button variant="outline" className="mt-6" disabled={pending} onClick={() => run("Prices undone", () => undoPrices(lastApplied.id))}>
                <Undo2 /> Undo round {lastApplied.round_no} prices
              </Button>
            )}
          </Card>
        ) : (
          <ActiveRound event={event} round={active} companies={companies} pending={pending} run={run} onZero={autoClose} />
        )}

        {lastApplied && !finished && (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">Round {lastApplied.round_no} prices are applied</p>
              <p className="text-xs text-muted-foreground">{companies.filter((c) => Number(c.last_change_pct) !== 0).length} companies moved. Undo is available until the next headline is released.</p>
            </div>
            <Button variant="outline" size="sm" disabled={pending || active?.state !== "pending"} onClick={() => run("Prices undone", () => undoPrices(lastApplied.id))}>
              <Undo2 /> Undo
            </Button>
          </Card>
        )}
      </div>

      <aside className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Teams</h3>
            <Link href={`/admin/${event.id}/teams`} className="text-xs text-primary hover:underline">Manage</Link>
          </div>
          <p className="mt-1 text-2xl font-bold">{teams.joined}<span className="text-base font-normal text-muted-foreground"> / {teams.total} joined</span></p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold">Leaderboard</h3>
          <ol className="mt-2 space-y-1.5 text-sm">
            {leaderboard.slice(0, 8).map((l) => (
              <li key={l.team_id} className="flex items-center justify-between gap-2">
                <span className="truncate"><span className="mr-2 font-mono text-muted-foreground">{l.rank}</span>{l.name}</span>
                <span className="num shrink-0 font-mono">{compactRupees(l.total_value)}</span>
              </li>
            ))}
            {!leaderboard.length && <li className="text-muted-foreground">No teams yet.</li>}
          </ol>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold">Live orders</h3>
          <ul className="mt-2 max-h-[420px] space-y-1 overflow-y-auto text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 rounded px-1 py-0.5">
                <span className="truncate">
                  <span className={cn("mr-1.5 rounded px-1 text-[10px] font-bold uppercase", o.side === "buy" ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss")}>{o.side}</span>
                  {o.team?.name ?? o.team?.join_code} · {integer(o.shares)} {o.company?.ticker}
                </span>
                <span className="num shrink-0 font-mono text-muted-foreground">{compactRupees(o.value)}</span>
              </li>
            ))}
            {!orders.length && <li className="text-muted-foreground">Orders will stream here.</li>}
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function ActiveRound({ event, round, companies, pending, run, onZero }: {
  event: Event; round: Round; companies: Company[]; pending: boolean;
  run: (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => void; onZero: () => void;
}) {
  const s = round.state;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="font-heading text-lg font-bold">Round {round.round_no} <span className="text-muted-foreground">of {event.total_rounds}</span></span>
          <Badge variant={s === "window_open" ? "default" : "secondary"} className={cn(s === "window_open" && "pulse-ring")}>{STATE_LABEL[s]}</Badge>
        </div>
        {s === "window_open" && <Countdown closesAt={round.window_closes_at} className="text-3xl font-bold" onZero={onZero} />}
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Headline</p>
          {round.headline ? (
            <p className="mt-1 text-xl font-semibold leading-snug">{round.headline}</p>
          ) : (
            <p className="mt-1 text-muted-foreground">No headline for this round. <Link href={`/admin/${event.id}/headlines`} className="text-primary underline-offset-4 hover:underline">Write one</Link></p>
          )}
          {round.headline_detail && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{round.headline_detail}</p>}
        </div>

        {s === "pending" && (
          <Step hint="Teams will see the headline immediately. The trading window stays closed until you open it.">
            <Button size="lg" disabled={pending} onClick={() => run("Headline released", () => releaseHeadline(round.id))}>
              <Megaphone /> {round.headline ? "Release headline" : "Start round"} <ChevronRight />
            </Button>
          </Step>
        )}
        {s === "headline_released" && (
          <Step hint={`Give teams a moment to read, then open the window. It closes automatically after ${Math.floor(event.round_duration_sec / 60)}m ${event.round_duration_sec % 60}s.`}>
            <Button size="lg" disabled={pending} onClick={() => run("Trading window open", () => openWindow(round.id))}>
              <Play /> Open trading window <ChevronRight />
            </Button>
          </Step>
        )}
        {s === "window_open" && (
          <Step hint="Trading is live. The window closes on its own at 0:00 — use this only to end it early.">
            <Button size="lg" variant="destructive" disabled={pending} onClick={() => run("Window closed", () => closeWindow(round.id))}>
              <Square /> Close window now
            </Button>
          </Step>
        )}
        {s === "window_closed" && <PriceEditor round={round} companies={companies} pending={pending} run={run} />}
      </div>
    </Card>
  );
}

function Step({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed p-4">
      {children}
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Parses "Suggested moves: TCS -7%, INFY +3%" out of the headline detail so the organiser can fill with one click. */
function parseSuggested(detail: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  const m = detail?.match(/suggested moves?:\s*(.+)$/im);
  if (!m) return out;
  for (const part of m[1].split(/,|;/)) {
    const mm = part.trim().match(/^([A-Z0-9&.-]+)\s*([+-]?\d+(?:\.\d+)?)\s*%?$/i);
    if (mm) out[mm[1].toUpperCase()] = Number(mm[2]);
  }
  return out;
}

function PriceEditor({ round, companies, pending, run }: { round: Round; companies: Company[]; pending: boolean; run: (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => void }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"price" | "pct">("pct");
  const suggested = useMemo(() => parseSuggested(round.headline_detail), [round.headline_detail]);

  const newPriceOf = (c: Company): number | null => {
    const raw = inputs[c.id];
    if (raw === undefined || raw.trim() === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const np = mode === "pct" ? Number(c.current_price) * (1 + n / 100) : n;
    return Math.round(np * 100) / 100;
  };
  const changes = companies.map((c) => ({ c, np: newPriceOf(c) })).filter((x) => x.np !== null && x.np !== Number(x.c.current_price));

  const fillSuggested = () => {
    const next: Record<string, string> = {};
    for (const c of companies) if (suggested[c.ticker] !== undefined) next[c.id] = mode === "pct" ? String(suggested[c.ticker]) : String(Math.round(Number(c.current_price) * (1 + suggested[c.ticker] / 100) * 100) / 100);
    setInputs(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Enter new prices</p>
          <p className="text-sm text-muted-foreground">Leave a company blank to keep its price. Only companies the headline affects should move.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-xs">
            {(["pct", "price"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setInputs({}); }} className={cn("rounded px-2 py-1", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{m === "pct" ? "% change" : "₹ price"}</button>
            ))}
          </div>
          {Object.keys(suggested).length > 0 && <Button variant="secondary" size="sm" onClick={fillSuggested}><Wand2 /> Fill suggested</Button>}
          <Button variant="ghost" size="sm" onClick={() => setInputs({})}>Clear</Button>
        </div>
      </div>
      <div className="max-h-[440px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Now</TableHead>
              <TableHead className="w-36">{mode === "pct" ? "Change %" : "New price ₹"}</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead className="text-right">Δ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => {
              const np = newPriceOf(c);
              const delta = np === null ? 0 : ((np - Number(c.current_price)) / Number(c.current_price)) * 100;
              const hint = suggested[c.ticker];
              return (
                <TableRow key={c.id} className={cn(np !== null && np !== Number(c.current_price) && "bg-accent/40")}>
                  <TableCell>
                    <span className="font-mono font-semibold">{c.ticker}</span>
                    <span className="ml-2 text-muted-foreground">{c.name}</span>
                    {hint !== undefined && <span className="ml-2 text-xs text-primary">suggested {pct(hint, 0)}</span>}
                  </TableCell>
                  <TableCell className="num text-right font-mono">{fmtPrice(c.current_price)}</TableCell>
                  <TableCell>
                    <Input inputMode="decimal" className="h-9 font-mono" placeholder={mode === "pct" ? "0" : String(c.current_price)} value={inputs[c.id] ?? ""} onChange={(e) => setInputs({ ...inputs, [c.id]: e.target.value })} />
                  </TableCell>
                  <TableCell className="num text-right font-mono">{np === null ? <span className="text-muted-foreground">—</span> : fmtPrice(np)}</TableCell>
                  <TableCell className={cn("num text-right font-mono", delta > 0 && "text-gain", delta < 0 && "text-loss")}>{np === null ? "" : pct(delta)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{changes.length} of {companies.length} companies will move.</p>
        <Button size="lg" disabled={pending} onClick={() => run("Prices applied", () => applyPrices(round.id, changes.map(({ c, np }) => ({ company_id: c.id, new_price: np! }))))}>
          <Check /> Apply prices & finish round {round.round_no}
        </Button>
      </div>
    </div>
  );
}
