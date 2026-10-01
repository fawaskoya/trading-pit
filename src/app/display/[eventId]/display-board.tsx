"use client";
import { useEffect, useMemo, useState } from "react";
import { Countdown } from "@/components/countdown";
import { useEventRealtime } from "@/hooks/use-event-realtime";
import { useCountdown } from "@/hooks/use-server-clock";
import { compactRupees, pct, price as fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Event = { id: string; name: string; status: string; total_rounds: number; starting_capital: number };
type Round = { id: string; round_no: number; headline: string | null; headline_detail: string | null; state: string; window_closes_at: string | null };
type Company = { id: string; name: string; ticker: string; sector: string | null; current_price: number; last_change_pct: number };
type Leader = { team_id: string | null; name: string | null; college: string | null; total_value: number | null; rank: number | null; change_this_round: number | null; change_this_round_pct: number | null; pnl: number | null };
type Point = { team_id: string | null; round_no: number | null; total_value: number | null };
type View = "leaderboard" | "headline" | "prices";

const ROTATE_MS = 12000;

export function DisplayBoard({ host, event, rounds, companies, leaders, curve, pinned }: { host: string; event: Event; rounds: Round[]; companies: Company[]; leaders: Leader[]; curve: Point[]; pinned: View | null }) {
  // The projector is anonymous, so it can't subscribe to team/holdings changes — the hook's poll covers those.
  useEventRealtime(event.id, ["rounds", "companies"], undefined, 5000);

  const active = rounds.find((r) => r.state !== "prices_applied") ?? null;
  const lastApplied = [...rounds].reverse().find((r) => r.state === "prices_applied") ?? null;
  // The projector is anonymous and can't see pending rounds, so "no active round" may just mean
  // "between rounds" — only the event status says the game is over.
  const finished = event.status === "finished";
  const upcomingNo = active?.round_no ?? (lastApplied ? Math.min(lastApplied.round_no + 1, event.total_rounds) : 1);
  const windowOpen = active?.state === "window_open";
  const secondsLeft = useCountdown(windowOpen ? active?.window_closes_at : null);

  // Rotation: pinned view wins; when a window is open, alternate headline ↔ leaderboard; otherwise cycle all three.
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), ROTATE_MS); return () => clearInterval(id); }, []);
  const view: View = pinned ?? (finished ? "leaderboard" : windowOpen ? (["headline", "leaderboard"] as View[])[tick % 2] : (["leaderboard", "headline", "prices"] as View[])[tick % 3]);

  const spark = useMemo(() => {
    const byTeam: Record<string, number[]> = {};
    for (const p of curve) if (p.team_id) (byTeam[p.team_id] ??= [Number(event.starting_capital)]).push(Number(p.total_value));
    return byTeam;
  }, [curve, event.starting_capital]);

  return (
    <div className="dark min-h-dvh bg-[oklch(0.13_0.02_265)] text-[oklch(0.96_0.01_85)] [font-feature-settings:'tnum']">
      <div className="pit-hero flex min-h-dvh flex-col px-10 py-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[oklch(0.8_0.15_75)]">Trading Pit · Live</p>
            <h1 className="font-heading text-4xl font-extrabold">{event.name}</h1>
          </div>
          <div className="text-right">
            {finished ? (
              <p className="font-heading text-3xl font-bold">Final results</p>
            ) : (
              <>
                <p className="text-sm uppercase tracking-[0.3em] text-white/60">Round {upcomingNo} of {event.total_rounds}</p>
                {windowOpen ? (
                  <Countdown closesAt={active?.window_closes_at} className={cn("font-heading text-6xl font-extrabold leading-none", secondsLeft !== null && secondsLeft <= 10 && "animate-pulse")} />
                ) : (
                  <p className="font-heading text-3xl font-bold text-white/80">{stateLabel(active?.state ?? (lastApplied ? "pending" : undefined))}</p>
                )}
              </>
            )}
          </div>
        </header>

        <main className="mt-8 flex-1">
          {view === "leaderboard" && <Leaderboard leaders={leaders} spark={spark} finished={finished} lastRound={lastApplied?.round_no ?? null} />}
          {view === "headline" && <Headline active={active} windowOpen={windowOpen} secondsLeft={secondsLeft} />}
          {view === "prices" && <Prices companies={companies} />}
        </main>

        <footer className="mt-6 flex items-center justify-between text-sm text-white/40">
          <span>Join at <span className="font-mono text-white/70">{host}/play</span></span>
          <span className="flex gap-2">{(["leaderboard", "headline", "prices"] as View[]).map((v) => <span key={v} className={cn("size-2 rounded-full", v === view ? "bg-[oklch(0.8_0.15_75)]" : "bg-white/20")} />)}</span>
        </footer>
      </div>
    </div>
  );
}

function stateLabel(state: string | undefined) {
  switch (state) {
    case "headline_released": return "Read the news";
    case "window_closed": return "Prices updating…";
    case "pending": return "Starting soon";
    default: return "Waiting";
  }
}

