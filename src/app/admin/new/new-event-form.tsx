"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DEFAULT_EVENT, EventSettingsFields } from "@/components/event-settings-fields";
import { createEvent } from "../actions";

export function NewEventForm() {
  const [values, setValues] = useState(DEFAULT_EVENT);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createEvent(values);
          if (res && !res.ok) toast.error(res.error);
        });
      }}
    >
      <EventSettingsFields value={values} onChange={setValues} />
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Creating…" : "Create event & add companies"}</Button>
    </form>
  );
}
