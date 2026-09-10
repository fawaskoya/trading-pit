"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace("/"); router.refresh(); }}>
      Sign out
    </Button>
  );
}
