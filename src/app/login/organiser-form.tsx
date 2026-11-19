"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInOrganiser } from "@/lib/auth";
import { FormError } from "./form-error";

export function OrganiserForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await signInOrganiser(mode, email, password);
      if (!res.ok) { setError(res.error); return; }
      if ("confirmEmail" in res) { setConfirmSent(true); setMode("signin"); return; }
      router.replace(next);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {confirmSent && (
        <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>Account created. Open the confirmation link we emailed to <strong>{email}</strong>, then sign in here.</span>
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} aria-invalid={!!error} onChange={(e) => { setEmail(e.target.value); setError(null); }} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} aria-invalid={!!error} onChange={(e) => { setPassword(e.target.value); setError(null); }} />
        {mode === "signup" && <p className="text-xs text-muted-foreground">At least 6 characters.</p>}
      </div>
      <FormError message={error} />
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create organiser account"}
      </Button>
      <button type="button" className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}>
        {mode === "signin" ? "First time? Create an organiser account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
