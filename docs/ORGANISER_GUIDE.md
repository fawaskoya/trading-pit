# Running the event — organiser's one-pager

## Before the day (30 minutes)

1. **Sign in** at `/admin` and click **New event**. Name it, set starting capital (default ₹10 crore), number of rounds (6), and window length (180 s). Leave fees/short-selling off for beginners.
2. **Companies tab** — paste your list as `name, ticker, sector, price` (one per line; straight from a spreadsheet works). Aim for 15–25 companies across sectors so every headline has winners and losers.
3. **Headlines tab** — write every round's headline and a one-line explanation *now*. In the private **suggested moves** box, note what you plan to do, e.g. `LT +8%, ULTRACEMCO +7%, MARUTI -5%`. Teams never see this box; the control room uses it to fill prices with one click.
4. **Teams tab** — create named teams or generate blank ones. Click **Print codes & QR** and print one card per team.
5. Open `/display/<eventId>` on the projector laptop (link is in the admin header). It needs no login. Press F11 for full screen. Add `?view=leaderboard` to the URL if you want it pinned instead of rotating.

## On the day

Teams scan their QR (or type the 6-letter code at `/play`) and pick a team name. The Teams tab shows who has joined. If a phone dies, click **Reset login** on that team and they rejoin on another phone with the same code.

Everything happens in the **Control room** tab. Each round is four buttons, in order:

| Step | What happens |
|---|---|
| **Release headline** | The headline appears on every phone and the projector. Read it aloud; give teams a minute to discuss. |
| **Open trading window** | The countdown starts (server-timed, identical on every screen). Teams buy/sell. Orders stream in on the right. The window closes itself at 0:00 — use *Close window now* only to end early. |
| **Enter new prices** | The price table appears. Press **Fill suggested** (from your private notes) or type % changes yourself. Leave companies blank to keep their price. Only the companies the headline affects should move. |
| **Apply prices & finish round** | Prices update everywhere, the leaderboard reorders, and the next round becomes active. |

Made a mistake? **Undo** (below the round card) reverts the last price application — available until you release the next headline.

After the final round, the control room and projector show the winner. Winner = highest portfolio value; ties go to the team with fewer trades.

## Tips that make it fun

- Round 1 can have no headline: let teams place opening bets on instinct.
- Mix obvious headlines (cyber attack on IT → IT falls) with ambiguous ones (rate hike → banks up, autos down).
- Keep the projector on the **headline + countdown** view during windows and switch to **leaderboard** right after applying prices — that moment is the crowd-pleaser.
- Tell teams the two rules that matter: *you can only trade while the window is open*, and *you can't spend more than your cash or sell what you don't own*. The app enforces both and explains errors in plain words.
