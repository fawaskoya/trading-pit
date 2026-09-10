"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const supabase = supabaseBrowser();
      // If this browser is currently an anonymous team session, drop it first.
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.is_anonymous) await supabase.auth.signOut();

      const { error } = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (error) { toast.error(friendlyError(error)); return; }
      router.replace(next);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create organiser account"}
      </Button>
      <button type="button" className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "First time? Create an organiser account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
