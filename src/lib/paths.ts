/**
 * Only follow same-site paths after login. `next` comes from the query string, so anything
 * else (`https://evil.example`, `//evil.example`) falls back to the default.
 */
export function safeNext(next: string | undefined | null, fallback = "/admin"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** Sign-in page for an organiser, returning to `next` afterwards. */
export function organiserLoginPath(next?: string): string {
  const params = new URLSearchParams({ as: "organiser" });
  if (next && next !== "/admin") params.set("next", safeNext(next));
  return `/login?${params}`;
}

/** One-tap join link for a team (this is what the QR codes encode). */
export function teamJoinPath(joinCode: string): string {
  return `/join/${encodeURIComponent(joinCode)}`;
}
