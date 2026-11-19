# Running the event — organiser's one-pager

## Before the day (30 minutes)

1. **Sign in** at `/admin` and click **New event**. Name it, set starting capital (default ₹10 crore), number of rounds (10), and window length (180 s). Leave fees/short-selling off for beginners.
2. **Companies tab** — paste your list as `name, ticker, sector, price` (one per line; straight from a spreadsheet works). Aim for 15–25 companies across sectors so every headline has winners and losers.
3. **Headlines tab** — write every round's headline and a one-line explanation *now*. In the private **suggested moves** box, note what you plan to do, e.g. `LT +8%, ULTRACEMCO +7%, MARUTI -5%`. Teams never see this box; the control room uses it to fill prices with one click. In two or three rounds, also fill in the **Act of God** section: a breaking-news shock with its own price moves and extra seconds, which you fire mid-window (see below).
4. **Teams tab** — create named teams or generate blank ones. Click **Print codes & QR** and print one card per team.
5. Open `/display/<eventId>` on the projector laptop (link is in the admin header). It needs no login. Press F11 for full screen. It does not rotate: headline, leaderboard and market prices sit on one page, and you scroll between them with the mouse wheel, Page Down or a presenter clicker. Add `?view=leaderboard` (or `headline`, `prices`) to show just one section.

## On the day

Teams scan their QR — that alone logs them in — or type the 6-letter code on the **Team** tab at `/login`. Each team trades as a company named after its chest number: enter the chest numbers under **Add teams by chest number** (one per line), or rename a team on its card. Teams can't change their own name.

Until you release round 1's headline, a team's phone shows one big card with its chest number and portfolio, and no buttons at all. It switches by itself when you release the headline. Until you open round 1's trading window, teams still see no companies, history or ranks, and the projector's prices section says the market opens in round 1. Releasing the headline shows the news; **Open trading window** reveals the companies to everyone at once, and they stay visible for the rest of the event. The Teams tab shows who has joined. If a phone dies, click **Reset login** on that team and they rejoin on another phone with the same code.

Everything happens in the **Control room** tab. Each round is four buttons, in order:

| Step | What happens |
|---|---|
| **Release headline** | The headline appears on every phone and the projector. Read it aloud; give teams a minute to discuss. |
| **Open trading window** | The countdown starts (server-timed, identical on every screen). Teams buy/sell. Orders stream in on the right. The window closes itself at 0:00 — use *Close window now* only to end early. |
| **Enter new prices** | The price table appears. Press **Fill suggested** (from your private notes) or type % changes yourself. Leave companies blank to keep their price. Only the companies the headline affects should move. |
| **Apply prices & finish round** | Prices update everywhere, the leaderboard reorders, and the next round becomes active. |

**Watching the crowd.** While the window is open, the **Order flow this round** panel shows every company teams are trading: ₹ bought, ₹ sold, net, and how many teams. The feed on the right lists every order of the round with team, price and time. Use it to decide where to aim an Act of God or the end-of-round prices.

**Act of God (a round within a round).** While the window is open, the red **⚡ Act of God** card lets you fire breaking news once per round. It is prefilled from that round's draft if you wrote one. Prices move the moment you fire, every phone and the projector show a red BREAKING banner, and the countdown gets the extra seconds. Trades after it use the new prices. Click **Fire** twice to confirm; it can't be undone, but the end-of-round prices still move from wherever the shock left them.

Made a mistake? **Undo** (below the round card) reverts the last price application — available until you release the next headline.

After the final round, the control room and projector show the winner. Winner = highest portfolio value; ties go to the team with fewer trades.

## Tips that make it fun

- Round 1 can have no headline: let teams place opening bets on instinct.
- Don't let the obvious trade always win. Pair rounds: a headline that pays off, then an even more bullish follow-up on the same stocks that loses money ("priced in", "sell the news"), explained by the next headline. The seeded demo does this across 10 rounds, with Acts of God in rounds 4, 7 and 9.
- Keep the projector scrolled to the **headline + countdown** during windows and scroll to the **leaderboard** right after applying prices — that moment is the crowd-pleaser.
- Tell teams the two rules that matter: *you can only trade while the window is open*, and *you can't spend more than your cash or sell what you don't own*. The app enforces both and explains errors in plain words.
