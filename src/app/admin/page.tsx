import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const { supabase, user } = await getSessionUser();
  if (!user || user.is_anonymous) redirect("/admin/login");
  const { data: events } = await supabase.from("events").select("id, name, status, total_rounds, created_at").eq("created_by", user.id).order("created_at", { ascending: false });

  return (
    <div className="min-h-dvh">
      <SiteHeader><SignOutButton /></SiteHeader>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Your events</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button nativeButton={false} render={<Link href="/admin/new" />}>New event</Button>
        </div>
        <div className="mt-6 grid gap-3">
          {events?.length ? events.map((e) => (
            <Card key={e.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{e.name}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{e.status} · {e.total_rounds} rounds</p>
              </div>
              <Button variant="secondary" nativeButton={false} render={<Link href={`/admin/${e.id}`} />}>Open</Button>
            </Card>
          )) : (
            <Card className="p-8 text-center text-muted-foreground">No events yet. Create one to get started.</Card>
          )}
        </div>
      </main>
    </div>
  );
}
