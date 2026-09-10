export const dynamic = "force-dynamic";
/** Server time in ms — clients compute an offset so countdowns don't trust the phone clock. */
export function GET() {
  return Response.json({ now: Date.now() }, { headers: { "cache-control": "no-store" } });
}
