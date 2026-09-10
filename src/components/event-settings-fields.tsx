"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { rupees } from "@/lib/format";

export type EventFormValues = {
  name: string; starting_capital: number; total_rounds: number; round_duration_sec: number;
  fee_pct: number; allow_short: boolean; max_position_pct: number;
};
export const DEFAULT_EVENT: EventFormValues = {
  name: "", starting_capital: 100000000, total_rounds: 6, round_duration_sec: 180, fee_pct: 0, allow_short: false, max_position_pct: 100,
};

export function EventSettingsFields({ value, onChange, roundsLocked = false }: { value: EventFormValues; onChange: (v: EventFormValues) => void; roundsLocked?: boolean }) {
  const [advanced, setAdvanced] = useState(value.fee_pct > 0 || value.allow_short || value.max_position_pct < 100);
  const set = <K extends keyof EventFormValues>(k: K, v: EventFormValues[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-5">
      <Field label="Event name" htmlFor="name">
        <Input id="name" required maxLength={120} placeholder="Elixir 2026 — Trading Pit" value={value.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Starting capital (₹)" htmlFor="cap" hint={rupees(value.starting_capital)}>
          <Input id="cap" type="number" min={1} step={1} value={value.starting_capital} onChange={(e) => set("starting_capital", Number(e.target.value))} />
        </Field>
        <Field label="Rounds" htmlFor="rounds" hint={roundsLocked ? "Only pending rounds can be added or removed" : undefined}>
          <Input id="rounds" type="number" min={1} max={30} value={value.total_rounds} onChange={(e) => set("total_rounds", Number(e.target.value))} />
        </Field>
        <Field label="Window length (seconds)" htmlFor="dur" hint={`${Math.floor(value.round_duration_sec / 60)}m ${value.round_duration_sec % 60}s`}>
          <Input id="dur" type="number" min={10} max={3600} value={value.round_duration_sec} onChange={(e) => set("round_duration_sec", Number(e.target.value))} />
        </Field>
      </div>
      <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => setAdvanced(!advanced)}>
        {advanced ? "Hide advanced rules" : "Advanced rules (fees, short-selling, position cap)"}
      </button>
      {advanced && (
        <div className="grid gap-5 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
          <Field label="Transaction fee (%)" htmlFor="fee" hint="Charged on every buy and sell">
            <Input id="fee" type="number" min={0} max={99} step={0.05} value={value.fee_pct} onChange={(e) => set("fee_pct", Number(e.target.value))} />
          </Field>
          <Field label="Max % in one company" htmlFor="maxpos" hint="100 = no cap">
            <Input id="maxpos" type="number" min={1} max={100} value={value.max_position_pct} onChange={(e) => set("max_position_pct", Number(e.target.value))} />
          </Field>
          <div className="space-y-2">
            <Label htmlFor="short">Allow short-selling</Label>
            <div className="flex h-10 items-center gap-3">
              <Switch id="short" checked={value.allow_short} onCheckedChange={(c) => set("allow_short", c)} />
              <span className="text-sm text-muted-foreground">{value.allow_short ? "Teams may sell shares they don't own" : "Off (recommended for beginners)"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
