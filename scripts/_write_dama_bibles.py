#!/usr/bin/env python3
"""Write expanded Dama bible markdown guides (no em dashes)."""
from pathlib import Path

GUIDES = Path(__file__).resolve().parents[1] / "docs" / "guides"


def w(name: str, body: str) -> None:
    body = (
        body.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    p = GUIDES / name
    p.write_text(body.strip() + "\n", encoding="utf-8")
    print(name, p.stat().st_size)


COMPLETE = r"""
# Dama - Complete App Guide (Product Bible)
End-to-End Guide for Players, Organizers, Publishers, Admins, and Support

This is the master bible for Dama. It is written for non-technical people: players, cup organizers, ad publishers, customer support, and platform operators. You do not need coding knowledge.

Dama is an online international draughts (also called international checkers / dama) competition platform. People practice against a computer, play rated matches against others, challenge friends, join Official and Community tournaments, host their own cups, fund a wallet, run in-match ads, and complete identity checks when cash features are used. Platform staff run money reviews and competition settings from a separate Admin Console.

## How to use this bible
- Read Section 1 (roles) so you know which audience you are.
- Read Section 2 (glossary) whenever a word feels technical.
- Follow the step-by-step paths for your job (play, host, publish ads, or admin).
- Use companion bibles for deep dives: Play and Matchmaking, Competition Formats, Wallet and Compliance, Ads and Admin Ops.

Every major topic below answers: Who, What, When, Why, Where, How.

---

## 1. Who uses Dama (roles and audiences)

### 1.1 Guest (visitor without Google sign-in)
Who: Anyone who opens the app and has not signed in.
What they can do: Browse Play home, try VS-AI (play against computer) when that feature is on, watch public live games (spectate), browse public tournaments, view leaderboard/status, read legal pages, open public player profiles.
What they cannot do: Real human vs human matches, matchmaking queue, invites, friends, chat/DMs, wallet money, KYC, payouts, enroll in cups, host cups, publish ads, use admin.
When: First visit, try-before-account, watching a shared game link.
Why: Let people feel the board with almost no friction.
Where: Web Play home `/`, Flutter Home tab; spectate and tournaments browse.
How (example - practice vs computer):
1. Open the website or Flutter app.
2. On New Game, choose Play against computer (label comes from the database).
3. Pick a difficulty depth if shown.
4. The app may create a temporary guest practice session in the background.
5. The board starts. Two clocks may appear (see timer section).
6. Play until someone wins on the board, you stop/resign, or time runs out.

### 1.2 Signed-in player (default account)
Who: A person who signed in with Google and received a normal player account.
What they can do: Everything a guest can, plus human matches, queue, invites, friends, DMs, game chat, wallet top-up, receipts, KYC, payouts (when allowed), Official and Community cups as a participant, profile, settings, notifications.
What they cannot do: Admin Console (unless given admin role), review other people receipts/payouts, change platform catalogs/flags, force-start other people bracket matches.
When: After first Google sign-in; everyday play and money.
Why: One identity for rated play, social, money, and competition.
Where: Web Play `/`, portal `/dashboard` `/wallet` `/settings`, Flutter Home and portal pages.
How (example - find a rated match):
1. Sign in with Google.
2. If the platform requires OTP (one-time password), complete it when asked before queue/money actions.
3. Tap Find match / Join queue.
4. Wait. When another player is waiting, the server pairs you automatically (no accept dialog).
5. Open the live board and play.

### 1.3 Official tournament player
Who: Signed-in player enrolled in an admin-created Official cup.
What: Enroll/join, check-in, Ready, play bracket or arena, receive prizes when placed.
Cannot: Create or edit Official cup settings; force-start others; settle prizes.
Where: Tournaments hub Official tab `/?view=tournaments`.
How: Enroll -> wait for start -> check in -> Ready when seated -> play -> wait for settle.

### 1.4 Community participant
Who: Signed-in player who joins someone else hosted cup (public Community or private invite code).
What: Join/pay entry, check-in, Ready, play, report issues.
Cannot: Start/close the cup, edit fees/branding, force arena finish as host.
Where: Community tab or invite link with code.

### 1.5 Hosting organizer (Community cup owner)
Who: Signed-in player who creates and runs Community cups (when Hosting is enabled).
What: Create cup, pay host fee from wallet, share link/QR, start cup, manage roster tools the product allows, analytics, nested Hosting wallet.
Cannot: Edit global catalog (formats/fees) - that is admin; cannot edit Official cups.
Where: Hosting `/events/*`, Host CTA on Tournaments hub.
How: Create -> pay host fee -> share -> Start -> players check-in/Ready or arena queue -> finish.

### 1.6 Ads publisher / ad creator
Who: Signed-in user of the Ads shell.
What: Create campaigns, pay create fee, upload creatives, schedule, analytics, nested ads wallet/receipts.
Cannot: Change global ad playback policy (admin); invent placements outside server rules.
Where: `/ads/dashboard`, `/ads/campaigns`, Flutter Publisher shell.

### 1.7 Platform admin / superadmin
Who: Operators of the separate Admin Console app with console roles and permissions.
What: Users, payments, Official cups, Hosting catalog, progression/match clocks, ads runtime, feature flags, RBAC (usually superadmin), telemetry.
Cannot: Use Admin as a substitute for Telegram without setup; cannot invent UI labels (labels come from database chrome).
Where: Admin app only.

### 1.8 Telegram ops reviewer
Who: Humans listed for the Dama Telegram ops bot (money review lane).
What: Approve/reject manual receipts; approve/reject/mark-paid payouts from Telegram.
Cannot: Replace full Admin Console; reject without a reason.
Where: Telegram DMs; bridge configured in Admin -> Payments -> Telegram ops.

---

## 2. Plain-language glossary

| Term | Plain meaning |
|------|----------------|
| Web app | The Dama website in a browser |
| Flutter app | The Dama mobile app |
| Admin Console | Separate staff website for operating the platform |
| Sign-in / Google OAuth | You press Sign in with Google; Google proves who you are; Dama then creates your session |
| Session / JWT | Your login ticket stored by the app so you stay signed in. You never need to see the raw ticket |
| Guest practice session | Temporary ticket for VS-AI only. Not a full account |
| OTP | One-time password / verification code. When enabled, required before some play and money actions |
| Feature flag | Admin on/off switch for a feature (example: VS-AI on/off) |
| Chrome (product word) | Database text labels and messages shown in the UI. Apps fail closed if required text is missing |
| Play home | Main board + New Game / Games / Players rail |
| VS-AI / Play against computer | Single-player practice vs the engine |
| Matchmaking queue / Find match | Global waiting line. Second player creates a rated game automatically |
| Invite / challenge | You pick opponent or share a link; they must accept before the game starts |
| Rated | Match counts toward rating |
| Unrated | Practice-style; AI games are unrated |
| Spectate / Watch | View a live game without playing |
| Dual clocks / match clock | Each seat has its own timer. Only the player to move loses time |
| Flag-fall | Side to move hits 0:00 and loses on time |
| Time control / preset | Starting minutes (example 1, 3, 10, 30) from database presets |
| Increment | Seconds added after you complete a move (if admin set increment > 0) |
| Wallet | Your in-app money balance |
| Top-up | Add money (provider checkout or manual bank receipt) |
| Manual receipt | You transfer at a bank, upload proof, wait for human review |
| KYC | Know Your Customer identity checks (age, phone, ID documents) |
| Payout | Cash-out request from wallet to your payout method |
| Official tournament | Cup created by platform admin |
| Community / Hosting | Cup created by a player organizer |
| Enroll / Join | Enter a cup (free Join or paid Enroll) |
| Check-in | Confirm you are present before classic brackets seed |
| Ready | Both seats tap Ready; then the board starts |
| Bracket | Tree of matches (especially knockout) |
| Arena | Timed continuous queue inside a cup |
| Ads campaign | Publisher schedule that can show inside eligible matches |
| Dual-actuator | Console and Telegram can both review the same money item; first success wins |

---

## 3. The big picture

Think of Dama as layers that share one live backend (server + database):
1. Play home - board and social rail
2. Player portal - overview, wallet, receipts, settings
3. Tournaments hub - Official | Community | All
4. Hosting shell - organizer tools under `/events`
5. Ads shell - publisher tools under `/ads`
6. Admin Console - staff ops
7. Telegram ops - optional mobile money review

One-sentence journey: Guest tries AI -> signs in with Google -> finds a match or invites a friend -> clocks run on the server -> tops up wallet if needed -> joins or hosts a cup -> publisher may show ads in matches -> admin/Telegram reviews money when needed.

---

## 4. Apps and sign-in

### 4.1 Which app for whom
| App | Who | Purpose |
|-----|-----|---------|
| Web player | Guests, players, organizers, publishers | Full browser experience |
| Flutter | Same on phone | Same product shells |
| Admin Console | Admin / superadmin | Operate platform |
| Telegram | Ops reviewers | Receipt/payout review DMs |

### 4.2 Sign-in step by step
Who: Anyone who needs a real account
What: Google sign-in only (no password login in current product)
When: Before human matches, money, hosting, ads, admin
Why: Trusted identity
Where: Sign-in button / `/auth/login`; Flutter sign-in; Admin login
How:
1. Tap Sign in with Google.
2. Finish Google screens.
3. App completes Dama session exchange.
4. You return to Play, portal, Hosting, Ads, or Admin depending on where you started.

Important: Guest practice ticket is not the same as a Google account. Guests cannot spend wallet money or join the queue.

### 4.3 OTP (when enabled)
Who: Signed-in players when the OTP feature flag is on
What: Extra verification before queue, invites, moves, enroll, host create/join, checkout, receipts, payouts
When: Flag otp_required is on and you have not verified recently
Why: Reduce abuse on play and money
Where: OTP screens prompted by the app
How: Request code -> enter code -> continue.
Note: Guest VS-AI skips OTP. Cash phone OTP is a separate optional gate for phone KYC when that flag is on.

---

## 5. Play home day to day

Who: Guests and players
What: Board in the center; New Game, Games, Players on the rail
When: Default landing
Why: Start or resume play in one place
Where: Web `/`, Flutter Home

### 5.1 Play against computer (VS-AI)
How:
1. Open New Game -> AI / computer section.
2. If you are on Tournaments browse (`/?view=tournaments`), pressing Play against computer must take you back to Play home so the board is visible.
3. Choose depth (allowed depths come from feature flags).
4. Start. Clocks arm from platform default when match clocks are enabled.
5. Stop game resigns / ends the session and should return you to practice setup on Play home.

### 5.2 Global queue (Find match)
Who: Signed-in only
What: Automatic rated pairing among everyone in the queue
How: Join -> wait -> server pairs on second player -> match_found -> board
Notes: Always rated. Uses platform default time control. No accept dialog. Not friends-only.

### 5.3 Invite / challenge
Who: Signed-in
What: Accept-gated match with rated / color / time preset
How: Pick opponent or open link -> choose preset -> send -> accept -> game created

### 5.4 Spectate
Who: Anyone for public games
What: Watch live board and clocks; spectators do not burn clocks
Where: `/?view=spectate&gameId=` or Games Watch

### 5.5 Friends, DMs, game chat
Who: Signed-in
What: Friend requests; direct messages; per-game chat
Where: Players rail Friends | Requests | DMs | All

---

## 6. Match timer bible (simple)

Who: Seated players (spectators see clocks but do not claim flags)
What: Two real clocks. Only the player whose turn it is loses time.
When: Armed when a game is created and match_clock is enabled in admin Progression
Why: Fair end on time; clients cannot invent remaining time
Where: Live board web/Flutter; Admin Progression configures defaults

How it works:
1. Admin sets enabled, default seconds, increment, invite TTL, presets.
2. Game create arms both seats (invite may use chosen preset; queue/AI/cups use default).
3. Server subtracts time from the active seat on moves, on refresh/load, and with a background checker.
4. Optional increment after a completed move.
5. Web/Flutter only smoothly display server numbers between updates.
6. At 0:00 the seated app asks the server to flag; server confirms and ends with reason clock_flag (opponent wins on time), or rejects if time remains. Rare bare king vs bare king endings may draw on time (end_reason clock_draw, draw_reason insufficient_material).
7. Seated UI shows “Won on time” / “Lost on time” / “Draw on time” from database play chrome (not a generic “You won”), including the short board-status / seat-hint window before the finished overlay (turn hints stay off while the clock owns the end). Clients do not invent a board-wipe winner over a clock ending. Spectate uses “White/Black won on time” / “Draw on time” (fail-closed if outcome is briefly delayed). Competition/career points still apply on a decisive flag-fall; finalize is single-flight so points cannot double-apply.
8. Reconnect loads state; remaining time does not reset to full.

Example: Both start 10:00. You think 30 seconds and move -> you about 9:30, opponent still 10:00. If you hit 0:00 on your turn, opponent wins on time.

Stop game: Resigns/abandons through the server. Error messages should talk about stop/load failure - not Play chrome unavailable.

---

## 7. Player portal, wallet, KYC (overview)

Who: Signed-in players
Where: `/dashboard`, `/wallet`, `/transactions`, `/receipts`, `/settings` (Flutter mirrors)
What: KPIs, history, money, compliance, account tools

Wallet paths (detail in Wallet bible):
- Provider checkout (geo decides Ethiopia vs global)
- Manual bank transfer + receipt upload -> admin or Telegram review -> balance updates

KYC layers:
- Age gate when cash policy requires
- Phone KYC (+ optional phone OTP flag)
- Document KYC (ID front/back, selfie, legal name, document type) when required for payout

Payout: save method with phone -> pass gates -> request -> ops approve/reject/mark paid

---

## 8. Official vs Community cups (overview)

Official: Admin creates/starts; players enroll on Official tab.
Community/Hosting: Player organizer creates; public list or private code; same play engines.

Shared player loop: enroll/join -> check-in (classic) -> Ready -> board + clocks -> advance -> settle.

Five formats (detail in Competition bible): knockout, round robin, Swiss, groups+knockout, arena.
Groups settings (target group size, advance per group) are set by Admin in the events catalog. Knockout after groups starts automatically when all group games finish.

---

## 9. Ads overview

Publisher: create campaign, pay fee, creative, schedule, analytics.
Admin: global playback policy and console overrides.
Ads may appear inside eligible live matches when schedule and eligibility pass.

---

## 10. Admin Console map (overview)

Sections typically include:
- Overview / Activity
- Customers (Users, Avatars)
- Sales and revenue (Currency, Geo, KYC, Payouts, Receipts, Transactions, Banks, Telegram ops)
- Competition (Tournaments, Events catalog, Progression / match clock)
- Product and growth (Ads, Media pool)
- Access and security (Feature flags, RBAC, Telemetry)

Permissions gate every sensitive page. Superadmin usually has all; admin usually has all except RBAC manage unless granted.

---

## 11. Master checklists

Player: Google sign-in; VS-AI; queue pair; invite 60s preset; friend+DM; spectate; KYC paths; wallet top-up; join free cup; Ready; portal pages.
Organizer: Fund wallet; create public and private cups; test each enabled format; Ready and arena; prize path.
Publisher: Fund wallet; create campaign; schedule; analytics move; invoice/receipt.
Admin: Role+permissions; currency/geo; banks; match_clock; Official cup + catalog; flags; receipt/payout review; Telegram Ready if used.

---

## 12. Troubleshooting FAQ

Why does Play against computer on tournaments not show the board?
It must navigate back to Play home (`/`). If it does not, that is a bug - the center was still on tournaments browse.

Why did I see Play chrome unavailable when stopping?
That label means required UI text failed to load. Stop failures should show a load/stop failure message instead. If you still see chrome unavailable on the whole Play page, required database labels are missing - contact admin/support.

Why is queue 10 minutes but my invite was 1 minute?
Queue uses platform default. Invites use the preset you chose.

Why am I not in the bracket?
Missed check-in, or cup not started, or you are not enrolled.

Why no knockout yet in groups format?
Group games still open. Knockout builds automatically when all group matches finish.

---

## 13. URL quick reference

| Surface | Path |
|---------|------|
| Play home | `/` |
| Tournaments | `/?view=tournaments` |
| Spectate | `/?view=spectate&gameId=` |
| Matchmaking | `/matchmaking` or `/?view=match` |
| Portal | `/dashboard` |
| Wallet | `/wallet` |
| Hosting | `/events/dashboard` |
| Ads | `/ads/dashboard` |
| Admin | Admin app `/dashboard`, `/tournaments`, `/payments/*`, `/progression` |

Menu labels come from database navigation settings.

---

## 14. Related bibles
- Dama_Play_And_Matchmaking_Guide
- Dama_Competition_Formats_Guide
- Dama_Wallet_Payments_And_Compliance_Guide
- Dama_Ads_And_Admin_Ops_Guide
"""

PLAY = r"""
# Dama - Play and Matchmaking Bible
Guest, Player, Spectate, Friends, Chat, Timer, Stop Game

Non-technical bible. Who / What / When / Why / Where / How everywhere.

## 1. Who this bible is for
- Guests trying VS-AI
- Players using queue, invites, friends, chat
- Spectators
- Support explaining why a game started or did not

## 2. Play home layout
Who: Guests and players
What: Center board (or tournaments browse when that view is open) + right rail New Game | Games | Players
When: Default app landing
Why: One place to start
Where: Web `/`, Flutter Home

Important UX rule: If you are browsing Tournaments (`/?view=tournaments`) and press Play against computer, the app must leave tournaments browse and show the Play board on home.

## 3. VS-AI step by step
Who: Guests (practice ticket) and signed-in players
What: Instant single-player game
When: Learning / warm-up
Why: No opponent search
Where: New Game -> computer action
How:
1. Confirm VS-AI feature is enabled (admin feature flag).
2. Pick an allowed depth.
3. Start (guest ticket minted if needed).
4. Clocks arm from platform default when clocks enabled.
5. Move on your turn; computer replies.
6. Stop game: confirm -> server abandon/resign when a game id exists -> success toast -> return to Play lobby for embedded practice.
7. If stop fails, you should see a load/stop failure message (not Play chrome unavailable) and still return to lobby for embedded AI.

Cannot: Use guest ticket for PvP or wallet.

## 4. Global queue bible
Who: Signed-in players only (guests blocked)
What: Waiting line of players on this platform queue
When: Fast rated 1v1
Why: No accept step
Where: Find match / `/matchmaking`
How:
1. Join (OTP if required).
2. Wait; status may show queue size.
3. Second joiner pairs with whoever waited first.
4. Server creates rated game with default time control.
5. Both get match_found and open the board.
6. Leave queue cancels waiting if not paired yet.

Cannot: Pick a specific friend in the queue; pick a custom invite preset for queue games.

## 5. Invite / challenge bible
Who: Signed-in
What: Named or open-link challenge with rated, color, time preset
When: Specific opponent or shareable link
Why: Control pairing and clock preset
Where: Challenge CTAs / create form
How:
1. Choose user or open link.
2. Time control must match a database preset (examples often 60, 180, 600, 1800 seconds).
3. Send.
4. Accept/decline.
5. Game created only on accept.

## 6. During a live game
Who: Seated players
How a move works:
1. It is your turn (your clock runs).
2. You play a legal move.
3. Server checks you are the correct seat before burning clock.
4. Server updates clocks, applies move, may add increment.
5. Opponent receives update on the live connection.
6. Ends by board win, resign/abandon, cup forfeit, or flag-fall.

Spectators: watch only; do not claim clock flag.

## 7. Timer detail for support
Q: Does 0:00 end the game?
A: Yes, when the server confirms the side to move has no time left (flag-fall).

Q: Refresh reset my clock?
A: It should not. Reconnect loads remaining time after server update.

Q: Queue vs invite times differ?
A: Expected. Queue = platform default. Invite = chosen preset.

## 8. Friends and DMs
How: Search All -> friend request -> accept/deny/cancel -> Message opens DM.
Game chat: per match; seated players can disable chat; images follow media rules.

## 9. Stop game / abandon
Who: Seated player
What: Resign the match so opponent wins (AI counts as human loss)
How: Stop -> confirm -> server abandon -> success message -> finished screen or lobby for embedded AI
If abandon fails: show load-failed style message; embedded AI should still exit to lobby.

## 10. Common failures
| Symptom | Likely cause |
|---------|--------------|
| Cannot join queue | Guest, missing OTP, signed out |
| Invite time rejected | Preset not in match_clock presets |
| Clock still running on claim | Client hit 0 early; server still has time |
| No match_found | Alone in queue or left queue |
| Stuck on tournaments after AI click | Browse view not cleared - should go to `/` |
| Play chrome unavailable on whole page | Required DB play labels missing |
| Play chrome unavailable on Stop only | Wrong error label (should be load/stop failed) |

## 11. Support checklist
1. Signed-in vs guest
2. VS-AI and OTP flags
3. match_clock enabled + presets
4. Two accounts queue pair
5. Invite accept with 60s preset
6. Stop from embedded AI returns to Play home
"""

COMP = r"""
# Dama - Competition Formats Bible
Official and Community Cups - Knockout, Round Robin, Swiss, Groups+Knockout, Arena

Non-technical. Who / What / When / Why / Where / How.

## 1. Shared ideas
Official cups: created and started by Admin.
Community cups: created and started by a Hosting organizer; discovery under Community (public) or private invite code.
Same engines for formats. Classic draws usually rematch. Ready-timeout can forfeit no-shows.

Shared lifecycle:
1. Create cup
2. Players enroll/join (free or paid)
3. Optional check-in (classic formats seed from checked-in seats)
4. Start cup
5. Matches appear
6. Both Ready -> board + clocks (arena may auto-start)
7. Results advance
8. Finish / settle prizes

Who starts: Admin for Official; organizer for Community.

## 2. Knockout
What: Lose once, you are out. Final winner is champion.
How bracket is made: On Start, shuffle players, pad to next power of 2, byes auto-advance
Player steps: Check in -> see bracket -> Ready -> play -> winner advances
Example 8 players: quarters -> semis -> final
Example 6 players: pad to 8 with 2 byes
Draws: rematch reset on classic
Forfeit / ready timeout: opponent advances

## 3. Round robin
What: Everyone plays everyone once
Who wins: Highest standings points when all matches finish
How: All pairings created at start
Example 4 players: 6 games
No byes
Cup ends only when full slate is done

## 4. Swiss
What: Fixed number of rounds; re-pair by score each round
Rounds: From catalog map by max players (example max 8 -> 3 rounds)
Pairing: Sort by points; avoid rematches when possible; odd player gets bye (bye counts as win)
Advance: Whole round finishes -> next round or final standings

## 5. Groups + knockout
What: Group round robins, then knockout of advancers
Who sets how groups work: Admin Events catalog
- groups_knockout_target_group_size (default often 4)
- groups_knockout_advance_per_group (default often 2)
How groups form: At Start, server shuffles and deals into groups automatically. Organizers do not hand-pick groups.
When knockout starts: Automatically when every group-phase match is finished. No human Start knockout button.
Who advances: Top N by points in each group
Example: 8 players, size 4, advance 2 -> 2 groups -> top 2 each -> 4-player KO
If fewer than 2 advancers: finish on overall group standings

## 6. Arena
What: Timed continuous matchmaking inside the cup
How:
1. Start sets end time (duration from cup/catalog)
2. Players Join arena queue in cup lobby
3. Worker pairs queued players (rating or score mode)
4. Boards start (often auto-start)
5. Results add arena points (streak bonuses; draws score; losses reset streak)
6. Re-queue until clock ends or force finish
7. Champion = top arena points
Late join: may be allowed while live if that flag is on
Unlike classic: draws score points instead of rematch reset

## 7. Ready / rematch / forfeit
1. Match ready with both seats
2. Each taps Ready
3. Both ready -> server creates PvP game and arms clocks
4. Admin/organizer may force-start or rematch when allowed
5. Ready-timeout worker can auto-forfeit no-shows

## 8. Official vs Community differences
| Topic | Official | Community |
|-------|----------|-----------|
| Creator | Admin | Organizer |
| Discovery | Official tab | Community / invite code |
| Catalog | Admin edits | Uses catalog; cannot edit it |
| Rated public Community | If public_event_matches_rated on | Private never rated |

## 9. Organizer day-of checklist
1. Confirm format/size before fees
2. Share link/QR
3. Start when enough checked-in (classic) or enrolled (arena)
4. Watch Ready timeouts
5. Groups+KO: wait for automatic promotion
6. Arena: announce end; force finish only if needed
7. Close and confirm prizes

## 10. Player FAQ
Not in bracket? Missed check-in or not enrolled.
No knockout yet? Group games still running.
Joined after start? Only Arena late-join when flag allows.
"""

WALLET = r"""
# Dama - Wallet, Payments and Compliance Bible
Players, Organizers, Publishers, Admin, Telegram Ops

Non-technical. Who / What / When / Why / Where / How.

## 1. Who touches money
| Audience | What they do |
|----------|--------------|
| Player | Top-up, entry fees, prizes, payout |
| Organizer | Host fee / guarantee holds; nested Hosting wallet |
| Ads publisher | Campaign create fee; nested Ads wallet |
| Admin | Currency, geo, banks, review receipts/KYC/payouts |
| Telegram ops | Same money reviews from Telegram |

One wallet ledger is shared across player portal, Hosting nested wallet, and Ads nested wallet.

## 2. Currency and geo
Who: Admin
What: Global USD vs Ethiopia ETB and payment routes by geo
When: Before live payments
Why: Correct provider and bank instructions
Where: Admin Currency + Geo routing
Players do not invent country on pay screens; server uses geo locate.

## 3. Player top-up
### Provider checkout
1. Open Wallet
2. Choose amount
3. Complete configured provider checkout
4. Balance credits on success path

### Manual bank transfer
1. Open manual path
2. Copy bank details from Admin Banks
3. Transfer offline
4. Upload receipt
5. Pending until human review
6. Admin Console or Telegram approve/reject
7. Approve increases balance; reject notifies (with note when provided)

## 4. Cash / RMG gates (plain language)
When cash features are used, the server checks safety rules and can block the action:
- Master cash switch off
- Country disabled or not on allowlist
- Age gate not passed
- Phone KYC missing
- Document KYC missing when required for payout
- OTP gates when those flags are on

## 5. Phone KYC
If phone KYC required:
- Phone OTP flag OFF (default): saving phone can mark verified
- Phone OTP flag ON: save phone, then enter phone OTP

## 6. Document KYC
Who: Players needing payout when policy requires documents
What: ID front, ID back, selfie, legal name, document type
Where: Settings / wallet gate; Admin KYC review
How: Upload -> submit -> admin approve/reject (reject may allow resubmit)

## 7. Payouts
Player: add payout method with primary phone -> pass gates -> request (wallet holds pending) -> wait -> approved then mark paid by ops; rejected returns funds per design
Admin/Telegram: approve / reject / mark paid using policy statuses
Dual-actuator: first successful review wins; second gets conflict

## 8. Cup and ads money
- Entry fees debit wallet on paid enroll/join
- Host fee on Community create
- Prize escrow/settle after finish and dispute windows
- Ads create fee on campaign create by geo
- Receipts/invoices downloadable as PDF (Flutter uses share sheet)

## 9. Telegram ops Ready checklist
1. Admin -> Payments -> Telegram ops
2. Bot URL, API key, reviewer user, timeout
3. Telegram admin IDs on bot
4. Test manual receipt notify
5. Approve in Telegram
6. Confirm console shows reviewed
7. Confirm double review conflicts

## 10. Support scripts
Receipt pending: waiting for human review.
Cannot payout: check phone method, document KYC, cash flag, country, OTP.
Paid entry but not in cup: confirm payment success and correct Official vs Community id.
"""

ADS = r"""
# Dama - Ads Publisher and Admin Ops Bible
Publishers and Platform Operators

Non-technical. Who / What / When / Why / Where / How.

## Part A - Ads publisher bible

### Who / What / When / Why / Where
Who: Signed-in Ads shell users
What: Create and schedule in-match campaigns
When: After wallet can pay create fee
Why: Self-serve advertising into eligible live games
Where: `/ads/*`, Flutter Publisher shell

### Create campaign steps
1. Open Ads Dashboard
2. Campaigns -> Create
3. Pay database create fee (amount depends on geo)
4. Title + creative type
5. Upload media / attach YouTube when supported
6. Schedule: first show, interval, caps, optional non-skippable within admin bounds
7. Set servable status
8. Save

### Day to day
- Pause/close; reopen only if not auto-closed
- Read analytics (impressions, clicks, CTR, spend)
- Nested wallet/receipts/transactions/payout
- Download invoice PDF

### Cannot
- Edit global ad playback defaults
- Force serve when eligibility fails
- Moderate all publishers without admin permission

## Part B - Admin ads runtime
Who: Admins with ads permissions
Where: Admin -> Product and growth -> Ads
What: Global playback policy, bounds, console campaign overrides

## Part C - Admin console bible

### Overview
KPIs and Activity analytics.

### Customers
Users: search, role, activate/deactivate, inspect KYC/payout methods.
Avatars: moderate uploads.

### Sales and revenue
Currency, Geo, Document KYC review, Payouts, Receipts (view/PDF/print), Transactions, Banks, Telegram ops config.

### Competition
Official tournaments lifecycle (create, start, force tools, settle).
Hosted events catalog (sizes, formats, fees, Swiss rounds map, groups target/advance, arena defaults).
Hosted reports moderation.
Progression: XP ladder and match_clock (enable, default preset, increment, invite TTL; presets listed from DB).

### Product and growth
Ads + Media pool.

### Access and security
Feature flags (VS-AI, OTP, cash switches, hosted events, rated public events, etc.).
RBAC (usually superadmin).
Telemetry vault.

### Permission examples
payments.review, tournaments.write, events.manage_catalog, events.manage_reports, progression.write, ads.manage_runtime, ads.manage_campaigns, feature_flags.write, rbac.manage, users.read/write, telemetry.read, activity.read

## Part D - Operator daily checklist
1. Clear pending receipts and payouts
2. Check KYC queue
3. Healthy Official cups
4. Skim hosted reports
5. Confirm feature flags for market
6. If ads live, skim runtime and stuck campaigns
7. If Telegram ops on, confirm Ready and overnight notifies
"""

README = r"""
# Dama documentation bibles

These guides are the product bibles for Dama (web, Flutter, Admin Console, Telegram ops). Written for non-technical readers with Who / What / When / Why / Where / How, step-by-step flows, and a glossary of terms.

## Word downloads
Folder: `docs/guides/downloads/`
- Dama_Complete_App_Guide.docx - master bible for all roles
- Dama_Play_And_Matchmaking_Guide.docx - play, queue, invites, timer, stop game
- Dama_Competition_Formats_Guide.docx - knockout, RR, Swiss, groups+KO, arena
- Dama_Wallet_Payments_And_Compliance_Guide.docx - wallet, KYC, payouts, Telegram ops
- Dama_Ads_And_Admin_Ops_Guide.docx - publishers + admin console

## Markdown sources
Same names as `.md` in this folder.

## How to regenerate DOCX
From repo root: `python scripts/build-dama-guide-docx.py`

## Note on Smart Menu sample docs
`smart-menu-sample-referance-only-frontend/` holds hospitality reference manuals. Those are not Dama. These Dama bibles are the game-platform equivalents.
"""


def main() -> None:
    GUIDES.mkdir(parents=True, exist_ok=True)
    w("Dama_Complete_App_Guide.md", COMPLETE)
    w("Dama_Play_And_Matchmaking_Guide.md", PLAY)
    w("Dama_Competition_Formats_Guide.md", COMP)
    w("Dama_Wallet_Payments_And_Compliance_Guide.md", WALLET)
    w("Dama_Ads_And_Admin_Ops_Guide.md", ADS)
    w("README.md", README)
    print("ok")


if __name__ == "__main__":
    main()
