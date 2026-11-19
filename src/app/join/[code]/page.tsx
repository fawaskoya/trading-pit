import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/supabase/server";
import { AutoJoin } from "./auto-join";

export const dynamic = "force-dynamic";
export const metadata = { title: "Joining…", robots: { index: false } };

/** One-tap join: the QR code on a team's card points here. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) redirect("/login");

  // Already on this team (re-scanned the card)? Go straight to the game.
  const { supabase, user } = await getSessionUser();
  if (user?.is_anonymous) {
    const { data: team } = await supabase.from("teams").select("join_code").eq("user_id", user.id).maybeSingle();
    if (team?.join_code === code) redirect("/play");
  }

  return (
    <div className="pit-hero min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <AutoJoin code={code} />
      </main>
    </div>
  );
}