function Leaderboard({ leaders, spark, finished, lastRound }: { leaders: Leader[]; spark: Record<string, number[]>; finished: boolean; lastRound: number | null }) {
  const top = leaders.slice(0, 12);
  return (
    <div>
      <div className="mb-3 grid grid-cols-[4rem_1fr_14rem_12rem_10rem] items-end gap-4 px-6 text-sm uppercase tracking-[0.2em] text-white/50">
        <span>#</span><span>Team</span><span className="text-right">Portfolio</span><span className="text-right">{lastRound ? `Round ${lastRound}` : "Change"}</span><span className="text-right">Trend</span>
      </div>
      <ol className="space-y-2">
        {top.map((l, i) => {
          const d = Number(l.change_this_round ?? 0);
          return (
            <li key={l.team_id} className={cn("grid grid-cols-[4rem_1fr_14rem_12rem_10rem] items-center gap-4 rounded-2xl px-6 py-3 ring-1 ring-white/10", i === 0 ? "bg-[oklch(0.8_0.15_75)]/15 ring-[oklch(0.8_0.15_75)]/50" : "bg-white/[0.04]")}>
              <span className={cn("font-heading text-4xl font-extrabold", i === 0 && "text-[oklch(0.8_0.15_75)]")}>{finished && i === 0 ? "🏆" : l.rank}</span>
              <div className="min-w-0">
                <p className="truncate font-heading text-3xl font-bold">{l.name}</p>
                {l.college && <p className="truncate text-base text-white/50">{l.college}</p>}
              </div>
              <span className="num text-right font-mono text-3xl font-semibold">{compactRupees(l.total_value)}</span>
              <span className={cn("num text-right font-mono text-2xl", d > 0 && "text-[oklch(0.78_0.17_155)]", d < 0 && "text-[oklch(0.72_0.19_25)]", d === 0 && "text-white/40")}>{d === 0 ? "—" : `${d > 0 ? "▲" : "▼"} ${pct(l.change_this_round_pct, 1)}`}</span>
              <Sparkline points={spark[l.team_id ?? ""] ?? []} />
            </li>
          );
        })}
        {!top.length && <li className="py-20 text-center text-3xl text-white/40">Teams are joining…</li>}
      </ol>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="block h-10" />;
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1;
  const w = 140, h = 40;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / range) * (h - 4) - 2}`).join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="ml-auto h-10 w-[140px]" preserveAspectRatio="none">
      <polyline points={d} fill="none" stroke={up ? "oklch(0.78 0.17 155)" : "oklch(0.72 0.19 25)"} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Headline({ active, windowOpen, secondsLeft }: { active: Round | null; windowOpen: boolean; secondsLeft: number | null }) {
  if (!active || active.state === "pending") {
    return <Center><p className="font-heading text-6xl font-extrabold text-white/80">Next round starting soon</p><p className="mt-4 text-3xl text-white/50">Get your strategy ready.</p></Center>;
  }
  return (
    <Center>
      <p className="mb-6 text-2xl uppercase tracking-[0.3em] text-[oklch(0.8_0.15_75)]">Breaking · Round {active.round_no}</p>
      <h2 className="max-w-5xl font-heading text-7xl font-extrabold leading-[1.05]">{active.headline ?? "No headline this round — trade on instinct."}</h2>
      {active.headline_detail && <p className="mt-6 max-w-4xl text-3xl leading-snug text-white/70">{active.headline_detail}</p>}
      {windowOpen && (
        <div className="mt-12">
          <p className="text-2xl uppercase tracking-[0.3em] text-white/50">Trading window closes in</p>
          <Countdown closesAt={active.window_closes_at} className={cn("font-heading text-[9rem] font-extrabold leading-none", secondsLeft !== null && secondsLeft <= 10 && "animate-pulse")} />
        </div>
      )}
      {active.state === "window_closed" && <p className="mt-12 text-4xl font-bold text-white/70">Window closed — new prices incoming</p>}
      {active.state === "headline_released" && <p className="mt-12 text-4xl font-bold text-[oklch(0.78_0.17_155)]">Window opens shortly — discuss with your partner!</p>}
    </Center>
  );
}

function Prices({ companies }: { companies: Company[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {companies.map((c) => {
        const ch = Number(c.last_change_pct);
        return (
          <div key={c.id} className={cn("rounded-2xl p-5 ring-1", ch > 0 && "bg-[oklch(0.78_0.17_155)]/10 ring-[oklch(0.78_0.17_155)]/40", ch < 0 && "bg-[oklch(0.72_0.19_25)]/10 ring-[oklch(0.72_0.19_25)]/40", ch === 0 && "bg-white/[0.04] ring-white/10")}>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold">{c.ticker}</span>
              <span className={cn("num font-mono text-2xl font-semibold", ch > 0 && "text-[oklch(0.78_0.17_155)]", ch < 0 && "text-[oklch(0.72_0.19_25)]", ch === 0 && "text-white/40")}>{ch === 0 ? "—" : `${ch > 0 ? "▲" : "▼"} ${pct(Math.abs(ch), 1).replace("+", "")}`}</span>
            </div>
            <p className="truncate text-base text-white/50">{c.name}</p>
            <p className="num mt-2 font-mono text-3xl font-semibold">{fmtPrice(c.current_price)}</p>
          </div>
        );
      })}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-[60dvh] flex-col items-center justify-center text-center">{children}</div>;
}
