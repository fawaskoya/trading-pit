import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { supabaseServer } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Play" };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: team } = user
    ? await supabase.from("teams").select("id, name, event_id, cash, join_code").eq("user_id", user.id).maybeSingle()
    : { data: null };

  if (team) {
    // Step 4 replaces this with the trading screen.
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-10">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Logged in as</p>
            <h1 className="text-2xl font-bold">{team.name ?? `Team ${team.join_code}`}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Trading screen coming next.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="pit-hero min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-3xl font-extrabold">Join your team</h1>
        <p className="mt-2 text-muted-foreground">Two of you share one login. Enter the code on one phone and you&apos;re set for the whole event.</p>
        <Card className="mt-6 p-6">
          <JoinForm initialCode={code} />
        </Card>
      </main>
    </div>
  );
}
