"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EventSettingsFields, type EventFormValues } from "@/components/event-settings-fields";
import type { Database } from "@/lib/database.types";
import { deleteEvent, updateEvent } from "../../actions";

type Event = Database["public"]["Tables"]["events"]["Row"];

export function SettingsForm({ event }: { event: Event }) {
  const [values, setValues] = useState<EventFormValues>({
    name: event.name, starting_capital: Number(event.starting_capital), total_rounds: event.total_rounds, round_duration_sec: event.round_duration_sec,
    fee_pct: Number(event.fee_pct), allow_short: event.allow_short, max_position_pct: Number(event.max_position_pct),
  });
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-6">
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateEvent(event.id, values); if (!r.ok) toast.error(r.error); else toast.success("Settings saved"); }); }}>
          <EventSettingsFields value={values} onChange={setValues} roundsLocked={event.status !== "draft"} />
          {event.status !== "draft" && <p className="text-sm text-muted-foreground">Starting capital applies to teams created from now on; existing teams keep their cash.</p>}
          <Button type="submit" disabled={pending}>Save settings</Button>
        </form>
      </Card>
      <Card className="border-destructive/30 p-6">
        <h3 className="font-semibold text-destructive">Danger zone</h3>
        <p className="mt-1 text-sm text-muted-foreground">Deletes the event with all companies, teams, orders and history. This cannot be undone.</p>
        {confirm ? (
          <div className="mt-3 flex gap-2">
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => { const r = await deleteEvent(event.id); if (r && !r.ok) toast.error(r.error); })}>Yes, delete everything</Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" className="mt-3" onClick={() => setConfirm(true)}>Delete event</Button>
        )}
      </Card>
    </div>
  );
}
