"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Megaphone, Play, Square, Undo2, Wand2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Countdown } from "@/components/countdown";
import { useEventRealtime } from "@/hooks/use-event-realtime";
import { compactRupees, integer, pct, price as fmtPrice, rupees } from "@/lib/format";
import type { RoundNotes } from "@/lib/round-notes";
import { suggestedMovesByTicker } from "@/lib/suggested-moves";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { applyPrices, closeWindow, fireActOfGod, openWindow, releaseHeadline, undoPrices } from "../actions";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Round = Database["public"]["Tables"]["rounds"]["Row"] & RoundNotes;
type Company = Database["public"]["Tables"]["companies"]["Row"];
type Leader = Database["public"]["Views"]["leaderboard_view"]["Row"];
type FeedOrder = {
  id: number; round_id: string; side: "buy" | "sell"; shares: number; price: number; value: number; created_at: string;
  team: { id: string; name: string | null; join_code: string } | null; company: { id: string; ticker: string } | null;
};
type Run = (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => void;

const STATE_LABEL: Record<Round["state"], string> = {
  pending: "Not started", headline_released: "Headline out", window_open: "Trading open", window_closed: "Window closed", prices_applied: "Done",
};

export function ControlRoom({ event, rounds, companies, orders, leaderboard, teams }: {
  event: Event; rounds: Round[]; companies: Company[]; orders: FeedOrder[]; leaderboard: Leader[]; teams: { total: number; joined: number };
}) {
  // Trades stream in fast during a window: refresh often so the order flow is live.
  useEventRealtime(event.id, undefined, undefined, 3000);
  const [pending, start] = useTransition();
  const active = rounds.find((r) => r.state !== "prices_applied") ?? null;
  const lastApplied = [...rounds].reverse().find((r) => r.state === "prices_applied") ?? null;
  const finished = !active;
  const trading = active?.state === "window_open" || active?.state === "window_closed";

  const run: Run = (label, fn) =>
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
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* round stepper — ⚡ marks rounds with an Act of God ready (or fired) */}
        <ol className="flex flex-wrap gap-2">
          {rounds.map((r) => (
            <li key={r.id} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              r.state === "prices_applied" && "border-gain/40 bg-gain-soft text-gain",
              r.id === active?.id && "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30",
              r.state === "pending" && r.id !== active?.id && "text-muted-foreground")}>
              {r.state === "prices_applied" ? <Check className="size-3" /> : <span className="font-mono">{r.round_no}</span>}
              <span>Round {r.round_no}</span>
              {(r.draft || r.shock_at) && <Zap className={cn("size-3", r.shock_at ? "fill-current text-loss" : "text-loss")} aria-label="Act of God" />}
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

        {active?.state === "window_open" && <ActOfGod key={active.id} round={active} companies={companies} pending={pending} run={run} />}
        {trading && <OrderFlow orders={orders.filter((o) => o.round_id === active!.id)} companies={companies} />}

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
            {leaderboard.slice(0, 10).map((l) => (
              <li key={l.team_id} className="flex items-center justify-between gap-2">
                <span className="truncate"><span className="mr-2 font-mono text-muted-foreground">{l.rank}</span>{l.name}</span>
                <span className="num shrink-0 font-mono">{compactRupees(l.total_value)}</span>
              </li>
            ))}
            {!leaderboard.length && <li className="text-muted-foreground">No teams yet.</li>}
          </ol>
        </Card>
        <LiveOrders orders={orders} title={trading ? `Orders this round (${orders.filter((o) => o.round_id === active!.id).length})` : "Recent orders"} />
      </aside>
    </div>
  );
}

