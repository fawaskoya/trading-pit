"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/lib/database.types";
import { saveHeadline } from "../../actions";

type Round = Database["public"]["Tables"]["rounds"]["Row"] & { suggested_moves: string };

export function HeadlinesEditor({ rounds }: { rounds: Round[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Headline library</h2>
        <p className="text-sm text-muted-foreground">Write every round&apos;s headline before the event. The private <em>suggested moves</em> field (e.g. <code className="rounded bg-muted px-1">TCS -7%, INFY +3%</code>) is only ever visible to you — the control room uses it to fill prices with one click.</p>
      </div>
      {rounds.map((r) => <RoundCard key={r.id} r={r} />)}
    </div>
  );
}

function RoundCard({ r }: { r: Round }) {
  const [headline, setHeadline] = useState(r.headline ?? "");
  const [detail, setDetail] = useState(r.headline_detail ?? "");
  const [moves, setMoves] = useState(r.suggested_moves ?? "");
  const [pending, start] = useTransition();
  const dirty = headline !== (r.headline ?? "") || detail !== (r.headline_detail ?? "") || moves !== (r.suggested_moves ?? "");
  const released = r.state !== "pending";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Round {r.round_no}</h3>
        <Badge variant={released ? "default" : "secondary"}>{released ? "Released" : "Pending"}</Badge>
      </div>
      <Input className="mt-3 text-base font-semibold" placeholder={r.round_no === 1 ? "Optional for round 1 — e.g. Markets open flat ahead of Budget" : "Headline teams will see"} maxLength={200} value={headline} onChange={(e) => setHeadline(e.target.value)} disabled={released} />
      <Textarea className="mt-2 min-h-24 text-sm" placeholder="Detail shown under the headline (optional)." maxLength={2000} value={detail} onChange={(e) => setDetail(e.target.value)} disabled={released} />
      <Input className="mt-2 font-mono text-sm" placeholder="Private — suggested moves: RELIANCE +5%, WIPRO -8%" maxLength={500} value={moves} onChange={(e) => setMoves(e.target.value)} />
      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={!dirty || pending} onClick={() => start(async () => { const res = await saveHeadline({ round_id: r.id, headline, headline_detail: detail, suggested_moves: moves }); if (!res.ok) toast.error(res.error); else toast.success(`Round ${r.round_no} saved`); })}>Save</Button>
      </div>
    </Card>
  );
}
