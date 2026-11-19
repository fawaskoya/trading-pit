"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock, Newspaper, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { AuthWatch } from "@/components/auth-watch";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Countdown } from "@/components/countdown";
import { Card } from "@/components/ui/card";
import { useEventRealtime } from "@/hooks/use-event-realtime";
import { useCountdown } from "@/hooks/use-server-clock";
import { compactRupees, integer, pct, price as fmtPrice, rupees, signed } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { LeaveTeamButton } from "./leave-team-button";
import { TradeDrawer } from "./trade-drawer";
import { HistoryTab } from "./history-tab";
import { HeadlineFeed } from "./headline-feed";

export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Event = Database["public"]["Tables"]["events"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Round = Database["public"]["Tables"]["rounds"]["Row"];
export type Holding = { company_id: string; shares: number };
export type Order = { id: number; round_id: string; company_id: string; side: "buy" | "sell"; shares: number; price: number; value: number; fee: number; created_at: string };
export type Leader = { team_id: string | null; name: string | null; rank: number | null; total_value: number | null; trade_count: number | null };
type Me = { rank: number | null; total_value: number | null; change_this_round: number | null; pnl: number | null };
export type PriceUpdate = { round_id: string; company_id: string; old_price: number; new_price: number };
export type Snapshot = { round_id: string; total_value: number; cash: number; holdings_value: number };

export function PlayScreen({ team, event, companies, rounds, holdings, me, orders, leaders, priceUpdates, shockMoves, snapshots }: {
  team: Team; event: Event; companies: Company[]; rounds: Round[]; holdings: Holding[]; me: Me | null; orders: Order[]; leaders: Leader[]; priceUpdates: PriceUpdate[]; shockMoves: PriceUpdate[]; snapshots: Snapshot[];
}) {
  const router = useRouter();
  useEventRealtime(event.id, undefined, undefined, 5000);
  const [tab, setTab] = useState<"market" | "history" | "ranks">("market");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Look the company up live, so the trade sheet never shows a price an Act of God has just changed.
  const selected = companies.find((c) => c.id === selectedId) ?? null;

  // Teams can't see pending rounds (RLS hides unreleased headlines), so "no active round" can mean
  // either "between rounds" or "game over" — only the event status tells them apart.
  const active = rounds.find((r) => r.state !== "prices_applied") ?? null;
  const finished = event.status === "finished";
  const lastApplied = [...rounds].reverse().find((r) => r.state === "prices_applied") ?? null;
  const secondsLeft = useCountdown(active?.state === "window_open" ? active.window_closes_at : null);
  const tradingOpen = active?.state === "window_open" && (secondsLeft === null || secondsLeft > 0);
  // Until round 1's window opens, teams see only their own portfolio — no scrips, history or ranks.
  // (The database hides the companies too; this is just the matching layout.)
  const marketOpen = rounds.some((r) => r.state === "window_open" || r.state === "window_closed" || r.state === "prices_applied");
  const teamName = team.name ?? `Team ${team.join_code}`;
  // Before the first headline teams see nothing but their portfolio — no round card, no buttons.
  // The realtime refresh moves them on by itself when the organiser releases round 1.
  const initial = !finished && !rounds.some((r) => r.state !== "pending");
  const shocked = !!active?.shock_at && (active.state === "window_open" || active.state === "window_closed");

  // Act of God: make sure nobody misses it, even on the History or Ranks tab.
  const lastShock = useRef(active?.shock_at ?? null);
  useEffect(() => {
    const at = active?.shock_at ?? null;
    if (at && at !== lastShock.current) toast.error(`⚡ BREAKING: ${active?.shock_headline ?? "Act of God"}`, { duration: 8000 });
    lastShock.current = at;
  }, [active?.shock_at, active?.shock_headline]);

  // When our clock hits zero, ask the DB to close (idempotent) so everyone's UI flips together.
  const closedOnce = useRef(false);
  useEffect(() => {
    if (active?.state === "window_open" && secondsLeft === 0 && !closedOnce.current) {
      closedOnce.current = true;
      supabaseBrowser().rpc("close_expired_windows").then(() => router.refresh());
    }
    if (active?.state !== "window_open") closedOnce.current = false;
  }, [active?.state, secondsLeft, router]);

  const held = useMemo(() => Object.fromEntries(holdings.map((h) => [h.company_id, Number(h.shares)])), [holdings]);
  const invested = companies.reduce((s, c) => s + (held[c.id] ?? 0) * Number(c.current_price), 0);
  const total = Number(team.cash) + invested;
  const pnl = total - Number(event.starting_capital);
  const pnlPct = (pnl / Number(event.starting_capital)) * 100;
  const roundLabel = finished ? "Final results"
    : active ? `Round ${active.round_no} of ${event.total_rounds}`
    : lastApplied ? `Round ${lastApplied.round_no} of ${event.total_rounds} done`
    : "Waiting to start";

  if (initial) return (
    <div className="flex min-h-dvh flex-col">
      <AuthWatch role="team" />
      <header className="border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo href="/play" />
          <span className="max-w-[12rem] truncate text-sm font-semibold">{teamName}</span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="pit-hero w-full max-w-2xl p-8 text-center sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">Your company</p>
          <p className="mt-1 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">{teamName}</p>
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">Portfolio value</p>
          <p className="num mt-2 font-heading text-5xl font-extrabold tracking-tight sm:text-7xl">{rupees(total)}</p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-left">
            <div className="rounded-xl bg-background/60 p-5">
              <p className="text-sm text-muted-foreground">Cash to invest</p>
              <p className="num mt-1 text-2xl font-bold sm:text-3xl">{rupees(team.cash)}</p>
            </div>
            <div className="rounded-xl bg-background/60 p-5">
              <p className="text-sm text-muted-foreground">In shares</p>
              <p className="num mt-1 text-2xl font-bold sm:text-3xl">{rupees(invested)}</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );

  return (
    <div className="min-h-dvh pb-24">
      <AuthWatch role="team" />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4 lg:max-w-6xl">
          <Logo href="/play" />
          <div className="flex items-center gap-1">
            <span className="mr-1 max-w-[9rem] truncate text-sm font-semibold lg:max-w-xs">{teamName}</span>
            <ThemeToggle />
            <LeaveTeamButton teamName={teamName} />
          </div>
        </div>
      </header>

      {/* Phone: one column. Laptop: portfolio + headline stay pinned on the left, market on the right.
          Before trading opens there is no market, so it's one centred column everywhere. */}
      <main className={cn("mx-auto max-w-lg px-4 pt-4 lg:pt-6", marketOpen && "lg:grid lg:max-w-6xl lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start lg:gap-6")}>
        {/* On a laptop this column stays in view and scrolls on its own, so a long headline feed never pushes the portfolio away. */}
        <div className={cn("space-y-4", marketOpen && "lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pb-4 lg:pr-1")}>

        {/* Portfolio hero */}
        <Card className="pit-hero overflow-hidden p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{teamName}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Portfolio value</p>
              <p className="num mt-1 font-heading text-4xl font-extrabold tracking-tight">{rupees(total)}</p>
            </div>
            {marketOpen && (
              <div className="rounded-xl bg-primary/15 px-3 py-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rank</p>
                <p className="font-heading text-2xl font-extrabold leading-none">#{me?.rank ?? "–"}</p>
              </div>
            )}
          </div>
          <p className={cn("mt-2 text-sm font-medium", pnl > 0 && "text-gain", pnl < 0 && "text-loss", pnl === 0 && "text-muted-foreground")}>
            {pnl === 0 ? "You're at your starting capital." : pnl > 0 ? `You're up ${rupees(pnl)} (${pct(pnlPct)}) since the start.` : `You're down ${rupees(-pnl)} (${pct(pnlPct)}) since the start.`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Cash to spend</p>
              <p className="num font-semibold">{rupees(team.cash)}</p>
            </div>
            <div className="rounded-lg bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">In shares</p>
              <p className="num font-semibold">{rupees(invested)}</p>
            </div>
          </div>
        </Card>

        {/* Round / headline card */}
        <Card className={cn("p-5", tradingOpen && "ring-2 ring-gain/60", shocked && tradingOpen && "ring-loss/70")}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{roundLabel}</p>
            {active?.state === "window_open" && <Countdown closesAt={active.window_closes_at} className="text-2xl font-bold" />}
          </div>
          {shocked && !finished && (
            <div className="mt-3 rounded-lg bg-loss-soft p-3 text-loss">
              <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest"><Zap className="size-4 fill-current" /> Breaking</p>
              <p className="mt-1 text-lg font-bold leading-snug text-foreground">{active!.shock_headline}</p>
              {active!.shock_detail && <p className="mt-1 text-sm text-muted-foreground">{active!.shock_detail}</p>}
              {active!.state === "window_open" && !!active!.shock_extend_sec && <p className="mt-2 text-xs font-semibold">+{active!.shock_extend_sec}s added to the clock. Prices have moved.</p>}
            </div>
          )}
          {finished ? (
            <div className="mt-2 flex items-center gap-3">
              <Trophy className="size-8 text-primary" />
              <div>
                <p className="text-lg font-bold">The market has closed.</p>
                <p className="text-sm text-muted-foreground">You finished #{me?.rank ?? "–"} with {rupees(total)}. Check the Ranks tab.</p>
              </div>
            </div>
          ) : active && active.state !== "pending" && active.headline ? (
            <div className="mt-2 flex gap-3">
              <Newspaper className="mt-1 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-lg font-semibold leading-snug">{active.headline}</p>
                {active.headline_detail && <p className="mt-1 text-sm text-muted-foreground">{stripSuggested(active.headline_detail)}</p>}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">{active?.state === "pending" || !active ? (lastApplied ? `Round ${lastApplied.round_no + 1} starts soon — watch for the next headline.` : "Round 1 hasn't started yet. The organiser will release the first headline, then open trading.") : "No headline this round — trade on your instincts."}</p>
          )}
          <StateBanner state={active?.state ?? null} open={tradingOpen} finished={finished} secondsLeft={secondsLeft} marketOpen={marketOpen} />
        </Card>

        {/* Newest headline is the card above; earlier rounds sit below it, newest first. */}
        <HeadlineFeed rounds={rounds} excludeId={active && active.state !== "pending" ? active.id : null} />

        </div>

        {marketOpen && <div className="mt-4 space-y-4 lg:mt-0">
        {/* Tabs */}
        <div className="grid grid-cols-3 rounded-lg bg-muted p-1 text-sm font-medium lg:max-w-sm">
          {([["market", "Market"], ["history", "History"], ["ranks", "Ranks"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-md py-2 transition", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}>{label}</button>
          ))}
        </div>

        {tab === "market" && (
          <div className="space-y-2">
            <p className="px-1 text-xs text-muted-foreground">{tradingOpen ? "Select a company to buy or sell." : "Select a company to see details. Trading opens with the window."}</p>
            <div className="grid gap-2 xl:grid-cols-2">
              {companies.map((c) => <CompanyRow key={c.id} c={c} shares={held[c.id] ?? 0} onClick={() => setSelectedId(c.id)} />)}
            </div>
          </div>
        )}
        {tab === "history" && <HistoryTab event={event} rounds={rounds} companies={companies} orders={orders} priceUpdates={priceUpdates} shockMoves={shockMoves} snapshots={snapshots} currentTotal={total} />}
        {tab === "ranks" && <Ranks leaders={leaders} myId={team.id} />}
        </div>}
      </main>

      <TradeDrawer
        company={selected}
        onClose={() => setSelectedId(null)}
        team={team}
        event={event}
        held={selected ? held[selected.id] ?? 0 : 0}
        total={total}
        open={tradingOpen}
        reason={!active ? "The event hasn't started." : active.state === "window_open" ? null : active.state === "pending" || active.state === "headline_released" ? "The trading window hasn't opened yet." : "The trading window is closed."}
        onTraded={() => router.refresh()}
      />
    </div>
  );
}

function StateBanner({ state, open, finished, secondsLeft, marketOpen }: { state: Round["state"] | null; open: boolean; finished: boolean; secondsLeft: number | null; marketOpen: boolean }) {
  if (finished) return null;
  if (open) return (
    <div className={cn("mt-4 flex items-center gap-2 rounded-lg bg-gain-soft px-3 py-2 text-sm font-semibold text-gain", secondsLeft !== null && secondsLeft <= 10 && "bg-loss-soft text-loss")}>
      <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-current" /></span>
      {secondsLeft !== null && secondsLeft <= 10 ? "Last few seconds — confirm your trades!" : "Trading is open — buy, sell or hold"}
    </div>
  );
  const text = !marketOpen ? (state === "headline_released" ? "Read the news. The companies you can trade appear when the organiser opens trading." : "The market opens in round 1. Until then, this is your starting portfolio.")
    : state === "headline_released" ? "Read the news. The window opens when the organiser says go."
    : state === "window_closed" ? "Window closed. New prices are coming — watch the big screen."
    : state === "window_open" ? "Time's up — the window is closing."
    : "Trading closed until the next round starts.";
  return <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-muted-foreground"><Lock className="size-4" /> {text}</div>;
}

function CompanyRow({ c, shares, onClick }: { c: Company; shares: number; onClick: () => void }) {
  const change = Number(c.last_change_pct);
  const prev = useRef(Number(c.current_price));
  const [flash, setFlash] = useState<"" | "flash-gain" | "flash-loss">("");
  useEffect(() => {
    const now = Number(c.current_price);
    if (now !== prev.current) { setFlash(now > prev.current ? "flash-gain" : "flash-loss"); prev.current = now; const t = setTimeout(() => setFlash(""), 1300); return () => clearTimeout(t); }
  }, [c.current_price]);
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10 transition hover:ring-primary/50 active:scale-[0.99]", flash)}>
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted font-mono text-xs font-bold">{c.ticker.slice(0, 4)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.name}</p>
        <p className="truncate text-xs text-muted-foreground">{shares > 0 ? <span className="text-foreground">{integer(shares)} shares · {compactRupees(shares * Number(c.current_price))}</span> : c.sector ?? c.ticker}</p>
      </div>
      <div className="text-right">
        <p className="num font-mono font-semibold">{fmtPrice(c.current_price)}</p>
        <p className={cn("num text-xs font-medium", change > 0 && "text-gain", change < 0 && "text-loss", change === 0 && "text-muted-foreground")}>{change === 0 ? "no change" : pct(change)}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

function Ranks({ leaders, myId }: { leaders: Leader[]; myId: string }) {
  return (
    <Card className="divide-y">
      {leaders.map((l) => (
        <div key={l.team_id} className={cn("flex items-center gap-3 px-4 py-3", l.team_id === myId && "bg-primary/10")}>
          <span className="w-6 font-mono text-sm text-muted-foreground">{l.rank}</span>
          <span className="flex-1 truncate font-medium">{l.name}{l.team_id === myId && <span className="ml-2 text-xs text-primary">you</span>}</span>
          <span className="num font-mono text-sm">{compactRupees(l.total_value)}</span>
        </div>
      ))}
    </Card>
  );
}

export { signed };

/** Teams never see the organiser's "Suggested moves" hint line. */
export function stripSuggested(detail: string) {
  const i = detail.search(/suggested moves?:/i);
  return (i >= 0 ? detail.slice(0, i) : detail).trim();
}
