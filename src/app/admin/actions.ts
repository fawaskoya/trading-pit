"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { friendlyError } from "@/lib/errors";
import { companySchema, eventSchema, headlineSchema, parseCompanyPaste, pricesSchema, teamsCreateSchema } from "@/lib/schemas";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) throw new Error("FORBIDDEN");
  return { supabase, user };
}

const fail = (e: unknown): ActionResult<never> => ({ ok: false, error: friendlyError(e) });

// ------------------------------------------------------------------ events
export async function createEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  let id: string;
  try {
    const { supabase, user } = await requireAdmin();
    const data = eventSchema.parse(input);
    const { data: event, error } = await supabase.from("events").insert({ ...data, created_by: user.id }).select("id").single();
    if (error) throw error;
    const { error: rErr } = await supabase.from("rounds").insert(
      Array.from({ length: data.total_rounds }, (_, i) => ({ event_id: event.id, round_no: i + 1 })),
    );
    if (rErr) throw rErr;
    id = event.id;
  } catch (e) { return fail(e); }
  redirect(`/admin/${id}/companies`);
}

export async function updateEvent(eventId: string, input: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const data = eventSchema.partial().parse(input);
    const { error } = await supabase.from("events").update(data).eq("id", eventId);
    if (error) throw error;
    // Keep the rounds table in step with total_rounds (only add/remove pending rounds).
    if (data.total_rounds) {
      const { data: rounds } = await supabase.from("rounds").select("id, round_no, state").eq("event_id", eventId).order("round_no");
      const existing = rounds ?? [];
      const extra = existing.filter((r) => r.round_no > data.total_rounds! && r.state === "pending").map((r) => r.id);
      if (extra.length) await supabase.from("rounds").delete().in("id", extra);
      const maxNo = existing.length ? Math.max(...existing.map((r) => r.round_no)) : 0;
      if (maxNo < data.total_rounds) {
        await supabase.from("rounds").insert(Array.from({ length: data.total_rounds - maxNo }, (_, i) => ({ event_id: eventId, round_no: maxNo + i + 1 })));
      }
    }
    revalidatePath(`/admin/${eventId}`, "layout");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) throw error;
  } catch (e) { return fail(e); }
  redirect("/admin");
}

// --------------------------------------------------------------- companies
export async function bulkAddCompanies(eventId: string, text: string): Promise<ActionResult<{ added: number; errors: string[] }>> {
  try {
    const { supabase } = await requireAdmin();
    const { rows, errors } = parseCompanyPaste(text);
    if (!rows.length) return { ok: true, data: { added: 0, errors } };
    const { count } = await supabase.from("companies").select("id", { count: "exact", head: true }).eq("event_id", eventId);
    const base = count ?? 0;
    const { error } = await supabase.from("companies").upsert(
      rows.map((r, i) => ({ event_id: eventId, name: r.name, ticker: r.ticker, sector: r.sector ?? null, starting_price: r.price, current_price: r.price, sort_order: base + i })),
      { onConflict: "event_id,ticker" },
    );
    if (error) throw error;
    revalidatePath(`/admin/${eventId}/companies`);
    return { ok: true, data: { added: rows.length, errors } };
  } catch (e) { return fail(e); }
}

export async function updateCompany(companyId: string, input: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { price, logo_url, ...rest } = companySchema.partial().parse(input);
    const patch: Database["public"]["Tables"]["companies"]["Update"] = { ...rest, logo_url: logo_url === "" ? null : logo_url };
    if (price !== undefined) { patch.starting_price = price; patch.current_price = price; }
    const { data, error } = await supabase.from("companies").update(patch).eq("id", companyId).select("event_id").single();
    if (error) throw error;
    revalidatePath(`/admin/${data.event_id}/companies`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteCompany(companyId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.from("companies").delete().eq("id", companyId).select("event_id").single();
    if (error) throw error;
    revalidatePath(`/admin/${data.event_id}/companies`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// --------------------------------------------------------------- headlines
export async function saveHeadline(input: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const d = headlineSchema.parse(input);
    const { data, error } = await supabase.from("rounds").update({ headline: d.headline || null, headline_detail: d.headline_detail || null }).eq("id", d.round_id).select("event_id").single();
    if (error) throw error;
    const { error: nErr } = await supabase.from("round_notes").upsert({ round_id: d.round_id, suggested_moves: d.suggested_moves || null, updated_at: new Date().toISOString() });
    if (nErr) throw nErr;
    revalidatePath(`/admin/${data.event_id}`, "layout");
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ------------------------------------------------------------------- teams
export async function createTeams(input: unknown): Promise<ActionResult<{ created: number }>> {
  try {
    const { supabase } = await requireAdmin();
    const d = teamsCreateSchema.parse(input);
    const rows = [
      ...d.names.filter(Boolean).map((name) => ({ event_id: d.event_id, name })),
      ...Array.from({ length: d.count }, () => ({ event_id: d.event_id, name: null as string | null })),
    ];
    if (!rows.length) return { ok: true, data: { created: 0 } };
    const { error } = await supabase.from("teams").insert(rows);
    if (error) throw error;
    revalidatePath(`/admin/${d.event_id}/teams`);
    return { ok: true, data: { created: rows.length } };
  } catch (e) { return fail(e); }
}

export async function updateTeam(teamId: string, input: { name?: string | null; college?: string | null }): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const d = z.object({ name: z.string().trim().max(40).nullable().optional(), college: z.string().trim().max(80).nullable().optional() }).parse(input);
    const { data, error } = await supabase.from("teams").update({ ...d, name: d.name === "" ? null : d.name }).eq("id", teamId).select("event_id").single();
    if (error) throw error;
    revalidatePath(`/admin/${data.event_id}/teams`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteTeam(teamId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.from("teams").delete().eq("id", teamId).select("event_id").single();
    if (error) throw error;
    revalidatePath(`/admin/${data.event_id}/teams`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function resetTeamLogin(teamId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.rpc("reset_team_login", { p_team_id: teamId });
    if (error) throw error;
    revalidatePath(`/admin/${data.event_id}/teams`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ----------------------------------------------------------- round control
type RoundFn = "release_headline" | "open_window" | "close_window" | "undo_last_price_application";
async function roundRpc(fn: RoundFn, roundId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.rpc(fn, { p_round_id: roundId });
    if (error) throw error;
    revalidatePath(`/admin/${data.event_id}`, "layout");
    return { ok: true };
  } catch (e) { return fail(e); }
}
export async function releaseHeadline(roundId: string) { return roundRpc("release_headline", roundId); }
export async function openWindow(roundId: string) { return roundRpc("open_window", roundId); }
export async function closeWindow(roundId: string) { return roundRpc("close_window", roundId); }
export async function undoPrices(roundId: string) { return roundRpc("undo_last_price_application", roundId); }

export async function applyPrices(roundId: string, input: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const prices = pricesSchema.parse(input);
    const { data, error } = await supabase.rpc("apply_round_prices", { p_round_id: roundId, p_prices: prices });
    if (error) throw error;
    revalidatePath(`/admin/${data.event_id}`, "layout");
    return { ok: true };
  } catch (e) { return fail(e); }
}
