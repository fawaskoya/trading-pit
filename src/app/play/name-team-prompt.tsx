"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Blank teams that joined by QR never saw a name field — let them pick one here. */
export function NameTeamPrompt({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const { error } = await supabaseBrowser().from("teams").update({ name: name.trim() }).eq("id", teamId);
      if (error) { toast.error(friendlyError(error)); return; }
      toast.success("Team name saved");
      router.refresh();
    });
  };

  return (
    <Card className="border-primary/40 bg-primary/5 p-4">
      <form onSubmit={save}>
        <label htmlFor="team-name" className="text-sm font-semibold">Pick a team name</label>
        <p className="text-xs text-muted-foreground">This is how you&apos;ll appear on the big screen.</p>
        <div className="mt-2 flex gap-2">
          <Input id="team-name" placeholder="Bull Run" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={pending || !name.trim()}>{pending ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Card>
  );
}
