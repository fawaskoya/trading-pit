import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";
import { PlayScreen } from "./play-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Play" };

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const { supabase, user } = await getSessionUser();
  const { data: team } = user ? await supabase.from("teams").select("*").eq("user_id", user.id).maybeSingle() : { data: null };

  if (!team) {
    return (
      <div className="pit-hero min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-10">
          <h1 className="text-3xl font-extrabold">Join your team</h1>
          <p className="mt-2 text-muted-foreground">Two of you share one login. Enter the code on one phone and you&apos;re set for the whole event.</p>
          <Card className="mt-6 p-6"><JoinForm initialCode={code} /></Card>
        </main>
      </div>
    );
  }

  const [{ data: event }, { data: companies }, { data: rounds }, { data: holdings }, { data: me }, { data: orders }, { data: leaders }, { data: priceUpdates }, { data: snapshots }] = await Promise.all([
    supabase.from("events").select("*").eq("id", team.event_id).single(),
    supabase.from("companies").select("*").eq("event_id", team.event_id).order("sort_order"),
    supabase.from("rounds").select("*").eq("event_id", team.event_id).order("round_no"),
    supabase.from("holdings").select("company_id, shares").eq("team_id", team.id),
    supabase.from("leaderboard_view").select("rank, total_value, change_this_round, pnl").eq("team_id", team.id).maybeSingle(),
    supabase.from("orders").select("id, round_id, company_id, side, shares, price, value, fee, created_at").eq("team_id", team.id).order("created_at", { ascending: false }),
    supabase.from("leaderboard_view").select("team_id, name, rank, total_value, trade_count").eq("event_id", team.event_id).order("rank").limit(50),
    supabase.from("price_updates").select("round_id, company_id, old_price, new_price, rounds!inner(event_id)").eq("rounds.event_id", team.event_id),
    supabase.from("portfolio_snapshots").select("round_id, total_value, cash, holdings_value").eq("team_id", team.id),
  ]);
  if (!event) return null;

  return (
    <PlayScreen
      team={team}
      event={event}
      companies={companies ?? []}
      rounds={rounds ?? []}
      holdings={holdings ?? []}
      me={me ?? null}
      orders={orders ?? []}
      leaders={leaders ?? []}
      priceUpdates={(priceUpdates ?? []).map(({ round_id, company_id, old_price, new_price }) => ({ round_id, company_id, old_price, new_price }))}
      snapshots={snapshots ?? []}
    />
  );
}
