"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { signOutState } from "@/lib/auth";
import { organiserLoginPath } from "@/lib/paths";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Watches for a sign-out nobody asked for (a failed token refresh, a cookie cleared by the browser).
 * Before giving up it checks once more whether a valid session is still there; an organiser who really is
 * signed out is sent straight back to the sign-in page and returns to where they were afterwards.
 */
export function AuthWatch({ role }: { role: "organiser" | "team" }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = supabaseBrowser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT" || signOutState.intentional) return;
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return; // another tab or a refresh already restored it
        if (role === "organiser") {
          toast.message("Your session ended — signing you back in…");
          router.replace(organiserLoginPath(window.location.pathname));
        } else {
          toast.error("Connection lost. Reloading…");
          router.refresh();
        }
      }, 800);
    });
    return () => subscription.unsubscribe();
  }, [role, router]);
  return null;
}
