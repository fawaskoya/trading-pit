"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Gamepad2, MonitorPlay, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/app/login/form-error";
import { joinDemoAsGuest, openDemoAsOrganiser } from "./actions";

/** "Try the demo" — three ways into the seeded event, no credentials. Rendered only in demo mode. */
export function DemoPanel({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"guest" | "organiser" | null>(null);
  const [, start] = useTransition();

  const run = (which: "guest" | "organiser", action: () => Promise<{ ok: false; error: string }>) => {
    setError(null);
    setBusy(which);
    start(async () => {
      const res = await action(); // On success the action redirects and never returns.
      if (res && !res.ok) { setError(res.error); setBusy(null); }
    });
  };

  return (
    <section id="demo" className="mt-10 rounded-2xl border border-primary/40 bg-primary/5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary"><Sparkles className="size-4" /> Try the demo</p>
          <h2 className="mt-1 text-2xl font-extrabold">{eventName}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">No sign-up. Open the organiser console in this window, the projector in a second one, and play as a guest team on your phone or in a private window.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Button size="lg" className="h-12" disabled={busy !== null} onClick={() => run("guest", joinDemoAsGuest)}>
          <Gamepad2 /> {busy === "guest" ? "Creating your team…" : "Play as a guest team"}
        </Button>
        <Button size="lg" variant="secondary" className="h-12" disabled={busy !== null} onClick={() => run("organiser", openDemoAsOrganiser)}>
          <ShieldCheck /> {busy === "organiser" ? "Opening…" : "Run it as organiser"}
        </Button>
        <Button size="lg" variant="outline" className="h-12" nativeButton={false} render={<Link href={`/display/${eventId}`} target="_blank" />}>
          <MonitorPlay /> Open the projector
        </Button>
      </div>
      <div className="mt-3"><FormError message={error} /></div>
    </section>
  );
}