function ActiveRound({ event, round, companies, pending, run, onZero }: {
  event: Event; round: Round; companies: Company[]; pending: boolean; run: Run; onZero: () => void;
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
          {round.suggested_moves && <p className="mt-2 text-xs text-primary"><span className="font-semibold">Private hint:</span> {round.suggested_moves}</p>}
          {round.shock_at && (
            <div className="mt-3 rounded-lg border border-loss/40 bg-loss-soft p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-loss"><Zap className="size-3.5 fill-current" /> Act of God fired · +{round.shock_extend_sec ?? 0}s</p>
              <p className="mt-1 font-semibold">{round.shock_headline}</p>
              {round.shock_detail && <p className="text-sm text-muted-foreground">{round.shock_detail}</p>}
            </div>
          )}
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

// ------------------------------------------------------------------ Act of God
/** Breaking news mid-window: moves prices at once and adds time. Prefilled from the round's draft. */
function ActOfGod({ round, companies, pending, run }: { round: Round; companies: Company[]; pending: boolean; run: Run }) {
  const draft = round.draft;
  const [headline, setHeadline] = useState(draft?.headline ?? "");
  const [detail, setDetail] = useState(draft?.detail ?? "");
  const [extend, setExtend] = useState(String(draft?.extend_sec ?? 60));
  const [open, setOpen] = useState(!!draft);
  const [confirming, setConfirming] = useState(false);
  const table = usePriceTable(companies, draft?.moves ?? null, true);
  useEffect(() => { if (!confirming) return; const t = setTimeout(() => setConfirming(false), 5000); return () => clearTimeout(t); }, [confirming]);

  if (round.shock_at) return null; // shown on the round card instead

  const extendSec = Number(extend);
  const valid = headline.trim().length > 0 && Number.isInteger(extendSec) && extendSec >= 0 && extendSec <= 600;
  const fire = () => {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    run("Act of God fired", () => fireActOfGod(round.id, { headline, detail: detail || null, extend_sec: extendSec },
      table.changes.map(({ c, np }) => ({ company_id: c.id, new_price: np! }))));
  };

  return (
    <Card className="overflow-hidden border-loss/40">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 bg-loss-soft px-5 py-3 text-left">
        <span className="flex items-center gap-2 font-heading text-lg font-bold text-loss"><Zap className="size-5 fill-current" /> Act of God</span>
        <span className="text-xs text-muted-foreground">{draft ? "Draft ready for this round" : "Optional — breaking news mid-window"} · {open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">Prices move the moment you fire, teams see a BREAKING banner, and the window gets extra time. Trades after this use the new prices. One per round.</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Input aria-label="Act of God headline" placeholder="Breaking: …" maxLength={200} value={headline} onChange={(e) => setHeadline(e.target.value)} className="font-semibold" />
            <div className="flex items-center gap-2">
              <Input aria-label="Extra seconds" inputMode="numeric" value={extend} onChange={(e) => setExtend(e.target.value.replace(/\D/g, ""))} className="font-mono" />
              <span className="text-sm text-muted-foreground">sec</span>
            </div>
          </div>
          <Textarea aria-label="Act of God detail" placeholder="Detail teams will see (optional)" maxLength={2000} value={detail} onChange={(e) => setDetail(e.target.value)} className="min-h-16 text-sm" />
          <PriceTable table={table} companies={companies} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{table.changes.length} of {companies.length} companies will move · +{Number.isFinite(extendSec) ? extendSec : 0}s</p>
            <Button size="lg" variant="destructive" disabled={pending || !valid} onClick={fire} className={cn(confirming && "animate-pulse")}>
              <Zap className="fill-current" /> {confirming ? "Click again to fire now" : "Fire Act of God"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ order flow
/** Where the crowd is piling in this round — so the organiser knows where to aim. */
function OrderFlow({ orders, companies }: { orders: FeedOrder[]; companies: Company[] }) {
  const rows = useMemo(() => {
    const by = new Map<string, { ticker: string; name: string; bought: number; sold: number; teams: Set<string>; buyers: Set<string>; sellers: Set<string> }>();
    const names = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    for (const o of orders) {
      if (!o.company) continue;
      const r = by.get(o.company.id) ?? { ticker: o.company.ticker, name: names[o.company.id] ?? "", bought: 0, sold: 0, teams: new Set(), buyers: new Set(), sellers: new Set() };
      const team = o.team?.id ?? "";
      if (o.side === "buy") { r.bought += Number(o.value); r.buyers.add(team); } else { r.sold += Number(o.value); r.sellers.add(team); }
      r.teams.add(team);
      by.set(o.company.id, r);
    }
    return [...by.values()].map((r) => ({ ...r, net: r.bought - r.sold })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [orders, companies]);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.bought, r.sold)));
  const totalBought = rows.reduce((s, r) => s + r.bought, 0);
  const totalSold = rows.reduce((s, r) => s + r.sold, 0);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-lg font-bold">Order flow this round</h3>
        <p className="text-sm text-muted-foreground">
          <span className="text-gain">{compactRupees(totalBought)} bought</span> · <span className="text-loss">{compactRupees(totalSold)} sold</span> · {orders.length} orders
        </p>
      </div>
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.ticker} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono font-semibold">{r.ticker}</p>
                <p className="truncate text-xs text-muted-foreground">{r.teams.size} team{r.teams.size === 1 ? "" : "s"}{r.buyers.size && r.sellers.size ? ` · ${r.buyers.size} buy / ${r.sellers.size} sell` : ""}</p>
              </div>
              {/* sells grow left from the centre line, buys grow right */}
              <div className="grid grid-cols-2 items-center">
                <div className="flex justify-end border-r border-border pr-0.5"><div className="h-3 rounded-l bg-loss/70" style={{ width: `${(r.sold / max) * 100}%` }} /></div>
                <div className="pl-0.5"><div className="h-3 rounded-r bg-gain/70" style={{ width: `${(r.bought / max) * 100}%` }} /></div>
              </div>
              <p className={cn("num w-24 text-right font-mono font-semibold", r.net > 0 && "text-gain", r.net < 0 && "text-loss")}>{r.net > 0 ? "+" : r.net < 0 ? "−" : ""}{compactRupees(Math.abs(r.net))}</p>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">Bars: red = sold, green = bought. Right column: net buying (+) or selling (−).</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No trades yet this round. They&apos;ll appear here as teams place them.</p>
      )}
    </Card>
  );
}

function LiveOrders({ orders, title }: { orders: FeedOrder[]; title: string }) {
  // Flash orders that arrived since the last render.
  const seen = useRef<Set<number> | null>(null);
  const fresh = new Set<number>();
  if (seen.current) for (const o of orders) if (!seen.current.has(o.id)) fresh.add(o.id);
  useEffect(() => { seen.current = new Set(orders.map((o) => o.id)); }, [orders]);

  return (
    <Card className="p-4">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 max-h-[560px] space-y-1 overflow-y-auto text-sm">
        {orders.map((o) => (
          <li key={o.id} className={cn("flex items-center justify-between gap-2 rounded px-1 py-0.5", fresh.has(o.id) && (o.side === "buy" ? "flash-gain" : "flash-loss"))}>
            <span className="min-w-0 truncate">
              <span className={cn("mr-1.5 rounded px-1 text-[10px] font-bold uppercase", o.side === "buy" ? "bg-gain-soft text-gain" : "bg-loss-soft text-loss")}>{o.side}</span>
              <span className="font-medium">{o.team?.name ?? o.team?.join_code}</span> · {integer(o.shares)} {o.company?.ticker} <span className="text-muted-foreground">@ {fmtPrice(o.price)}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="num block font-mono">{compactRupees(o.value)}</span>
              <span className="block text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </span>
          </li>
        ))}
        {!orders.length && <li className="text-muted-foreground">Orders will stream here.</li>}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------------ price table
type PriceTableState = ReturnType<typeof usePriceTable>;

/** Shared by the end-of-round price editor and the Act of God card. */
function usePriceTable(companies: Company[], suggestedText: string | null, prefill = false) {
  const suggested = useMemo(() => suggestedMovesByTicker(suggestedText), [suggestedText]);
  const fromSuggested = (m: "pct" | "price") => {
    const next: Record<string, string> = {};
    for (const c of companies) if (suggested[c.ticker] !== undefined) next[c.id] = m === "pct" ? String(suggested[c.ticker]) : String(Math.round(Number(c.current_price) * (1 + suggested[c.ticker] / 100) * 100) / 100);
    return next;
  };
  const [mode, setModeState] = useState<"price" | "pct">("pct");
  const [inputs, setInputs] = useState<Record<string, string>>(() => (prefill ? fromSuggested("pct") : {}));

  const newPriceOf = (c: Company): number | null => {
    const raw = inputs[c.id];
    if (raw === undefined || raw.trim() === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const np = mode === "pct" ? Number(c.current_price) * (1 + n / 100) : n;
    return Math.round(np * 100) / 100;
  };
  const changes = companies.map((c) => ({ c, np: newPriceOf(c) })).filter((x) => x.np !== null && x.np > 0 && x.np !== Number(x.c.current_price));
  return {
    mode, inputs, suggested, changes, newPriceOf,
    setMode: (m: "price" | "pct") => { setModeState(m); setInputs({}); },
    setInput: (id: string, v: string) => setInputs((prev) => ({ ...prev, [id]: v })),
    fill: () => setInputs(fromSuggested(mode)),
    clear: () => setInputs({}),
  };
}

function PriceTable({ table, companies }: { table: PriceTableState; companies: Company[] }) {
  const { mode, inputs, suggested, newPriceOf } = table;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex rounded-md border p-0.5 text-xs">
          {(["pct", "price"] as const).map((m) => (
            <button key={m} type="button" onClick={() => table.setMode(m)} className={cn("rounded px-2 py-1", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{m === "pct" ? "% change" : "₹ price"}</button>
          ))}
        </div>
        {Object.keys(suggested).length > 0 && <Button variant="secondary" size="sm" onClick={table.fill}><Wand2 /> Fill suggested</Button>}
        <Button variant="ghost" size="sm" onClick={table.clear}>Clear</Button>
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
                    <Input inputMode="decimal" className="h-9 font-mono" placeholder={mode === "pct" ? "0" : String(c.current_price)} value={inputs[c.id] ?? ""} onChange={(e) => table.setInput(c.id, e.target.value)} />
                  </TableCell>
                  <TableCell className="num text-right font-mono">{np === null ? <span className="text-muted-foreground">—</span> : fmtPrice(np)}</TableCell>
                  <TableCell className={cn("num text-right font-mono", delta > 0 && "text-gain", delta < 0 && "text-loss")}>{np === null ? "" : pct(delta)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PriceEditor({ round, companies, pending, run }: { round: Round; companies: Company[]; pending: boolean; run: Run }) {
  const table = usePriceTable(companies, round.suggested_moves);
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">Enter new prices</p>
        <p className="text-sm text-muted-foreground">Leave a company blank to keep its price. Only companies the headline affects should move.</p>
      </div>
      <PriceTable table={table} companies={companies} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{table.changes.length} of {companies.length} companies will move.</p>
        <Button size="lg" disabled={pending} onClick={() => run("Prices applied", () => applyPrices(round.id, table.changes.map(({ c, np }) => ({ company_id: c.id, new_price: np! }))))}>
          <Check /> Apply prices & finish round {round.round_no}
        </Button>
      </div>
    </div>
  );
}
