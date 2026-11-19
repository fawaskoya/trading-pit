"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Zap } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { pct } from "@/lib/format";
import type { RoundNotes } from "@/lib/round-notes";
import { parseSuggestedMoves } from "@/lib/suggested-moves";
import { cn } from "@/lib/utils";
import { saveHeadline } from "../../actions";

type Round = Database["public"]["Tables"]["rounds"]["Row"] & RoundNotes;

export function HeadlinesEditor({ rounds, tickers }: { rounds: Round[]; tickers: string[] }) {
  const known = useMemo(() => new Set(tickers), [tickers]);
  const written = rounds.filter((r) => r.headline?.trim()).length;
  const shocks = rounds.filter((r) => r.draft?.headline.trim()).length;
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Headline library</h2>
          <p className="text-sm text-muted-foreground">{written} of {rounds.length} rounds have a headline · {shocks} Act{shocks === 1 ? "" : "s"} of God</p>
        </div>
        <p className="text-sm text-muted-foreground">Write every round&apos;s headline before the event. The private <em>suggested moves</em> field (e.g. <code className="rounded bg-muted px-1">TCS -7%, INFY +3%</code>) is only ever visible to you — the control room uses it to fill prices with one click. An optional <strong>Act of God</strong> is breaking news you fire mid-window: it moves prices at once and adds time. Use it in two or three rounds to punish the obvious trade.</p>
      </div>
      {rounds.map((r) => <RoundCard key={r.id} round={r} known={known} />)}
    </div>
  );
}

