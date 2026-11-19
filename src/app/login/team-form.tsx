"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinTeam } from "@/lib/auth";
import { FormError } from "./form-error";

export function TeamForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await joinTeam(code, name);
      if (!res.ok) { setError(res.error); return; }
      toast.success("You're in! Good luck.");
      router.replace("/play");
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
          autoFocus={!initialCode}
          spellCheck={false}
          placeholder="e.g. 7KQ2XM"
          className="h-14 text-center font-mono text-2xl tracking-[0.35em] uppercase"
          value={code}
          maxLength={6}
          aria-invalid={!!error}
          onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setError(null); }}
          required
        />
        <p className="text-xs text-muted-foreground">Your organiser gave you a 6-character code. Two of you share one phone.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Team name <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="name" placeholder="Bull Run" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <FormError message={error} />
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending || code.length !== 6}>
        {pending ? "Joining…" : "Enter the pit"}
      </Button>
    </form>
  );
}
