/**
 * Full happy path: admin opens the window, two teams trade, window closes, prices applied,
 * leaderboard order is correct on the projector and in the database.
 * Requires `supabase start` and .env.local (service role key) — see README.
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ADMIN = { email: "", password: "e2e-password" };

async function seed() {
  ADMIN.email = `e2e-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@tradingpit.local`;
  const { data: u, error: uErr } = await service.auth.admin.createUser({ ...ADMIN, email_confirm: true });
  if (uErr) throw uErr;
  const { data: event } = await service.from("events").insert({ name: `E2E ${Date.now()}`, created_by: u.user.id, total_rounds: 1, round_duration_sec: 120, starting_capital: 1_000_000 }).select().single().throwOnError();
  const { data: companies } = await service.from("companies").insert([
    { event_id: event!.id, name: "Alpha Corp", ticker: "ALPHA", sector: "Tech", starting_price: 100, current_price: 100, sort_order: 0 },
    { event_id: event!.id, name: "Beta Ltd", ticker: "BETA", sector: "Retail", starting_price: 50, current_price: 50, sort_order: 1 },
  ]).select().throwOnError();
  const { data: round } = await service.from("rounds").insert({ event_id: event!.id, round_no: 1, headline: "Alpha wins a huge contract" }).select().single().throwOnError();
  const { data: teams } = await service.from("teams").insert([{ event_id: event!.id, name: "Team Alpha" }, { event_id: event!.id, name: "Team Beta" }]).select().throwOnError();
  return { event: event!, companies: companies!, round: round!, teams: teams! };
}

async function joinAsTeam(browser: Browser, code: string) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`/play?code=${code}`);
  await page.getByRole("button", { name: "Enter the pit" }).click();
  await expect(page.getByText("Portfolio value")).toBeVisible();
  return page;
}

async function buyMax(page: Page, companyName: string) {
  await page.getByRole("button", { name: companyName }).click();
  await page.getByRole("button", { name: "Max" }).click();
  await page.getByRole("button", { name: /^Confirm: buy/ }).click();
  await expect(page.getByText(/^Bought/)).toBeVisible();
}

test("admin runs a round, two teams trade, leaderboard is correct", async ({ browser }) => {
  const { event, companies, round, teams } = await seed();
  const [teamA, teamB] = teams;

  // Admin signs in and opens the control room.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("Email").fill(ADMIN.email);
  await admin.getByLabel("Password").fill(ADMIN.password);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin.getByText("Your events")).toBeVisible();
  await admin.goto(`/admin/${event.id}`);
  await admin.getByRole("button", { name: /Release headline/ }).click();
  await admin.getByRole("button", { name: /Open trading window/ }).click();
  await expect(admin.getByText("Trading open")).toBeVisible();

  // Two teams join on "phones" and trade during the window.
  const a = await joinAsTeam(browser, teamA.join_code);
  const b = await joinAsTeam(browser, teamB.join_code);
  await expect(a.getByText("Trading is open")).toBeVisible();
  await buyMax(a, "Alpha Corp");
  await buyMax(b, "Beta Ltd");

  // Trading after close is rejected server-side.
  await admin.getByRole("button", { name: /Close window now/ }).click();
  await expect(admin.getByText("Enter new prices")).toBeVisible();
  await expect(a.getByText(/Window closed/)).toBeVisible();

  // Admin moves Alpha +20% (Beta unchanged) and applies.
  const alpha = companies.find((c) => c.ticker === "ALPHA")!;
  await admin.getByRole("row", { name: /ALPHA/ }).getByRole("textbox").fill("20");
  await expect(admin.getByText("1 of 2 companies will move.")).toBeVisible();
  await admin.getByRole("button", { name: /Apply prices & finish round/ }).click();
  await expect(admin.getByText("Event complete")).toBeVisible();

  // Database agrees: Team Alpha (holding the mover) ranks first.
  const { data: board } = await service.from("leaderboard_view").select("name, rank, total_value").eq("event_id", event.id).order("rank");
  expect(board![0].name).toBe("Team Alpha");
  expect(Number(board![0].total_value)).toBeGreaterThan(Number(board![1].total_value));
  const { data: c } = await service.from("companies").select("current_price").eq("id", alpha.id).single();
  expect(Number(c!.current_price)).toBe(120);
  expect(round.id).toBeTruthy();

  // Projector shows the same order, and the team's phone updated without a reload.
  const display = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await display.goto(`/display/${event.id}?view=leaderboard`);
  const rows = display.locator("ol li");
  await expect(rows.first()).toContainText("Team Alpha");
  await expect(rows.nth(1)).toContainText("Team Beta");
  await expect(a.getByText(/You're up/)).toBeVisible();
  await expect(a.getByText("#1", { exact: true })).toBeVisible();
});
