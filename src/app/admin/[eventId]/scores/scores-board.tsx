"use client";
import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { compactRupees } from "@/lib/format";
import { ADJUST_LIMIT, SECTION_MAX, SECTIONS, type Section, type TeamScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { saveAdjustment } from "../../actions";

const fmt = (n: number) => n.toFixed(1).replace(/\.0$/, "");

export function ScoresBoard({ eventId, finished, played, totalRounds, scores, orderCount, activityCount }: {
  eventId: string; finished: boolean; played: number; totalRounds: number; scores: TeamScore[]; orderCount: number; activityCount: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Scores out of 20</h2>
            <Badge variant={finished ? "default" : "secondary"}>{finished ? "Final" : `Provisional · ${played} of ${totalRounds} rounds`}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            The winner is the highest score, not the most money. Four sections of {SECTION_MAX}, scored from every trade and click
            ({orderCount} orders, {activityCount} recorded actions) and compared across teams. Judges can adjust any section by up to ±{ADJUST_LIMIT}.
            Only you can see this page — teams and the projector never see scores or values.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/${eventId}/scores/print`} target="_blank" />}><Printer /> Scoring sheets (PDF)</Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/${eventId}/scores/print?blank=1`} target="_blank" />}><Printer /> Blank sheets</Button>
          {(["scores", "orders", "activity"] as const).map((k) => (
            <Button key={k} variant="ghost" size="sm" nativeButton={false} render={<a href={`/admin/${eventId}/scores/export?kind=${k}`} />}><Download /> {k}.csv</Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((s) => (
          <Card key={s.key} className="p-3">
            <p className="text-sm font-semibold"><span className="mr-1.5 font-mono text-primary">{s.key}</span>{s.title} <span className="text-muted-foreground">/ {SECTION_MAX}</span></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.blurb}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">#</th><th className="px-2 py-2">Team</th>
                {SECTIONS.map((s) => <th key={s.key} className="px-2 py-2 text-center">{s.key}</th>)}
                <th className="px-2 py-2 text-center">Total / 20</th><th className="px-2 py-2 text-right">Final value</th><th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {scores.map((t) => (
                <Fragment key={t.team_id}>
                  <tr className={cn("border-t", t.rank === 1 && "bg-primary/5")}>
                    <td className="px-4 py-2.5 font-mono font-bold">{t.rank}</td>
                    <td className="px-2 py-2.5"><p className="font-semibold">{t.name}</p>{t.college && <p className="text-xs text-muted-foreground">{t.college}</p>}</td>
                    {SECTIONS.map((s) => {
                      const x = t.sections[s.key];
                      return (
                        <td key={s.key} className="px-2 py-2.5 text-center font-mono">
                          {fmt(x.final)}{x.adjust !== 0 && <span className={cn("ml-1 text-[10px]", x.adjust > 0 ? "text-gain" : "text-loss")}>{x.adjust > 0 ? "+" : ""}{fmt(x.adjust)}</span>}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5 text-center font-mono text-base font-bold">{fmt(t.total)}</td>
                    <td className="px-2 py-2.5 text-right font-mono text-muted-foreground">{compactRupees(t.finalValue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setOpen(open === t.team_id ? null : t.team_id)} aria-expanded={open === t.team_id}>
                        Details <ChevronDown className={cn("transition", open === t.team_id && "rotate-180")} />
                      </Button>
                    </td>
                  </tr>
                  {open === t.team_id && (
                    <tr className="border-t bg-muted/20">
                      <td colSpan={9} className="px-4 py-4"><TeamDetail eventId={eventId} team={t} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!scores.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No teams yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TeamDetail({ eventId, team }: { eventId: string; team: TeamScore }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {team.stats.trades} trades · {team.stats.highImpactRounds} high-impact rounds · {team.stats.cashRounds} rounds sitting on cash · worst drawdown {team.stats.maxDrawdownPct.toFixed(1)}% · return {(team.returnPct * 100).toFixed(1)}%
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {SECTIONS.map((s) => <SectionCard key={s.key} eventId={eventId} teamId={team.team_id} section={s.key} title={s.title} score={team.sections[s.key]} />)}
      </div>
    </div>
  );
}

function SectionCard({ eventId, teamId, section, title, score }: { eventId: string; teamId: string; section: Section; title: string; score: TeamScore["sections"][Section] }) {
  const [delta, setDelta] = useState(score.adjust);
  const [note, setNote] = useState(score.note ?? "");
  const [pending, start] = useTransition();
  const dirty = delta !== score.adjust || note !== (score.note ?? "");
  const save = () => start(async () => {
    const r = await saveAdjustment({ event_id: eventId, team_id: teamId, section, delta, note: note.trim() || null });
    if (!r.ok) toast.error(r.error); else toast.success(`Section ${section} saved`);
  });
  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold"><span className="mr-1.5 font-mono text-primary">{section}</span>{title}</p>
        <p className="font-mono text-sm">auto {fmt(score.auto)} → <span className="font-bold">{fmt(Math.min(SECTION_MAX, Math.max(0, score.auto + delta)))}</span> / {SECTION_MAX}</p>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        {score.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t pt-2">
        <span className="text-xs font-medium">Judge</span>
        <div className="flex items-center rounded-md border">
          <button type="button" className="px-2 py-1 text-sm disabled:opacity-40" disabled={delta <= -ADJUST_LIMIT} onClick={() => setDelta(Math.max(-ADJUST_LIMIT, delta - 0.5))} aria-label="Lower by half a point">−</button>
          <span className="w-10 text-center font-mono text-sm">{delta > 0 ? "+" : ""}{fmt(delta)}</span>
          <button type="button" className="px-2 py-1 text-sm disabled:opacity-40" disabled={delta >= ADJUST_LIMIT} onClick={() => setDelta(Math.min(ADJUST_LIMIT, delta + 0.5))} aria-label="Raise by half a point">+</button>
        </div>
        <Input className="h-8 min-w-0 flex-1 text-xs" placeholder="Why? (shown on the printed sheet)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-label={`Section ${section} note`} />
        <Button size="sm" disabled={!dirty || pending} onClick={save}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </Card>
  );
}
