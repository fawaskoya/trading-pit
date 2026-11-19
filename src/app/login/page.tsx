import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/paths";
import { getSessionUser } from "@/lib/supabase/server";
import { LoginCard, type LoginRole } from "./login-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

/** The one sign-in page: teams join with a code, organisers with email + password. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string; code?: string; next?: string }> }) {
  const { as, code, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const role: LoginRole = as === "organiser" && !code ? "organiser" : "team";

  const { supabase, user } = await getSessionUser();
  // An organiser who is already signed in and was sent here by a protected page goes straight on.
  if (user && !user.is_anonymous && role === "organiser") redirect(next);
  const { data: team } = user?.is_anonymous
    ? await supabase.from("teams").select("name, join_code").eq("user_id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="pit-hero min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-3xl font-extrabold">Sign in</h1>
        <p className="mt-2 text-muted-foreground">One page for everyone — pick how you&apos;re taking part.</p>

        {team && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">This phone is already playing as <strong>{team.name ?? `Team ${team.join_code}`}</strong>.</p>
            <Button size="sm" nativeButton={false} render={<Link href="/play" />}>Continue <ArrowRight /></Button>
          </div>
        )}
        {user && !user.is_anonymous && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm">Signed in as organiser <strong>{user.email}</strong>. Joining a team here will sign you out.</p>
            <Button size="sm" nativeButton={false} render={<Link href="/admin" />}>Admin <ArrowRight /></Button>
          </div>
        )}

        <LoginCard initialRole={role} code={code} next={next} />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Just here to watch? The projector board needs no login — <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">find it on the home page</Link>.
        </p>
      </main>
    </div>
  );
}
