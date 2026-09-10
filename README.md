# Trading Pit

A live stock-market simulation for college fests. Teams log in on their phones, react to news headlines an organiser releases each round, and buy/sell virtual shares inside a timed window. A projector shows the live leaderboard.

**Stack:** Next.js 15 (App Router, TypeScript, Tailwind v4, shadcn/ui) · Supabase (Postgres, Auth, Realtime, RLS) · Vercel.

| Screen | URL | Who |
|---|---|---|
| Team | `/play` | Two students sharing one phone login (join code) |
| Organiser | `/admin` | Email + password |
| Projector | `/display/<eventId>` | Public, no login, dark full-screen |

Organisers: jump to [docs/ORGANISER_GUIDE.md](docs/ORGANISER_GUIDE.md) for the one-page run-of-show.

---

## Local setup

Prerequisites: Node 20+, [pnpm](https://pnpm.io), Docker Desktop, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
pnpm install
supabase start                 # Postgres + Auth + Realtime in Docker (first run downloads images)
cp .env.example .env.local     # then paste the keys printed by `supabase status`
pnpm seed                      # demo event: 20 Indian large caps, 6 headlines, 6 teams, admin login
pnpm dev                       # http://localhost:3000
```

`pnpm seed` prints the admin login (`admin@tradingpit.local` / `tradingpit`), six team join codes and the projector URL.

Useful scripts:

| Script | What it does |
|---|---|
| `pnpm db:reset` | Recreate the local database from `supabase/migrations`, then seed |
| `pnpm db:test` | pgTAP unit tests for the trading engine (38 tests) |
| `pnpm db:types` | Regenerate `src/lib/database.types.ts` after changing the schema |
| `pnpm test:e2e` | Playwright happy path (builds and starts a production server; needs `supabase start`) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Quality gates |

---

## How it works

**All game rules live in Postgres** (`supabase/migrations/20260910000002_functions.sql`). The browser never writes cash, holdings or orders directly:

- `execute_order(company, side, shares)` — locks the team row, re-checks that the window is open **and** `now() < window_closes_at`, re-checks cash/holdings, applies the fee, updates cash + holdings, inserts the order. 30 teams hammering the last 10 seconds serialise per team and never block each other.
- `release_headline` → `open_window` → `close_window` → `apply_round_prices` → (`undo_last_price_application`) — the round state machine, admin-only, each step validating the previous state. A partial unique index guarantees only one active round per event.
- `apply_round_prices(round, [{company_id, new_price}])` — updates only the listed companies, records `price_updates`, snapshots every team's portfolio, advances the round, and marks the event finished after the last round.
- `close_expired_windows()` — idempotent fallback run by `pg_cron` every minute and by any client whose countdown hits zero. Even if it lags, `execute_order` rejects late orders by time.

**Security model (RLS):** teams see public event/company/round/price data plus their own team, holdings, orders and snapshots; only the event's creator can write. The projector reads `leaderboard_view` and `equity_curve_view`, which expose team name, value, rank and round change — never cash or holdings. Unreleased headlines are invisible to teams, and the organiser's private "suggested moves" live in `round_notes`, which teams cannot read at all.

**Sessions:** cookie-based via `@supabase/ssr`. Teams sign in anonymously and claim a join code, so a refresh, a closed tab or a phone reboot keeps them logged in. If a team loses their session, the organiser clicks *Reset login* and they rejoin with the same code.

**Live updates:** every screen subscribes to Supabase Realtime and re-fetches the server-rendered page on change; screens also poll gently (3–6 s) and on tab focus, so a dropped socket can never leave a phone stale. Countdowns use server time (`/api/time`), not the phone clock.

---

## Deploy (Vercel + Supabase cloud)

1. **Create a Supabase project** (free tier is fine). In *Authentication → Providers*, enable **Anonymous sign-ins**. In *Authentication → Rate limits*, raise anonymous sign-ins per hour well above your team count (a whole hall shares one public IP).
2. **Push the schema:**
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   The migrations enable `pg_cron` and the realtime publication themselves.
3. **Create the organiser account:** either sign up from `/admin/login` on the deployed site (leave *Confirm email* on, or turn it off in Auth settings for a quick start), or run `pnpm seed` against the cloud project by putting its URL + service-role key in `.env.local` (`SEED_ADMIN_EMAIL/PASSWORD` set the login).
4. **Deploy to Vercel:** import the repo, framework *Next.js*, and set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   
   (`SUPABASE_SERVICE_ROLE_KEY` is only needed locally for seeding — do not add it to Vercel.)
5. **Supabase → Authentication → URL configuration:** set *Site URL* to your Vercel domain.

That's it — no paid services. The projector URL is `https://<your-domain>/display/<eventId>` (linked from the admin header).

---

## Project layout

```
supabase/migrations/   schema, functions, RLS, round_notes
supabase/tests/        pgTAP tests (execute_order edge cases, state machine, leaderboard, undo, RLS)
scripts/seed.ts        demo data
src/app/play           team screen (join, portfolio, market, trade drawer, history, ranks)
src/app/admin          organiser console (wizard, control room, companies, headlines, teams, settings)
src/app/display        projector board
src/hooks              server clock / countdown, realtime + polling refresh
src/lib                supabase clients, zod schemas, formatting, friendly error mapping
e2e/                   Playwright happy path
```
