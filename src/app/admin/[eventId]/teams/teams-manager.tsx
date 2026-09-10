"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Printer, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEventRealtime } from "@/hooks/use-event-realtime";
import { createTeams, deleteTeam, resetTeamLogin, updateTeam } from "../../actions";

type Team = { id: string; name: string | null; college: string | null; join_code: string; joined_at: string | null; cash: number };

export function TeamsManager({ eventId, teams, origin }: { eventId: string; teams: Team[]; origin: string }) {
  useEventRealtime(eventId, ["teams"]);
  const [names, setNames] = useState("");
  const [count, setCount] = useState(5);
  const [pending, start] = useTransition();
  const joined = teams.filter((t) => t.joined_at).length;

  const add = (mode: "names" | "count") => start(async () => {
    const res = await createTeams({ event_id: eventId, names: mode === "names" ? names.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [], count: mode === "count" ? count : 0 });
    if (!res.ok) toast.error(res.error); else { toast.success(`${res.data?.created} teams created`); setNames(""); }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{teams.length} teams <span className="text-base font-normal text-muted-foreground">· {joined} joined</span></h2>
          <Button variant="outline" size="sm" onClick={() => window.open(`/admin/${eventId}/teams/print`, "_blank")}><Printer /> Print codes & QR</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => <TeamCard key={t.id} t={t} joinUrl={`${origin}/play?code=${t.join_code}`} />)}
          {!teams.length && <Card className="p-8 text-center text-muted-foreground sm:col-span-2">No teams yet — create some on the right.</Card>}
        </div>
      </div>
      <Card className="h-fit space-y-5 p-5">
        <div>
          <h3 className="font-semibold">Add teams by name</h3>
          <Textarea className="mt-2 min-h-28 text-sm" placeholder={"Bull Run\nNifty Ninjas\nSensex Sharks"} value={names} onChange={(e) => setNames(e.target.value)} />
          <Button className="mt-2 w-full" disabled={pending || !names.trim()} onClick={() => add("names")}>Create named teams</Button>
        </div>
        <div className="border-t pt-5">
          <h3 className="font-semibold">Or generate blank teams</h3>
          <p className="text-xs text-muted-foreground">Teams pick their own name when they join.</p>
          <div className="mt-2 flex gap-2">
            <Input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-24" />
            <Button className="flex-1" variant="secondary" disabled={pending} onClick={() => add("count")}>Generate {count}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TeamCard({ t, joinUrl }: { t: Team; joinUrl: string }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(t.name ?? "");
  const [college, setCollege] = useState(t.college ?? "");
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => start(async () => { const r = await fn(); if (!r.ok) toast.error(r.error); else if (msg) toast.success(msg); });
  return (
    <Card className={`flex gap-4 p-4 ${pending ? "opacity-60" : ""}`}>
      <div className="shrink-0 rounded-md bg-white p-1"><QRCodeSVG value={joinUrl} size={72} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xl font-bold tracking-widest">{t.join_code}</span>
          <Badge variant={t.joined_at ? "default" : "secondary"}>{t.joined_at ? "Joined" : "Not yet"}</Badge>
        </div>
        <Input className="mt-1 h-8 border-transparent px-1 font-semibold shadow-none hover:border-border" placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== (t.name ?? "") && act(() => updateTeam(t.id, { name }))} />
        <Input className="h-8 border-transparent px-1 text-sm text-muted-foreground shadow-none hover:border-border" placeholder="College" value={college} onChange={(e) => setCollege(e.target.value)} onBlur={() => college !== (t.college ?? "") && act(() => updateTeam(t.id, { college }))} />
        <div className="mt-1 flex gap-1">
          <Button variant="ghost" size="xs" disabled={!t.joined_at} onClick={() => act(() => resetTeamLogin(t.id), "Login reset — they can join again from a new phone")}><RefreshCw /> Reset login</Button>
          <Button variant="ghost" size="xs" className="text-destructive" onClick={() => act(() => deleteTeam(t.id))}><Trash2 /> Remove</Button>
        </div>
      </div>
    </Card>
  );
}
