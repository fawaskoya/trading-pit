"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) { toast.error(friendlyError(error)); return; }
      }
      const { error } = await supabase.rpc("claim_team", { p_join_code: code, p_team_name: name || undefined });
      if (error) { toast.error(friendlyError(error)); return; }
      toast.success("You're in! Good luck.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="code">Team code</Label>
        <Input
          id="code"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. 7KQ2XM"
          className="h-14 text-center font-mono text-2xl tracking-[0.35em] uppercase"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          required
        />
        <p className="text-xs text-muted-foreground">Your organiser gave you a 6-character code.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Team name <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="name" placeholder="Bull Run" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending || code.length !== 6}>
        {pending ? "Joining…" : "Enter the pit"}
      </Button>
    </form>
  );
}
