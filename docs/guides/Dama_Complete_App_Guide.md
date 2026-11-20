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
Host trust / scammer protection (all organizers, platform-wide, mig 522 to 529):
- Free cups: anyone can create; no paid-host gates.
- Free and paid Community cups: Manage → Branding can set description and reward images (prize thumbnail + gallery, mig 533). Players see those on cards, detail, join-by-code, and cup lobby (prize→gallery, then logo→sponsor if prize empty). Logo/sponsor branding stays separate. Result cards stay logo/sponsor. Admin list thumb uses prize→gallery (mig 534). This does not auto-deliver physical prizes or change wallet pot rules.
- Paid cups: phone verified + not too many open paid cups at once (new 1 / phone 3 / ID 25) + not flagged by reports or cancel rate.
- Guaranteed prize cups: government ID verified + enough wallet money locked at create (with host fee). Cancel before start unlocks it. Start commits it to the pot. Finish pays winners after the dispute window.
- Players see Unverified host / Phone verified / Verified host badges on cards, hoster pages, profiles, dashboards, Watch seats/spectators.
- KYC auto-approve (default ON) approves government ID right away; when OFF, review at Payments → KYC.
- Admins edit gates, caps, and reputation on Sales → Host trust policy.
Full human steps: `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.
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
DM read receipts (web + Flutter; glyphs from database chrome): sender sees a single check until the peer opens and the server advances the read watermark; then a double check in brand burgundy. Admin has no player DM tick UI.

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
7. Seated UI shows "Won on time" / "Lost on time" / "Draw on time" from database play chrome (not a generic "You won"), including the short board-status / seat-hint window before the finished overlay (turn hints stay off while the clock owns the end). Clients do not invent a board-wipe winner over a clock ending. Spectate uses "White/Black won on time" / "Draw on time" (fail-closed if outcome is briefly delayed). Competition/career points still apply on a decisive flag-fall; finalize is single-flight so points cannot double-apply.
8. Reconnect loads state; remaining time does not reset to full.

Example: Both start 10:00. You think 30 seconds and move -> you about 9:30, opponent still 10:00. If you hit 0:00 on your turn, opponent wins on time.

Stop game: Resigns/abandons through the server. Error messages should talk about stop/load failure - not Play chrome unavailable.

### 6.1 Pause / Resume
Who: Any seated player (and unbound VS-AI human), when admin enables pause on Progression
What: Freeze both clocks and block moves until Resume or the admin max pause length ends
When: Board Pause control, or automatically when leaving a live board
Why: Step away without burning time or allowing opponent/AI moves
Where: Web + Flutter boards; floating Resume while browsing; Admin Progression (pause on/off + duration number with Seconds/Minutes)

How:
1. Admin enables pause and sets max length (number + unit, stored as seconds).
2. Player taps Pause on the board, or leaves the play surface while the match is still live.
3. Server freezes clocks; Floating Resume shows "Resumes in m:ss"; tap Resume to continue (or wait for auto-resume).
4. Same rules for VS-AI, queue/invite PvP, official tournament, and organizer hosted boards.
5. Leaving a finished board does nothing (no pause POST, no error toast). Soft nav back to a board paints from cache / keep-alive without a full board shimmer.

---

## 7. Player portal, wallet, KYC (overview)

Who: Signed-in players
Where: `/dashboard`, `/wallet`, `/transactions`, `/receipts`, `/settings` (Flutter mirrors)
What: KPIs, history, money, compliance, account tools

Wallet paths (detail in Wallet bible):
- Provider checkout (geo decides Ethiopia vs global)
- Manual bank transfer + receipt upload -> admin or Telegram review -> balance updates

KYC layers (scammer protection + cash compliance):
- Age gate when cash policy requires
- Phone verify (+ optional Cash phone OTP flag; default OFF means save phone verifies)
- Government ID (front/back, selfie, legal name, document type) when required for cash-out and for guaranteed prize hosting
- KYC auto-approve (default ON): ID approved right away; when OFF, Payments → KYC manual review
- Open paid cups: new host 1 / phone 3 / ID 25; too many reports or cancel-heavy hosts blocked from paid create

Payout: save method with phone -> pass gates -> request -> ops approve/reject/mark paid

Step-by-step host trust bible: `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.

