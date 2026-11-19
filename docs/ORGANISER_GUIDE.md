# Running the event — organiser's one-pager

## Before the day (30 minutes)

1. **Sign in** at `/admin` and click **New event**. Name it, set starting capital (default ₹10 crore), number of rounds (10), and window length (180 s). Leave fees/short-selling off for beginners.
2. **Companies tab** — paste your list as `name, ticker, sector, price` (one per line; straight from a spreadsheet works). Aim for 15–25 companies across sectors so every headline has winners and losers.
3. **Headlines tab** — write every round's headline and a one-line explanation *now*. In the private **suggested moves** box, note what you plan to do, e.g. `LT +8%, ULTRACEMCO +7%, MARUTI -5%`. Teams never see this box; the control room uses it to fill prices with one click. In two or three rounds, also fill in the **Act of God** section: a breaking-news shock with its own price moves and extra seconds, which you fire mid-window (see below).
4. **Teams tab** — create named teams or generate blank ones. Click **Print codes & QR** and print one card per team.
5. Open `/display/<eventId>` on the projector laptop (link is in the admin header). It needs no login. Press F11 for full screen. It does not rotate: the headline and market prices are two panels side by side, and you move between them sideways with the mouse wheel, the arrow keys, Page Down/Up or a presenter clicker (or click the panel names at the bottom). Add `?view=headline` or `?view=prices` to show just one panel. **There is no public leaderboard:** the projector never shows team values or ranks, even at the end.
6. **Keep logins stable.** In the Supabase dashboard open *Authentication → Sessions* (or *JWT settings*) and set the JWT expiry to `86400` (24 hours). Short-lived tokens are the usual reason an organiser or a team gets signed out in the middle of an event.

## On the day

Teams scan their QR — that alone logs them in — or type the 6-letter code on the **Team** tab at `/login`. Each team trades as a company named after its chest number: enter the chest numbers under **Add teams by chest number** (one per line), or rename a team on its card. Teams can't change their own name.

Until you release round 1's headline, a team's phone shows one big card with its chest number and portfolio, and no buttons at all. It switches by itself when you release the headline. Until you open round 1's trading window, teams still see no companies, history or ranks, and the projector's prices section says the market opens in round 1. Releasing the headline shows the news; **Open trading window** reveals the companies to everyone at once, and they stay visible for the rest of the event. The Teams tab shows who has joined. If a phone dies, click **Reset login** on that team and they rejoin on another phone with the same code.

On a team's screen the current headline sits on top and earlier rounds' headlines stay below it, newest first, with any Act of God shown above its round. On a laptop that column scrolls by itself, so the portfolio stays in view. **Late registrations:** seed gives 15 chest numbers (SPC-11 to SPC-15 are spare); rename a team or fill in its college on the Teams tab, or paste more chest numbers under *Add teams by chest number*.

Everything happens in the **Control room** tab. A round is two buttons, in order, and the third step happens by itself:

| Step | What happens |
|---|---|
| **Release headline** | The headline appears on every phone and the projector. Read it aloud; give teams a minute to discuss. |
| **Open trading window** | The countdown starts (server-timed, identical on every screen). Teams buy/sell. Orders stream in on the right. The window closes itself at 0:00 — use *Close window now* only to end early. |
| **Prices apply automatically** | When the window closes, the % moves you planned for that round (the private *suggested moves* on the Headlines tab) are applied at once and the next round becomes active. You don't enter anything. |

If you'd rather review prices every round, turn off **Apply each round's planned prices automatically** in Settings. Then the price table appears after each window, already filled in from your plan, and you click **Apply prices & finish round**.

**Watching the crowd.** While the window is open, the **Order flow this round** panel shows every company teams are trading: ₹ bought, ₹ sold, net, and how many teams. The feed on the right lists every order of the round with team, price and time. Use it to decide where to aim an Act of God or the end-of-round prices.

**Act of God (a round within a round).** While the window is open, the red **⚡ Act of God** card lets you fire breaking news once per round. It is prefilled from that round's draft if you wrote one. Prices move the moment you fire, every phone and the projector show a red BREAKING banner, and the countdown gets the extra seconds. Trades after it use the new prices. Click **Fire** twice to confirm; it can't be undone. **Every round has one drafted** (heavy losses for whoever followed the obvious trade, all editable before you fire), so you can use it in any round. It's optional: if you don't fire, the round finishes automatically as above. If you do, the round does **not** auto-apply, because you already set the prices: after the window closes you click a single **Finish round** button, with no price entry (an optional link lets you add extra moves).

Made a mistake? **Undo** (below the round card) reverts the last price application — available until you release the next headline.

After the final round the projector says the market has closed and results will be announced. **The winner is chosen by score, not by money.**

## Judging: the score out of 20

Teams only ever see their own portfolio. You see every team's value in the control room and on the **Scores** tab, which marks each team out of 20 in four sections of 5:

| | Section | What earns marks |
|---|---|---|
| **A** | Decisions under pressure | Positioning and trades in high-impact rounds (an Act of God, or a move of 8%+) against the market, and the reaction to each Act of God (cut the hit scripts = full marks; sat on them = half; bought more of them or sat in cash = none). |
| **B** | Script selection | How often, and by how much, the team's scripts beat the average script while it was invested. One lucky round can't carry it (each round is capped at ±10%). |
| **C** | Risk management | Small drawdowns, sensible sizing (no all-in bets above 60% of the portfolio), and willingness to take risk: more than 2 rounds spent entirely in cash (80%+ from start to finish) costs marks, and never investing beyond 30% scores zero here. |
| **D** | Outcome & discipline | Final return against the field, plus clean trading (no in-and-out churn in one round, few failed orders, active every round). |

Sitting out never pays: drawdown, sizing and outcome marks only count for the share of the game a team was actually invested. The app records every trade with its context (seconds into the window, before/after the Act of God, cash and portfolio size, position size) and what teams look at and try (scripts opened, orders that failed). That is what the scores are built from.

**Judges** can raise or lower any section by up to 2 marks, in half marks, with a note; a section stays between 0 and 5. Click **Details** on a team to see the reasons behind each mark.

**Paper copies.** *Scoring sheets (PDF)* opens an A4 layout with the marking scheme, a ranked summary and one page per team showing the app's marks beside empty boxes for the judges' marks, remarks and signatures. *Blank sheets* is the same with no marks filled in, plus two spare pages for late registrations. Print it, or choose *Save as PDF* in the print dialog. A ready-made blank sheet is in `docs/scoring-sheet-blank.pdf`.

**Records.** Download *scores.csv*, *orders.csv* (every trade with its context) and *activity.csv* (everything teams did) to keep with the results.

## Tips that make it fun

- Round 1 can have no headline: let teams place opening bets on instinct.
- Don't let the obvious trade always win. Pair rounds: a headline that pays off, then an even more bullish follow-up on the same stocks that loses money ("priced in", "sell the news"), explained by the next headline. The seeded demo does this across 10 rounds, with Acts of God in rounds 4, 7 and 9.
- Keep the projector on the **headline + countdown** panel during windows and switch to **market prices** right after the round finishes, so everyone sees what moved.
- Tell teams the two rules that matter: *you can only trade while the window is open*, and *you can't spend more than your cash or sell what you don't own*. The app enforces both and explains errors in plain words.
