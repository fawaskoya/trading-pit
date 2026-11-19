import Link from "next/link";
import { ArrowRight, Gamepad2, MonitorPlay, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { findDemoEvent } from "@/lib/demo";
import { supabaseServer } from "@/lib/supabase/server";
import { DemoPanel } from "./demo/demo-panel";
import { QuickJoin } from "./login/quick-join";

export const dynamic = "force-dynamic";

const TAPE = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "AIRTEL", "ITC", "LT", "MARUTI", "TATAMOTORS", "SUNPHARMA", "WIPRO", "ADANIPORTS"];

export default async function Home() {
  const supabase = await supabaseServer();
  const [{ data: live }, demo] = await Promise.all([
    supabase.from("events").select("id, name, status").eq("status", "live").order("created_at", { ascending: false }).limit(3),
    findDemoEvent(),
  ]);

  return (
    <div className="pit-hero min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Live market simulation</p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
          Read the headline. <br className="hidden sm:block" />Make the call. <span className="text-primary">Beat the hall.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Every round, a news headline drops and the trading window opens. Buy, sell or hold — then watch the prices move on the big screen.
        </p>

        <div className="ticker-tape mt-10 overflow-hidden rounded-xl border bg-card/60 py-2 font-mono text-sm">
          <div className="animate-tape flex w-max gap-8 whitespace-nowrap px-4">
            {[...TAPE, ...TAPE].map((t, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="font-semibold">{t}</span>
                <span className={i % 3 === 0 ? "text-loss" : "text-gain"}>{i % 3 === 0 ? "▼" : "▲"} {(0.4 + (i % 7) * 0.9).toFixed(1)}%</span>
              </span>
            ))}
          </div>
        </div>

        {demo && <DemoPanel eventId={demo.id} eventName={demo.name} />}

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card className="group relative overflow-hidden p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
            <Gamepad2 className="mb-4 size-8 text-primary" />
            <h2 className="text-xl font-bold">I&apos;m playing</h2>
            <p className="mt-1 text-sm text-muted-foreground">Type your team&apos;s 6-character code here, or scan its QR code. Works on a phone or a laptop.</p>
            <QuickJoin />
            <Link href="/login" className="mt-3 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">More sign-in options</Link>
          </Card>
          <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
            <MonitorPlay className="mb-4 size-8 text-primary" />
            <h2 className="text-xl font-bold">Projector</h2>
            <p className="mt-1 text-sm text-muted-foreground">Leaderboard, headline and countdown for the whole hall. No login.</p>
            {live && live.length > 0 ? (
              <div className="mt-5 space-y-2">
                {live.map((e) => (
                  <Button key={e.id} variant="secondary" className="w-full justify-between" nativeButton={false} render={<Link href={`/display/${e.id}`} />}>
                    {e.name} <ArrowRight className="size-4" />
                  </Button>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">No event is live right now. The organiser shares this link.</p>
            )}
          </Card>
          <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
            <ShieldCheck className="mb-4 size-8 text-primary" />
            <h2 className="text-xl font-bold">Organiser</h2>
            <p className="mt-1 text-sm text-muted-foreground">Set up companies, write headlines, run the rounds.</p>
            <Button variant="outline" className="mt-5 w-full" size="lg" nativeButton={false} render={<Link href="/login?as=organiser" />}>Organiser sign in</Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