---

## 8. Official vs Community cups and the five formats (plain overview)

Deep detail lives in the Competition Formats Guide. This section uses everyday words only.

### 8.1 Two kinds of cups
| Kind | Who creates and starts | Where players find it |
|------|------------------------|------------------------|
| Official | Platform admin | Tournaments hub -> Official |
| Community (Hosting) | A player organizer | Tournaments hub -> Community, or a private invite code / QR code |

Both kinds can use the same five formats. Once a match exists, Ready, the live board, and clocks work the same way.

### 8.2 Words you must know before formats
- Lobby: the cup home page (the tournament hall), where you check in, Ready, and see bracket or standings. Not the same as the chess board.
- Seat: one of the two player slots in a match.
- Check-in: confirm you are present before classic cups place you into first matches.
- Paid: wallet money is charged (paid entry or host fee). Free join does not charge.
- Bracket: the knockout chart of who plays whom.
- Shuffle: the server randomly mixes players at Start (nobody hand-picks favorites).
- Pair / pairing: two players assigned to one match.
- Queue (arena): waiting line inside an Arena cup for the next opponent.
- Draw: tied game. Classic cups usually rematch. Arena usually gives points.
- Bye: automatic advance when there is no opponent for a slot.
- Payout mode: rule for splitting the prize pool after a paid cup (place percent, share-score, or dual purse).
- Place percent: money by finish place envelopes only (example 50/30/20).
- Share-score: money by points on the scoreboard.
- Dual purse: pot split into podium money and score money.

We do not use short forms like QF or SF. For an 8-player knockout we say Round of 8, then Semifinals, then Final.

### 8.3 Shared player loop (classic formats)
1. Enroll or Join (free or paid).
2. Check in when asked.
3. Admin or organizer Starts the cup.
4. Your match appears in the lobby.
5. Both seats tap Ready -> live board + clocks.
6. Results move the cup forward until standings or a Final decide the champion.
7. After any dispute waiting period, prizes can settle to wallets.

Arena loop: Start opens a timed window -> join the arena waiting line -> get paired -> play -> re-join until time ends -> highest arena points wins.

### 8.4 The five formats in plain sentences
| Format | What it is | Who usually becomes champion |
|--------|------------|------------------------------|
| Knockout | Lose once and you are out | Winner of the Final |
| Round robin | Everyone plays everyone once | Top of the standings table when all games finish |
| Swiss | Fixed number of rounds; pair by similar score | Top standings after the last round |
| Groups then knockout | Small group round robins, then knockout of advancers | Winner of the knockout Final |
| Arena | Play many games until the cup clock ends | Highest arena points at the end |

### 8.5 Who configures the hard rules
| Rule | Who sets it |
|------|-------------|
| Which formats exist | Admin catalog |
| Swiss round counts | Admin catalog |
| Group size and how many advance | Admin catalog (organizer cannot choose group size) |
| Arena default duration and streak points | Admin arena settings |
| Match clocks on every board | Admin Progression |
| Pause on/off + max pause length | Admin Progression |
| Rated match XP + rating deltas + min rating floor + new-player starting rating | Admin Progression (`match_rewards`) |

### 8.6 Critical groups fact
Organizers do not pick groups by hand. At Start the server shuffles players into groups. When every group game is finished, knockout starts automatically. Nobody presses a second Start for knockout.

### 8.7 How prize money is split (payout modes)
Paid cups need a payout mode. Organizer or admin chooses it at create (or the format default applies).

