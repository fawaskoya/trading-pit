import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/** Server Components / Server Actions / Route Handlers client bound to the request cookies. */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component: middleware refreshes the session instead.
          }
        },
      },
    },
  );
}

/**
 * Who is signed in, read from the session cookie without a round trip to the auth server.
 * Safe for deciding what to render: every query still carries the JWT and is enforced by RLS,
 * so a forged cookie can only ever see what an anonymous user sees. Server Actions that mutate
 * still call `auth.getUser()` for a server-verified identity.
 */
export async function getSessionUser() {
  const supabase = await supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  return { supabase, user: session?.user ?? null };
}
