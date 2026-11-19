"use client";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

export type AuthResult = { ok: true } | { ok: false; error: string; code?: string };

const fail = (e: unknown): AuthResult => ({
  ok: false,
  error: friendlyError(e),
  code: ((e as { message?: string } | null)?.message ?? "").trim() || undefined,
});

/**
 * Join a team with its code. Teams always use an anonymous session: an organiser testing on the
 * same browser would otherwise bind the team to their admin account and lock the code.
 */
export async function joinTeam(joinCode: string): Promise<AuthResult> {
  try {
    const supabase = supabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();
    if (session && !session.user.is_anonymous) await supabase.auth.signOut();
    if (!session || !session.user.is_anonymous) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) return fail(error);
    }
    const { error } = await supabase.rpc("claim_team", { p_join_code: joinCode });
    return error ? fail(error) : { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type OrganiserResult = AuthResult | { ok: true; confirmEmail: true };

/** Organiser email + password. Replaces an anonymous team session on this browser if there is one. */
export async function signInOrganiser(mode: "signin" | "signup", email: string, password: string): Promise<OrganiserResult> {
  try {
    const supabase = supabaseBrowser();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.is_anonymous) await supabase.auth.signOut();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? fail(error) : { ok: true };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return fail(error);
    // With "Confirm email" on, sign-up succeeds but there is no session until the link is clicked.
    return data.session ? { ok: true } : { ok: true, confirmEmail: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signOut(): Promise<void> {
  await supabaseBrowser().auth.signOut();
}