| Mode | Plain meaning | Tiny example (pot 1000) |
|------|---------------|-------------------------|
| Place percent | Pay by finish place only | 50/30/20 -> 500 / 300 / 200 |
| Share-score | Pay by points | Points 10, 6, 4 -> 500 / 300 / 200 |
| Dual purse | Split pot into place purse + points purse | 60% place / 40% points, then each purse pays its own way |

Prizes still wait for dispute window and settle. Full Who / What / When / Why / examples: Competition Formats Guide Part K2.

### 8.8 Community host fee (Ethiopia vs global)
Creating a Community cup charges a host fee from the organizer wallet. Admin sets **two fees per host size** on Events → Host sizes (DataTable CRUD, same pattern as ads Campaign create fees on Progression). Currencies come from payment_currency (not typed by the admin). The geo blurb uses `{ethiopia}` / `{global}` placeholders filled from that same DB pair.

| Organizer location | What they pay |
|--------------------|---------------|
| Ethiopia | Ethiopia host fee amount in payment_currency.ethiopia |
| Anywhere else | Global host fee amount in payment_currency.global |

The public create screen shows only the resolved fee for the organizer country. Official cups do not charge a host fee.

### 8.9 Unlimited seats (Arena open enroll)
Classic formats stay on fixed host sizes (seeded 8 / 16 / 32 / 64 / 128 / 256; mig **492**/**493**). Company sizes 128/256 allow knockout, swiss, and groups→knockout (not round robin). Mass open play uses **Arena** with either:

- **null max** (true Unlimited; seats never mark full), or
- a **high max** (safety ceiling above the DB classic seat table).

Admin configures both on Events → Host sizes (Unlimited toggle, Arena-only: empty max or high ceiling only; classic-range max with the toggle on is rejected; mig **490** `err_unlimited_max_high_or_empty`; EventsAdminChrome API requires that key fail-closed with the admin SPA) and on Official tournament create (empty max or high ceiling for Arena only). A typed max under 2 is rejected and never coerced into Unlimited. Community hosts pick the catalog size; create copies that size's max from the database (no client override). API stamps `seat_cap_unlimited` so player seat lines show DB `unlimited_players_label` for null and high ceilings. Classic Official/Community sizes cannot use null or huge max. Catalog seed + heal mig **491** bind Unlimited `allowed_format_ids` to `client_enums.hosted_event_arena_format`.

Full rules: Dama_Competition_Formats_Guide (Unlimited seats).

Full examples and every term spelled out: see Dama_Competition_Formats_Guide.

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
- Competition (Tournaments, Events catalog, Progression / match clock + pause + rated match rewards)
- Product and growth (Ads, Media pool)
- Access and security (Feature flags, RBAC, Telemetry)

Permissions gate every sensitive page. Superadmin usually has all; admin usually has all except RBAC manage unless granted.

---

## 11. Master checklists

Player: Google sign-in; VS-AI; queue pair; invite 60s preset; friend+DM; spectate; KYC paths; wallet top-up; join free cup; Ready; portal pages.
Organizer: Fund wallet; create public and private cups; test each enabled format including Arena Unlimited catalog size (null or high max); Ready and arena; prize path.
Publisher: Fund wallet; create campaign; schedule; analytics move; invoice/receipt.
Admin: Role+permissions; currency/geo; banks; match_clock (incl. pause); Official cup + catalog; flags; receipt/payout review; Telegram Ready if used.

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


---

## 15. Day-in-the-life stories (end to end)

### Story A - New player, first evening
1. Opens web on phone, lands on Play home.
2. Tries Play against computer as guest; learns moves.
3. Signs in with Google when ready for real matches.
4. Completes OTP if the platform asks.
5. Joins Find match; gets paired; plays a rated game with dual clocks.
6. After the game, adds the opponent as a friend and sends a DM.
7. Opens Wallet, tops up with a provider or uploads a bank receipt.
8. Browses Official cups and free-joins one for the weekend.

### Story B - Community organizer weekend cup
1. Funds wallet enough for host fee.
2. Opens Host a tournament, picks knockout, size 8, public Community, entry fee.
3. Pays host fee, shares QR in a chat group.
4. Players join and check in.
5. Organizer Starts; bracket appears; players Ready; boards open with clocks.
6. After final, cup finishes; prizes settle per payout mode; organizer checks Hosting analytics.

### Story C - Groups then knockout cup
1. Admin already set target group size 4 and advance 2 in Events catalog.
2. Organizer creates groups_knockout with 8 players.
3. On Start, server makes two groups of 4 automatically.
4. Players finish all group games.
5. Without a second Start button, top 2 from each group enter knockout.
6. Knockout final decides the champion.

### Story D - Arena evening
1. Organizer starts a 60-minute arena.
2. Players tap Join queue in the cup lobby repeatedly.
3. Worker pairs them; games start; streak points accumulate.
4. Clock ends; standings freeze; top arena points wins.

### Story E - Ads publisher
1. Opens Ads dashboard, creates campaign, pays create fee.
2. Uploads creative, sets schedule and caps, sets status servable.
3. During live matches that pass eligibility, ads can show.
4. Checks analytics next morning; downloads invoice.

### Story F - Admin money ops
1. Opens Admin Receipts; approves a pending manual top-up.
2. Opens Payouts; marks an approved payout as paid.
3. Optionally does the same from Telegram if ops bot is Ready.
4. Checks Progression match clock still enabled with presets.

### Story G - Support ticket: stuck on tournaments AI
User: I clicked Play against computer on tournaments and saw the list, not the board.
Answer: Product rule is leave tournaments browse and show Play home board. Ask them to hard refresh after the fix; confirm URL becomes / without view=tournaments.

### Story H - Support ticket: Stop shows Play chrome unavailable
User: I pressed Stop and saw Play chrome unavailable.
Answer: That string is for missing Play UI labels. Stop failures should show load/stop failed text and return embedded AI to lobby. If the whole Play page shows chrome unavailable, required database play chrome keys are incomplete.

---

## 16. What each app can and cannot do (matrix)

| Capability | Guest web/Flutter | Signed-in player | Organizer | Publisher | Admin | Telegram ops |
|------------|-------------------|------------------|-----------|-----------|-------|--------------|
| VS-AI | Yes if flag on | Yes | Yes | Yes | No play board | No |
| Queue / invites | No | Yes | Yes | Yes | No | No |
| Wallet top-up | No | Yes | Yes | Yes | Review only | Review receipts/payouts |
| Host Community cup | No | Yes if Hosting on | Yes | As player | Catalog/ops | No |
| Create Official cup | No | No | No | No | Yes | No |
| Create ad campaign | No | In Ads shell | In Ads shell | Yes | Runtime override | No |
| Change match_clock / pause | No | No | No | No | Progression | No |
| Approve payout | No | No | No | No | Yes | Yes |

---

## 17. Where labels come from (for non-technical owners)

Almost every button label, empty state, and toast comes from the database (product word: chrome), not from hard-coded English in the apps. That is why:
- Admin can change many strings without a code release.
- If required chrome is missing, screens fail closed and may show unavailable messages.
- Guides in this folder use plain English; live UI text may differ slightly based on what is saved in the database.

---

## 18. Safety and fairness principles (why the product feels strict)

- Server owns game rules, clocks, and money transitions.
- Clients display and request; they do not invent remaining time, balances, or permissions.
- Cash features are fail-closed when policy or KYC is incomplete.
- Guests are intentionally limited so practice never becomes unpaid ranked abuse.
- Dual review lanes (Admin + Telegram) prevent a single stuck inbox, but only one review can win.

---

## 19. Suggested reading order for new staff

1. This Complete App Guide (roles + glossary + stories)
2. Play and Matchmaking Bible
3. Competition Formats Bible
4. Wallet and Compliance Bible
5. Ads and Admin Ops Bible
6. Then practice on staging: guest AI, queue, invite, stop game, free cup Ready, manual receipt approve


