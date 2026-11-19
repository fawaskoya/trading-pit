"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "@/components/countdown";
import { useEventRealtime } from "@/hooks/use-event-realtime";
import { useCountdown } from "@/hooks/use-server-clock";
import { compactRupees, pct, price as fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Event = { id: string; name: string; status: string; total_rounds: number; starting_capital: number };
type Round = {
  id: string; round_no: number; headline: string | null; headline_detail: string | null; state: string; window_closes_at: string | null;
  shock_headline: string | null; shock_detail: string | null; shock_extend_sec: number | null; shock_at: string | null;
};
type Company = { id: string; name: string; ticker: string; sector: string | null; current_price: number; last_change_pct: number };
type Leader = { team_id: string | null; name: string | null; college: string | null; total_value: number | null; rank: number | null; change_this_round: number | null; change_this_round_pct: number | null; pnl: number | null };
type Point = { team_id: string | null; round_no: number | null; total_value: number | null };
type View = "leaderboard" | "headline" | "prices";

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

  // No auto-rotation: the organiser scrolls (wheel, Page Down or a presenter clicker). `?view=` pins one section.
  const shocked = !!active?.shock_at && (active.state === "window_open" || active.state === "window_closed");
  const sections: View[] = pinned ? [pinned] : finished ? ["leaderboard", "prices"] : ["headline", "leaderboard", "prices"];

  const spark = useMemo(() => {
    const byTeam: Record<string, number[]> = {};
    for (const p of curve) if (p.team_id) (byTeam[p.team_id] ??= [Number(event.starting_capital)]).push(Number(p.total_value));
    return byTeam;
  }, [curve, event.starting_capital]);

  // The panels sit side by side and the presenter moves between them: wheel, arrow keys, Page Down/Up or Space
  // (a clicker sends these), or the dots at the bottom. Nothing rotates by itself.
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const goTo = useCallback((i: number) => {
    const el = strip.current;
    if (!el) return;
    const n = Math.max(0, Math.min(sections.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }, [sections.length]);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    // A normal mouse wheel only scrolls up/down; turn it into a sideways move between panels.
    const onWheel = (e: WheelEvent) => {
      if (sections.length < 2 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const inner = (e.target as HTMLElement | null)?.closest("[data-vscroll]") as HTMLElement | null;
      if (inner && inner.scrollHeight > inner.clientHeight) {
        const atTop = inner.scrollTop <= 0 && e.deltaY < 0;
        const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 1 && e.deltaY > 0;
        if (!atTop && !atBottom) return; // let a tall panel scroll itself first
      }
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: "auto" });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const next = ["ArrowRight", "PageDown", " ", "Enter"].includes(e.key);
      const prev = ["ArrowLeft", "PageUp"].includes(e.key);
      if (!next && !prev && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      goTo(e.key === "Home" ? 0 : e.key === "End" ? sections.length - 1 : cur + (next ? 1 : -1));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => { el.removeEventListener("scroll", onScroll); el.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  }, [goTo, sections.length]);

  return (
    <div className="dark h-dvh overflow-hidden bg-[oklch(0.13_0.02_265)] text-[oklch(0.96_0.01_85)] [font-feature-settings:'tnum']">
      <div className="pit-hero flex h-dvh flex-col px-10 pb-5">
        <header className="flex shrink-0 items-center justify-between py-5">
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

        {shocked && !finished && (
          <div className="mb-3 flex shrink-0 items-center gap-6 rounded-2xl bg-[oklch(0.62_0.22_25)] px-8 py-4 text-white shadow-2xl">
            <span className="shrink-0 animate-pulse font-heading text-3xl font-extrabold uppercase tracking-[0.2em]">⚡ Breaking</span>
            <div className="min-w-0">
              <p className="font-heading text-3xl font-extrabold leading-tight">{active!.shock_headline}</p>
              {active!.shock_detail && <p className="mt-1 text-xl text-white/85">{active!.shock_detail}</p>}
            </div>
            {windowOpen && !!active!.shock_extend_sec && <span className="ml-auto shrink-0 text-2xl font-bold">+{active!.shock_extend_sec}s</span>}
          </div>
        )}

        {/* One panel per screen, side by side. Tall panels scroll up/down inside themselves. */}
        <main ref={strip} className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((v) => (
            <section key={v} id={v} data-vscroll className="h-full w-full shrink-0 snap-start overflow-y-auto pr-1">
              {sections.length > 1 && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-white/40">{SECTION_LABEL[v]}</p>}
              {v === "leaderboard" && <Leaderboard leaders={leaders} spark={spark} finished={finished} lastRound={lastApplied?.round_no ?? null} />}
              {v === "headline" && <Headline active={active} windowOpen={windowOpen} secondsLeft={secondsLeft} />}
              {v === "prices" && <Prices companies={companies} />}
            </section>
          ))}
        </main>

        <footer className="flex shrink-0 items-center justify-between pt-3 text-sm text-white/40">
          <span>Join at <span className="font-mono text-white/70">{host}/play</span></span>
          {sections.length > 1 && (
            <nav aria-label="Panels" className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest">← → to move</span>
              {sections.map((v, i) => (
                <button key={v} type="button" onClick={() => goTo(i)} aria-label={SECTION_LABEL[v]} aria-current={i === index}
                  className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest transition", i === index ? "bg-[oklch(0.8_0.15_75)] text-black" : "bg-white/10 text-white/60 hover:bg-white/20")}>
                  {SECTION_LABEL[v]}
                </button>
              ))}
            </nav>
          )}
        </footer>
      </div>
    </div>
  );
}

const SECTION_LABEL: Record<View, string> = { headline: "Headline", leaderboard: "Leaderboard", prices: "Market prices" };

function stateLabel(state: string | undefined) {
  switch (state) {
    case "headline_released": return "Read the news";
    case "window_closed": return "Prices updating…";
    case "pending": return "Starting soon";
    default: return "Waiting";
  }
}

function Leaderboard({ leaders, spark, finished, lastRound }: { leaders: Leader[]; spark: Record<string, number[]>; finished: boolean; lastRound: number | null }) {
  const top = leaders.slice(0, 20);
  // Up to 8 teams: big rows with a trend line. More than that: two compact columns so 15–20 teams fit one screen.
  const compact = top.length > 8;
  const change = (l: Leader) => Number(l.change_this_round ?? 0);
  if (compact) {
    const rows = Math.ceil(top.length / 2);
    return (
      <ol className="grid grid-flow-col gap-x-6 gap-y-2" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {top.map((l, i) => {
          const d = change(l);
          return (
            <li key={l.team_id} className={cn("grid grid-cols-[3rem_1fr_9rem_7.5rem] items-center gap-3 rounded-xl px-4 py-2 ring-1 ring-white/10", i === 0 ? "bg-[oklch(0.8_0.15_75)]/15 ring-[oklch(0.8_0.15_75)]/50" : "bg-white/[0.04]")}>
              <span className={cn("font-heading text-3xl font-extrabold", i === 0 && "text-[oklch(0.8_0.15_75)]")}>{finished && i === 0 ? "🏆" : l.rank}</span>
              <div className="min-w-0">
                <p className="truncate font-heading text-2xl font-bold leading-tight">{l.name}</p>
                {l.college && <p className="truncate text-sm text-white/50">{l.college}</p>}
              </div>
              <span className="num text-right font-mono text-2xl font-semibold">{compactRupees(l.total_value)}</span>
              <span className={cn("num text-right font-mono text-xl", d > 0 && "text-[oklch(0.78_0.17_155)]", d < 0 && "text-[oklch(0.72_0.19_25)]", d === 0 && "text-white/40")}>{d === 0 ? "—" : `${d > 0 ? "▲" : "▼"} ${pct(l.change_this_round_pct, 1)}`}</span>
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <div>
      <div className="mb-3 grid grid-cols-[4rem_1fr_14rem_12rem_10rem] items-end gap-4 px-6 text-sm uppercase tracking-[0.2em] text-white/50">
        <span>#</span><span>Team</span><span className="text-right">Portfolio</span><span className="text-right">{lastRound ? `Round ${lastRound}` : "Change"}</span><span className="text-right">Trend</span>
      </div>
      <ol className="space-y-2">
        {top.map((l, i) => {
          const d = change(l);
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
      <p className="mb-6 text-2xl uppercase tracking-[0.3em] text-[oklch(0.8_0.15_75)]">Headline · Round {active.round_no}</p>
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
  // The database hides the scrips from the projector until round 1's trading window opens.
  if (!companies.length) return (
    <Center>
      <p className="text-4xl font-bold">The market opens in round 1</p>
      <p className="mt-3 text-xl text-white/50">The companies are revealed when trading starts.</p>
    </Center>
  );
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
