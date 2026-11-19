"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/countdown";
import { useEventRealtime } from "@/hooks/use-event-realtime";
import { useCountdown } from "@/hooks/use-server-clock";
import { pct, price as fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Event = { id: string; name: string; status: string; total_rounds: number; starting_capital: number };
type Round = {
  id: string; round_no: number; headline: string | null; headline_detail: string | null; state: string; window_closes_at: string | null;
  shock_headline: string | null; shock_detail: string | null; shock_extend_sec: number | null; shock_at: string | null;
};
type Company = { id: string; name: string; ticker: string; sector: string | null; current_price: number; last_change_pct: number };
type View = "headline" | "prices";

export function DisplayBoard({ host, event, rounds, companies, pinned }: { host: string; event: Event; rounds: Round[]; companies: Company[]; pinned: View | null }) {
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
  // Team values and ranks are private to the organiser, so the projector shows only news and prices.
  const sections: View[] = pinned ? [pinned] : ["headline", "prices"];


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
              <p className="font-heading text-3xl font-bold">Market closed</p>
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
              {v === "headline" && <Headline active={active} windowOpen={windowOpen} secondsLeft={secondsLeft} finished={finished} />}
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

const SECTION_LABEL: Record<View, string> = { headline: "Headline", prices: "Market prices" };

function stateLabel(state: string | undefined) {
  switch (state) {
    case "headline_released": return "Read the news";
    case "window_closed": return "Prices updating…";
    case "pending": return "Starting soon";
    default: return "Waiting";
  }
}

function Headline({ active, windowOpen, secondsLeft, finished }: { active: Round | null; windowOpen: boolean; secondsLeft: number | null; finished: boolean }) {
  if (finished) {
    return <Center><p className="font-heading text-7xl font-extrabold">Market closed</p><p className="mt-6 text-3xl text-white/60">Thank you for trading. Results will be announced by the organisers.</p></Center>;
  }
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
