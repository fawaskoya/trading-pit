import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { supabaseServer } from "@/lib/supabase/server";
import { SignOutButton } from "../sign-out-button";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/admin/login");
  const { data: event } = await supabase.from("events").select("id, name, status").eq("id", eventId).eq("created_by", user.id).maybeSingle();
  if (!event) notFound();

  return (
    <div className="min-h-dvh">
      <SiteHeader>
        <Link href={`/display/${event.id}`} target="_blank" className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
          Projector <ExternalLink className="size-3.5" />
        </Link>
        <SignOutButton />
      </SiteHeader>
      <div className="border-b bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{event.name}</h1>
            <Badge variant={event.status === "live" ? "default" : "secondary"} className="uppercase tracking-wide">{event.status}</Badge>
          </div>
          <AdminNav eventId={event.id} />
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