function RoundCard({ round, known }: { round: Round; known: Set<string> }) {
  const saved = {
    headline: round.headline ?? "", detail: round.headline_detail ?? "", moves: round.suggested_moves ?? "",
    sHeadline: round.draft?.headline ?? "", sDetail: round.draft?.detail ?? "", sMoves: round.draft?.moves ?? "", sExtend: String(round.draft?.extend_sec ?? 60),
  };
  const [headline, setHeadline] = useState(saved.headline);
  const [detail, setDetail] = useState(saved.detail);
  const [moves, setMoves] = useState(saved.moves);
  const [sHeadline, setSHeadline] = useState(saved.sHeadline);
  const [sDetail, setSDetail] = useState(saved.sDetail);
  const [sMoves, setSMoves] = useState(saved.sMoves);
  const [sExtend, setSExtend] = useState(saved.sExtend);
  const [shockOpen, setShockOpen] = useState(!!round.draft || !!round.shock_at);
  const [pending, start] = useTransition();
  const dirty = headline !== saved.headline || detail !== saved.detail || moves !== saved.moves
    || sHeadline !== saved.sHeadline || sDetail !== saved.sDetail || sMoves !== saved.sMoves || sExtend !== saved.sExtend;
  const extendSec = Math.min(600, Number(sExtend) || 0);
  // Once teams have seen a headline it can't be reworded; the private hint stays editable.
  const released = round.state !== "pending";

  const save = () => start(async () => {
    const res = await saveHeadline({
      round_id: round.id, headline, headline_detail: detail, suggested_moves: moves,
      shock_headline: sHeadline, shock_detail: sDetail, shock_moves: sMoves, shock_extend_sec: extendSec,
    });
    if (!res.ok) toast.error(res.error); else toast.success(`Round ${round.round_no} saved`);
  });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Round {round.round_no}</h3>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs font-medium text-primary">Unsaved changes</span>}
          <Badge variant={released ? "default" : "secondary"}>{released ? "Released" : "Pending"}</Badge>
        </div>
      </div>
      <Input className="mt-3 text-base font-semibold" aria-label={`Round ${round.round_no} headline`} placeholder={round.round_no === 1 ? "Optional for round 1 — e.g. Markets open flat ahead of Budget" : "Headline teams will see"} maxLength={200} value={headline} onChange={(e) => setHeadline(e.target.value)} disabled={released} />
      <Textarea className="mt-2 min-h-24 text-sm" aria-label={`Round ${round.round_no} detail`} placeholder="Detail shown under the headline (optional)." maxLength={2000} value={detail} onChange={(e) => setDetail(e.target.value)} disabled={released} />
      <Input className="mt-2 font-mono text-sm" aria-label={`Round ${round.round_no} suggested moves (private)`} placeholder="Private — suggested moves: RELIANCE +5%, WIPRO -8%" maxLength={500} value={moves} onChange={(e) => setMoves(e.target.value)} />
      <SuggestedMovesPreview text={moves} known={known} />
      <div className="mt-3 rounded-lg border border-dashed border-loss/40">
        <button type="button" onClick={() => setShockOpen(!shockOpen)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-loss"><Zap className="size-4" /> Act of God {sHeadline.trim() ? "" : <span className="font-normal text-muted-foreground">(optional)</span>}</span>
          <span className="text-xs text-muted-foreground">{round.shock_at ? "Fired" : shockOpen ? "Hide" : "Add"}</span>
        </button>
        {shockOpen && (
          <div className="space-y-2 px-3 pb-3">
            <p className="text-xs text-muted-foreground">Private until you fire it from the control room while this round&apos;s window is open.</p>
            <Input aria-label={`Round ${round.round_no} Act of God headline`} placeholder="Breaking: flash floods destroy standing crops" maxLength={200} value={sHeadline} onChange={(e) => setSHeadline(e.target.value)} disabled={!!round.shock_at} />
            <Textarea className="min-h-16 text-sm" aria-label={`Round ${round.round_no} Act of God detail`} placeholder="Detail teams will see (optional)" maxLength={2000} value={sDetail} onChange={(e) => setSDetail(e.target.value)} disabled={!!round.shock_at} />
            <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
              <Input className="font-mono text-sm" aria-label={`Round ${round.round_no} Act of God price moves`} placeholder="Price moves: ITC -6%, HUL -5%" maxLength={500} value={sMoves} onChange={(e) => setSMoves(e.target.value)} disabled={!!round.shock_at} />
              <div className="flex items-center gap-2">
                <Input className="font-mono text-sm" aria-label={`Round ${round.round_no} Act of God extra seconds`} inputMode="numeric" value={sExtend} onChange={(e) => setSExtend(e.target.value.replace(/\D/g, ""))} disabled={!!round.shock_at} />
                <span className="text-xs text-muted-foreground">extra sec</span>
              </div>
            </div>
            <SuggestedMovesPreview text={sMoves} known={known} />
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={!dirty || pending} onClick={save}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </Card>
  );
}

/** Shows what "Fill suggested" will actually do, so a typo'd ticker is caught before the event. */
function SuggestedMovesPreview({ text, known }: { text: string; known: Set<string> }) {
  const { moves, unreadable } = useMemo(() => parseSuggestedMoves(text), [text]);
  if (!moves.length && !unreadable.length) return null;
  const unknown = moves.filter((m) => !known.has(m.ticker));
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {moves.map((m) => {
          const isKnown = known.has(m.ticker);
          return (
            <span key={m.ticker} className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
              !isKnown ? "bg-muted text-muted-foreground line-through" : m.pct < 0 ? "bg-loss-soft text-loss" : "bg-gain-soft text-gain")}>
              {m.ticker} {pct(m.pct, 0)}
            </span>
          );
        })}
      </div>
      {unknown.length > 0 && (
        <p className="text-xs text-destructive">No company with ticker {unknown.map((m) => m.ticker).join(", ")} in this event — {unknown.length === 1 ? "it" : "they"} will be skipped.</p>
      )}
      {unreadable.length > 0 && (
        <p className="text-xs text-destructive">Couldn&apos;t read: {unreadable.map((u) => `“${u}”`).join(", ")}. Use the form <code className="rounded bg-muted px-1">TICKER +5%</code>, separated by commas.</p>
      )}
    </div>
  );
}
