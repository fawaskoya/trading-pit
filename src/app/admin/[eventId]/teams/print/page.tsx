import { headers } from "next/headers";
import { QRCodeSVG } from "qrcode.react";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Team codes" };

export default async function PrintTeams({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await supabaseServer();
  const [{ data: teams }, { data: event }] = await Promise.all([
    supabase.from("teams").select("id, name, college, join_code").eq("event_id", eventId).order("created_at"),
    supabase.from("events").select("name").eq("id", eventId).single(),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex items-end justify-between print:hidden">
        <h1 className="text-2xl font-bold">{event?.name} — team codes</h1>
        <p className="text-sm text-neutral-500">Use your browser&apos;s Print (⌘P). Cut along the cards.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(teams ?? []).map((t) => (
          <div key={t.id} className="break-inside-avoid rounded-xl border-2 border-dashed border-neutral-300 p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-neutral-500">{event?.name}</p>
            <p className="mt-1 text-lg font-bold">{t.name ?? "Your team"}</p>
            <div className="mx-auto my-3 w-fit"><QRCodeSVG value={`${origin}/play?code=${t.join_code}`} size={120} /></div>
            <p className="font-mono text-3xl font-bold tracking-[0.3em]">{t.join_code}</p>
            <p className="mt-2 text-xs text-neutral-500">Scan, or go to {origin.replace(/^https?:\/\//, "")}/play</p>
          </div>
        ))}
      </div>
    </div>
  );
}
