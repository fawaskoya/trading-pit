"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinTeam } from "@/lib/auth";
import { FormError } from "./form-error";

/** Compact "type your team code" box for the home page — the no-QR way in, on a phone or a laptop. */
export function QuickJoin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await joinTeam(code);
      if (!res.ok) { setError(res.error); return; }
      toast.success("You're in! Good luck.");
      router.push("/play");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-2">
      <div className="flex gap-2">
        <Input
          aria-label="Team code"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="TEAM CODE"
          className="h-11 min-w-0 flex-1 text-center font-mono text-lg tracking-[0.25em] uppercase placeholder:text-sm placeholder:tracking-widest"
          value={code}
          maxLength={6}
          aria-invalid={!!error}
          onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setError(null); }}
        />
        <Button type="submit" size="lg" className="h-11" disabled={pending || code.length !== 6}>
          {pending ? "Joining…" : <>Join <ArrowRight className="size-4" /></>}
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}
