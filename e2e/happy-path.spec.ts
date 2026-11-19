/**
 * Full happy path: a team waits on its portfolio-only screen, admin opens the window, two teams trade,
 * the admin watches the order flow and fires an Act of God, the window closes, prices are applied, and
 * the leaderboard order is correct on the projector and in the database.
 * Requires `supabase start` and .env.local (service role key) — see README.
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ADMIN = { email: "", password: "e2e-password" };

async function seed(plannedMoves?: string) {
  ADMIN.email = `e2e-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@tradingpit.local`;
  const { data: u, error: uErr } = await service.auth.admin.createUser({ ...ADMIN, email_confirm: true });
  if (uErr) throw uErr;
  const { data: event } = await service.from("events").insert({ name: `E2E ${Date.now()}`, created_by: u.user.id, total_rounds: 1, round_duration_sec: 120, starting_capital: 1_000_000 }).select().single().throwOnError();
  const { data: companies } = await service.from("companies").insert([
    { event_id: event!.id, name: "Alpha Corp", ticker: "ALPHA", sector: "Tech", starting_price: 100, current_price: 100, sort_order: 0 },
    { event_id: event!.id, name: "Beta Ltd", ticker: "BETA", sector: "Retail", starting_price: 50, current_price: 50, sort_order: 1 },
  ]).select().throwOnError();
  const { data: round } = await service.from("rounds").insert({ event_id: event!.id, round_no: 1, headline: "Alpha wins a huge contract" }).select().single().throwOnError();
  if (plannedMoves) await service.from("round_notes").insert({ round_id: round!.id, suggested_moves: plannedMoves }).throwOnError();
  const { data: teams } = await service.from("teams").insert([{ event_id: event!.id, name: "Team Alpha" }, { event_id: event!.id, name: "Team Beta" }]).select().throwOnError();
  return { event: event!, companies: companies!, round: round!, teams: teams! };
}

/** `how: "link"` scans the QR / one-tap link; `"code"` types the code on the sign-in page. */
async function joinAsTeam(browser: Browser, code: string, how: "link" | "code") {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  if (how === "link") {
    await page.goto(`/join/${code}`);
  } else {
    await page.goto("/play"); // not on a team yet → bounced to the sign-in page
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Team code").fill(code.toLowerCase());
    await page.getByRole("button", { name: "Enter the pit" }).click();
  }
  await expect(page.getByText("Portfolio value")).toBeVisible();
  await expect(page).toHaveURL(/\/play$/);
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
  // A protected page sends a signed-out organiser to the sign-in page and back again afterwards.
  await admin.goto("/admin");
  await expect(admin).toHaveURL(/\/login\?as=organiser/);
  await admin.getByLabel("Password").fill("wrong-password");
  await admin.getByLabel("Email").fill(ADMIN.email);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin.getByRole("alert")).toBeVisible();
  await admin.getByLabel("Email").fill(ADMIN.email);
  await admin.getByLabel("Password").fill(ADMIN.password);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin.getByText("Your events")).toBeVisible();
  await admin.goto(`/admin/${event.id}`);

  // Team A joins before the round starts: a big portfolio card under the organiser's name, and nothing else —
  // no round card, no market, not even a sign-out button.
  const a = await joinAsTeam(browser, teamA.join_code, "link");
  await expect(a.getByText("Your company")).toBeVisible();
  await expect(a.getByText("Team Alpha").first()).toBeVisible();
  await expect(a.getByRole("button")).toHaveCount(0);
  await expect(a.getByText("Alpha Corp")).toHaveCount(0);

  // The headline alone doesn't reveal the scrips…
  await admin.getByRole("button", { name: /Release headline/ }).click();
  await expect(a.getByText(/companies you can trade appear when the organiser opens trading/)).toBeVisible();
  await expect(a.getByText("Alpha Corp")).toHaveCount(0);

  // …opening the window does.
  await admin.getByRole("button", { name: /Open trading window/ }).click();
  await expect(admin.getByText("Trading open")).toBeVisible();
  await expect(a.getByRole("button", { name: /Alpha Corp/ })).toBeVisible();

  // Team B joins mid-window by typing its code.
  const b = await joinAsTeam(browser, teamB.join_code, "code");

  // A code that is already in use on another phone is refused with a readable message.
  const intruder = await (await browser.newContext()).newPage();
  await intruder.goto(`/join/${teamA.join_code}`);
  await expect(intruder.getByText(/Couldn't join team/)).toBeVisible();
  await intruder.close();
  await expect(a.getByText("Trading is open")).toBeVisible();
  await buyMax(a, "Alpha Corp");
  await buyMax(b, "Beta Ltd");

  // The organiser watches the order flow as it happens.
  await expect(admin.getByText("Order flow this round")).toBeVisible();
  await expect(admin.getByText("2 orders")).toBeVisible();

  // Act of God mid-window: Beta crashes 10% at once and the window gets 30 more seconds.
  const beta = companies.find((c) => c.ticker === "BETA")!;
  const { data: before } = await service.from("rounds").select("window_closes_at").eq("id", round.id).single();
  await admin.getByRole("button", { name: /Act of God.*Show/ }).click();
  await admin.getByLabel("Act of God headline").fill("Beta's warehouse burns down");
  await admin.getByLabel("Extra seconds").fill("30");
  await admin.getByRole("row", { name: /BETA/ }).getByRole("textbox").fill("-10");
  await admin.getByRole("button", { name: /Fire Act of God/ }).click();
  await admin.getByRole("button", { name: /Click again to fire now/ }).click();
  await expect(admin.getByText("Act of God fired · +30s")).toBeVisible();
  await expect(b.getByText("Beta's warehouse burns down").first()).toBeVisible();
  await expect(b.getByText(/\+30s added to the clock/)).toBeVisible();
  const { data: shocked } = await service.from("rounds").select("window_closes_at").eq("id", round.id).single();
  expect(new Date(shocked!.window_closes_at!).getTime() - new Date(before!.window_closes_at!).getTime()).toBe(30_000);
  const { data: betaNow } = await service.from("companies").select("current_price").eq("id", beta.id).single();
  expect(Number(betaNow!.current_price)).toBe(45);

  // Trading after close is rejected server-side.
  await admin.getByRole("button", { name: /Close window now/ }).click();
  // After an Act of God the prices are already set: the organiser just finishes the round.
  await expect(admin.getByText("The Act of God already moved prices")).toBeVisible();
  await expect(a.getByText(/Window closed/)).toBeVisible();

  // Admin adds an extra +20% on Alpha (Beta stays where the Act of God left it) and finishes the round.
  const alpha = companies.find((c) => c.ticker === "ALPHA")!;
  await admin.getByRole("button", { name: /Add extra price moves/ }).click();
  await admin.getByRole("row", { name: /ALPHA/ }).getByRole("textbox").fill("20");
  await expect(admin.getByText("1 of 2 companies will move.")).toBeVisible();
  await admin.getByRole("button", { name: /Finish round 1/ }).click();
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

test("a normal round finishes by itself: the planned % moves apply when the window closes", async ({ browser }) => {
  const { event, companies } = await seed("ALPHA +20%, BETA -10%");
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await admin.goto("/login?as=organiser");
  await admin.getByLabel("Email").fill(ADMIN.email);
  await admin.getByLabel("Password").fill(ADMIN.password);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin.getByText("Your events")).toBeVisible();
  await admin.goto(`/admin/${event.id}`);
  await admin.getByRole("button", { name: /Release headline/ }).click();
  await admin.getByRole("button", { name: /Open trading window/ }).click();
  await expect(admin.getByText(/planned price moves? apply automatically/)).toBeVisible();

  // No price entry at all: closing the window finishes the round.
  await admin.getByRole("button", { name: /Close window now/ }).click();
  await expect(admin.getByText("Event complete")).toBeVisible();
  const price = async (ticker: string) => Number((await service.from("companies").select("current_price").eq("id", companies.find((c) => c.ticker === ticker)!.id).single()).data!.current_price);
  expect(await price("ALPHA")).toBe(120);
  expect(await price("BETA")).toBe(45);
});
