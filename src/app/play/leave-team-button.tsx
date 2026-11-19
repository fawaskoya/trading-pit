"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signOut } from "@/lib/auth";

/**
 * Signing out of a team is not like signing out of an account: the anonymous session is gone
 * for good, and the code stays locked to it until the organiser resets the team. So ask first.
 */
export function LeaveTeamButton({ teamName }: { teamName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const leave = () => start(async () => {
    await signOut();
    router.replace("/login");
    router.refresh();
  });

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => setOpen(true)}><LogOut className="size-4" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Sign {teamName} out of this phone?</DialogTitle>
            <DialogDescription>
              Your portfolio is safe, but to get back in you&apos;ll need the organiser to reset your team&apos;s login. Don&apos;t do this in the middle of a round.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Keep playing</Button>
            <Button variant="destructive" onClick={leave} disabled={pending}>{pending ? "Signing out…" : "Sign out"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
