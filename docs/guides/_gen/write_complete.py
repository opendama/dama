# -*- coding: utf-8 -*-
"""Generate Dama_Complete_App_Guide.md - full product bible."""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "Dama_Complete_App_Guide.md"

parts = []

def add(s: str) -> None:
    parts.append(s.rstrip() + "\n\n")

add("""# Dama - Complete App Guide
End-to-End Player, Organizer, Publisher, Admin & Ops Product Bible

This document is the master product bible for Dama. It explains the entire live product for non-technical readers: guests, players, tournament organizers, ad publishers, support staff, platform admins, and Telegram money reviewers. No coding knowledge is required.

Dama is an international draughts (also called dama or international checkers) competition platform. On a 10x10 board with FMJD-style rules (mandatory capture, majority capture, flying kings), people practice against AI, find rated matches, challenge friends, join Official and Community tournaments, host cups, fund a shared wallet, run in-match ads, and complete cash compliance (age, phone, document KYC) from web or Flutter. Platform operators run money review, cups, catalogs, clocks, ads runtime, and access control from a separate Admin Console. An optional Telegram ops bot is a dual money-review lane for receipts and payouts.

## How to use this bible
- Read Section 1 (What Dama is) and Section 2 (Glossary) first so every later word is clear.
- Use Section 3 (Audiences) when you need "what can this person do?"
- Use day-in-the-life stories when training support or onboarding.
- Use companion guides for deep dives: Play & Matchmaking, Competition Formats, Wallet/Payments/Compliance, Ads & Admin Ops.
- Product labels in the live apps come from the database (called chrome). This guide uses plain English that matches product intent. Regular hyphens only (no em dash characters).

## What is included
1. What Dama is and which apps exist
2. Full glossary of product terms
3. Every audience: Who / What / Cannot / When / Why / Where / How
4. Big-picture layers and end-to-end day stories
5. Sign-in (Google only) and guest VS-AI practice
6. Play home, New Game rail, queue, invites, friends, DMs, spectate, chat
7. Match timer dual clocks, flag-fall, reconnect
8. Player portal: wallet, profile, settings
9. Official + Community cups overview
10. Five competition formats overview (companion for deep dive)
11. Ads overview
12. Admin Console map
13. Telegram ops overview
14. Master checklists and troubleshooting FAQ
15. URL reference
""")

add("""# 1. What Dama Is

## Who
Anyone who wants to play competitive international draughts online, host community cups, publish in-match ads, or operate the platform.

## What
Dama is a live competition product, not a single toy board. It includes:
- Casual and rated player-versus-player (PvP) play
- Guest and signed-in practice against an AI engine (VS-AI), when the feature flag is on
- Social graph: friends, direct messages (DMs), game chat
- Spectating public live games, optional win votes for signed-in non-players
- Official (platform-run) tournaments and Community (player-hosted) tournaments
- Five competition formats: knockout, round robin, Swiss, groups + knockout, and arena
- One shared wallet for top-ups, cup fees, prizes, ads create fees, and payouts
- Cash compliance gates (age, phone KYC, document KYC, country allowlists)
- Ads publisher shell for in-match and lobby creatives
- Admin Console for ops
- Optional Telegram dual-actuator money review

## When
Use Dama any time you want a fair, clocked draughts match, a cup, or self-serve advertising into eligible live games. Admins use it during ops shifts.

## Why
One identity (Google), one wallet ledger, one set of format engines for Official and Community cups, and server-authoritative clocks so clients cannot invent time or results.

## Where (apps)
| App | Path in repo | Who uses it | What it is |
|-----|--------------|-------------|------------|
| Web player + ads + hosting | `apps/web` | Guests, players, organizers, publishers | Browser experience: Play home, portal, Hosting `/events/*`, Ads `/ads/*` |
| Flutter mobile | `apps/mobile` | Same audiences on phone | Same product shells with native board and sheets |
| Admin Console | `apps/admin` | Admin / superadmin | Separate Next.js ops app (not nested inside player web) |
| API | `apps/api` | All clients | GraphQL + REST + WebSockets; source of truth with Postgres + Redis |
| Telegram ops | Shared bot bridge | Money reviewers | Approve/reject receipts and payouts from Telegram DMs |

## How (one-sentence product loop)
1. Open Play (web `/` or Flutter Home).
2. Practice as guest VS-AI, or sign in with Google for real PvP and money.
3. Find a match (queue), invite a friend, or join a cup.
4. Server arms dual clocks; you move; optional chat; at 0:00 the server can flag-fall.
5. Top up wallet when needed; enroll or host cups; publishers create campaigns.
6. Admins configure clocks, catalogs, flags; admins or Telegram review money.
""")

add("""# 2. Full Glossary (read this early)

Every technical term below is explained in plain language the first time it appears. Later sections reuse these words without redefining them unless a nuance matters.

| Term | Plain meaning |
|------|---------------|
| Draughts / dama / international checkers | The board game Dama runs (10x10, FMJD-style capture and flying kings). |
| Web player | The browser app players use for Play, portal, Hosting, and Ads. |
| Flutter | The mobile app that mirrors the same player / organizer / publisher shells. |
| Admin Console | Separate ops website for platform staff. |
| JWT / session | After Google sign-in, the app holds a Dama login token (JWT). That token is your session. Without it you are a guest. |
| Guest / practice token | Short-lived login used only for VS-AI practice. Not a full account. Cannot queue, wallet, friends, host, or publish ads. |
| OAuth / Google sign-in | Sign-in with your Google account through Supabase, then exchange for a Dama JWT. No email/password login exists. |
| OTP | One-time passcode gate. When the global OTP feature flag is on, many play and money actions require verifying OTP first. |
| Cash phone OTP | Separate optional gate used only when verifying a phone number for cash compliance. Not the same as global OTP. |
| Feature flag | Admin on/off switch in the database (example: VS-AI on, hosted events on, cash enabled). |
| Chrome / DB labels | All button titles, empty states, toasts, and many URLs come from database settings. Apps fail closed if chrome is missing (they do not invent English). |
| Fail closed | If required settings are missing or invalid, the action stops safely instead of guessing. |
| Wallet | Your money balance inside Dama (one ledger shared by portal, Hosting, and Ads shells). |
| Ledger | The list of wallet money movements (top-up, entry fee, prize, ads create fee, and so on). |
| Currency geo | Server decides ETB (Ethiopia) vs USD (elsewhere) from IP / geo rules. Clients cannot spoof country on the pay chain. |
| Provider / checkout | How you fund the wallet: local checkout (Chapa), manual bank transfer + receipt, or international checkout (Paddle). |
| Manual receipt | Proof of bank transfer you upload; waits for human approve/reject. |
| KYC | Know Your Customer checks: age gate, phone, and optional government ID document + selfie for payouts. |
| Document KYC | Upload ID front, ID back when required, selfie, legal name, document type; admin approves. |
| Payout | Request to withdraw wallet funds; admin or Telegram must approve, then mark paid. |
| Dual-actuator | Console and Telegram can both review the same receipt/payout; the first successful action wins; the second gets a conflict. |
| Official cup / Official tournament | Platform-created competition run by Admin Console. |
| Community cup / Hosting | Player-created competition from the Hosting shell (`/events/*`). |
| Tournament hub | Unified browse at `/?view=tournaments` with Official \| Community \| All. |
| Host fee | Wallet fee the organizer pays when creating a Community cup. Not part of the prize pot. |
| Entry fee | What a player pays to join a paid cup; platform takes commission; organizer gets net. |
| Prize pool / guarantee | Displayed pot from entry nets (+ optional organizer guarantee hold). Free cups have pot UI forced off. |
| Escrow / settle | After a paid cup finishes, prizes wait a dispute window, then credit winners' wallets. |
| Knockout (KO) | Lose once and you are out; bracket with byes. |
| Round robin (RR) | Everyone plays everyone; highest standings points wins. |
| Swiss | Fixed rounds from catalog; pair by points each round. |
| Groups + knockout | Group round robins, then auto-promote top players into a knockout. |
| Arena | Timed continuous cup queue; winner by arena points when the clock ends. |
| Ready | Both seats confirm before a cup board game starts (classic formats). |
| Check-in | Confirm presence before Start so only checked-in players seed classic brackets. |
| Queue (matchmaking) | Global Find Match waiting list; always rated; no accept dialog. |
| Invite / challenge | Named or open-link challenge with chosen time preset / rated / color; game starts only on accept. |
| Rated | Match counts toward career rating / Hall of Fame rated wins. Queue is always rated; invites choose; cups follow public-rated flag rules. |
| Unrated | Invite option that does not count as rated career. |
| Flag-fall | You lose when your active clock reaches 0:00 and the server confirms. |
| Dual clocks / match clock | Two server clocks, one per seat; only the side to move loses time. |
| Increment (Fischer) | Extra seconds added to the mover after a completed ply when configured. |
| Preset | Allowed time-control lengths (seconds) stored in the database. Invites must use a preset. |
| Spectate / Watch | View a live public board without sitting at a seat. |
| Vote | Signed-in spectators (not seated players) pick who they think will win. |
| Presence Online / Playing | Green = online; red = currently in a game; muted = offline. |
| Friends request | Pending social connection until accept/deny/cancel. |
| DM | Direct message thread after a DM request is accepted. |
| Game chat | Per-game text/emoji/image chat for seated players and joined spectators. |
| Outbox | Local queue that retries chat/DM sends so a flaky network does not lose messages. |
| Abandon / Stop game | Resign the seat; opponent wins per server rules. |
| Ads publisher | User who creates campaigns in the Ads shell. |
| Campaign create fee | Wallet fee to create an ad campaign (Ethiopia vs global amounts in database). |
| CPC / impression | Delivery and cost metrics for ads; impression unit cost from Progression pricing. |
| Servable | Campaign status that allows delivery when schedule and caps also allow. |
| Placement | Where an ad can show: lobby or in-match (database keys only). |
| Auto-closed | Campaign closed by the ends_at worker; cannot reopen. |
| RBAC | Role-based access control: console role plus permission keys on each admin page. |
| Superadmin | Console role that typically holds all permissions including RBAC manage. |
| Console role | `admin` or `superadmin` on a user; required to use Admin Console pages. |
| Telegram ops | Optional bot that notifies reviewers and lets them approve/reject money items in Telegram. |
| Progress / Progression | Admin area for XP ladder, match clock, board rules, and ad pricing. |
| Hall of Fame / leaderboard | Period ranked wins (rated) and rating ladder surfaces. |
| Portal | Signed-in ops area: Overview, Profile, Wallet, Transactions, Receipts, Settings, Ads entry. Separate from Play rail. |
""")

add("""# 3. Every Audience - Who / What / Cannot / When / Why / Where / How

## 3.1 Guest (practice visitor)

### Who
Anyone who has not completed Google sign-in and does not hold a full Dama account JWT.

### What they can do
- Open Play home (web `/`, Flutter Home).
- Start VS-AI practice when the VS-AI feature flag is on (app may mint a guest practice token).
- Browse live Games and open Spectate on public PvP matches.
- Browse the Tournaments hub for discovery (Official / Community / All).
- View leaderboard / Status, public player profiles, and legal pages (Privacy, Terms, Refunds).

### What they cannot do
- Join the global matchmaking queue or send/accept challenges.
- Use friends, DMs, wallet, KYC, or payouts.
- Enroll, check in, Ready, host cups, or publish ads.
- Cast spectator win votes that require sign-in.
- Start non-AI games (guest practice is VS-AI only).

### When
First visit, try-before-account, or opening a shared public spectate link.

### Why
Low-friction board experience without money or identity risk.

### Where
Play shell only. Portal money routes stay out of guest bottom nav.

### How - VS-AI example
1. Open `https://your-dama-host/` (or Flutter Home).
2. On New Game, open the AI tab.
3. Pick an allowed search depth from the feature-flag allow-list.
4. Start. If unsigned, the app creates a guest practice session.
5. Play until board win, Stop/abandon, or flag-fall when clocks are enabled.
6. When ready for real PvP, tap Sign in with Google.

---

## 3.2 Signed-in Player

### Who
Default account after Google sign-in and Dama JWT exchange.

### What they can do
- Full play: queue, invites, VS-AI, resume live boards, match history.
- Friends, requests, DMs, game chat, notifications bell.
- Spectate and cast votes (when not seated).
- Portal: Overview, Profile, Wallet, Transactions, Receipts, Settings.
- Enroll in Official cups; join Community cups; become a Hosting organizer or Ads publisher from the same account.

### What they cannot do
- Open Admin Console without a console role + permissions.
- Edit global catalogs, clocks, or feature flags.
- Bypass OTP or cash gates when those flags require them.
- Spoof payment country from the client.

### When
Everyday rated and casual play, social, money, and competition.

### Why
One identity for rated career, social graph, and compliance.

### Where
Play `/`; portal `/dashboard`, `/profile`, `/wallet`, `/transactions`, `/receipts`, `/settings`; Flutter mirrors.

### How - first day example
1. Sign in with Google from Play.
2. Complete OTP if the platform requires it.
3. Join Find Match once; play a rated game with default clocks.
4. Add a friend; send a DM; challenge them with a 3-minute preset.
5. Open Wallet; top up if your market needs money for cups.
6. Open Tournaments hub; join a free Official or Community cup.

---

## 3.3 Official Cup Player

### Who
Signed-in player enrolled in an admin-created Official tournament.

### What
Same play tools, plus check-in, Ready (classic), arena queue (arena format), bracket/standings views, prize settlement to wallet, report CTA.

### Cannot
Create or start Official cups (admin only). Change catalog fees. Settle prizes themselves.

### When
During enroll, check-in, live, dispute, and settle windows.

### Why
Fair platform-run ladder of cups with shared format engines.

### Where
Tournaments hub Official tab `/?view=tournaments`; cup lobby `/?view=tournaments&id={id}`; live board `/?gameId=`.

### How
1. Open Official tab; free Join or paid Enroll (wallet).
2. Wait for admin Start; check in when the window opens (classic).
3. Classic: find your match -> Ready when both seats ready -> board starts.
4. Arena: join cup queue; play until arena ends.
5. After finish, wait dispute window; prizes credit wallet when you place and settle runs.

---

## 3.4 Community Participant

### Who
Signed-in joiner of someone else's hosted cup (public Community list or private join code / QR / invite link).

### What
Join (auto-approved), pay entry if required, check-in, Ready or arena queue, play, view results, report issues.

### Cannot
Edit the organizer's cup settings. Access private cup details without being organizer or approved entry. See private bracket games on the public Watch rail.

### When
After receiving an invite or browsing Community cups (when public events are enabled).

### Why
Play community competitions without running them.

### Where
`/?view=tournaments&source=community` or invite `/?view=tournaments&source=community&code=...`.

### How
1. Open Community or paste invite.
2. Join / pay entry (OTP and cash gates when required).
3. Check in -> Ready -> play (or arena queue).
4. Share result card when the organizer publishes results; report if needed.

---

## 3.5 Hosting Organizer

### Who
Signed-in player who creates Community tournaments when hosted events are enabled.

### What
Create from catalog size/format; set public/private, entry fee, payout mode, branding; pay host fee (+ optional prize guarantee); share link/QR; kick before live; Start; manage Ready/arena finish; close/reopen when allowed; view dashboard KPIs and nested Hosting wallet.

### Cannot
Edit global Events catalog (sizes, Swiss rounds map, groups size/advance). Run Official cups. Bypass cash/OTP when required. Invent formats not enabled in catalog.

### When
After wallet can cover host fee (and guarantee if used).

### Why
Run your own competitions for friends or the public.

### Where
Hosting `/events/dashboard`, `/events/events`, `/events/analytics`, create via Host CTA `/events/events?create=1`.

### How - example private 8-player knockout
1. Fund wallet.
2. Host a tournament -> size 8, format knockout, visibility private, entry free or paid.
3. Pay host fee; copy invite link / download QR.
4. When 8 joined (and checked in if classic), Start.
5. Players Ready through bracket; you can force-start/forfeit/rematch when product allows.
6. Close/finish; review analytics.

---

## 3.6 Ads Publisher

### Who
Signed-in user of the Ads shell (publisher / advertiser role path).

### What
Create campaigns (pay geo create fee), upload creatives, set schedule/caps/status, measure analytics, use nested Ads wallet/receipts/transactions/payout.

### Cannot
Change global ad playback defaults (admin). Force serve when geo/caps/schedule fail. Reopen an auto-closed campaign. Invent placement keys client-side.

### When
After wallet funds cover create fee and creatives are ready.

### Why
Self-serve advertising into eligible lobby and in-match surfaces.

### Where
`/ads/dashboard`, `/ads/campaigns`, `/ads/analytics`, `/ads/wallet`, `/ads/receipts`, `/ads/transactions` (Flutter Publisher shell).

### How
1. Open Ads dashboard; ensure wallet balance.
2. Create campaign with title, creative type, map pin / geo targets, required daily spend cap (>0; separate from create fee), optional ends_at.
3. Pay create fee; attach creative; enable schedule; set servable status.
4. Confirm impressions move on eligible matches; download invoice/receipt as needed.
5. Close when done.

---

## 3.7 Platform Admin / Superadmin

### Who
Operators with console role `admin` or `superadmin` plus RBAC permissions on each leaf.

### What
Users/avatars; currency/geo/KYC/payouts/receipts/transactions/banks/Telegram ops; Official tournaments; Hosting catalog/reports; Progression (clocks, ad pricing); Ads runtime/campaigns; Media pool; Feature flags; RBAC (usually superadmin); Telemetry; Activity analytics.

### Cannot
Act without the matching permission (UI and API both gate). Invent chrome when settings are incomplete. Bypass dual-actuator conflicts after Telegram already reviewed an item.

### When
Ops shifts for money, cups, abuse, and configuration.

### Why
Operate Dama safely with fail-closed permissions and database-backed policy.

### Where
Separate Admin app: `/dashboard`, `/users`, `/payments/*`, `/tournaments`, `/events`, `/progression`, `/ads`, `/feature-flags`, `/rbac`, `/telemetry`, `/activity`.

### How - morning money shift example
1. Sign in to Admin Console with Google.
2. Clear pending Receipts and Payouts.
3. Check Document KYC queue.
4. Skim Official cups and hosted reports.
5. Confirm feature flags for the market; confirm Telegram ops Ready if used.

---

## 3.8 Telegram Ops Reviewer

### Who
Telegram admin IDs configured for the Dama ops bot, with bridge Ready in Admin -> Sales -> Telegram ops.

### What
From Telegram DMs: list pending receipts; approve/reject (reject needs reason -> review note); list pending/approved-unpaid payouts; approve/reject/mark paid. Same money transitions as console.

### Cannot
Replace the full Admin Console. Review ads campaigns or Document KYC in Telegram (those stay in console). Act when bot is not Ready or TELEGRAM_ADMIN_IDS is empty. Double-apply after console already reviewed (409 conflict).

### When
Mobile ops while receipts/payouts are pending and the bridge is enabled.

### Why
Dual-actuator money lane without opening the full console.

### Where
Telegram DMs; config at Admin `/payments/telegram-ops`.

### How
1. Admin enables bridge (URL, API key, reviewer user id, notify timeout).
2. Player submits receipt or payout.
3. Bot notifies Telegram admins.
4. Reviewer taps approve/reject/mark paid.
5. Wallet/status updates; console shows the same result.
""")

add("""# 4. Big Picture - Layers and Day-in-the-Life Stories

## 4.1 Layers that share one backend
- Play home - board + New Game / Games / Players rail
- Player portal - Overview / Profile / Wallet / Transactions / Receipts / Settings / Ads entry
- Tournaments hub - Official | Community | All + cup lobbies
- Hosting shell - organizer create/start/analytics under `/events/*`
- Ads shell - publisher dashboard/campaigns/analytics under `/ads/*`
- Admin Console - separate ops app
- Telegram ops - optional receipt/payout DM lane

All clients talk to the same API (GraphQL for dashboards, REST for money/uploads, WebSockets for live moves/queue/spectate).

## 4.2 Story A - Guest becomes a rated player (same evening)
1. Sara opens Dama on her phone (Flutter) and tries VS-AI depth 4.
2. She spectates a public live game from Games -> Watch.
3. She signs in with Google; lands back on Play.
4. She joins Find Match; pairs with another queued player; dual clocks start.
5. She loses on the board, then challenges a friend with a 10-minute rated invite.
6. Friend accepts; they play; Sara opens portal Overview to see recent matches.

## 4.3 Story B - Weekend Community cup
1. Organizer Abel funds wallet and Hosts a public 16-player Swiss cup with a small entry fee.
2. He shares the Community invite link in a chat group.
3. Twelve players join and pay; Abel waits for min players; everyone checks in.
4. Abel Starts; Swiss round 1 pairings appear; both seats Ready; boards open with clocks.
5. After all rounds, prize escrow opens; after dispute window, winners see wallet credits.
6. Abel checks Hosting analytics (gross entry, commission, net).

## 4.4 Story C - Manual top-up + Telegram approve
1. Player in Ethiopia (or local dev treated as domestic) opens Wallet -> Add funds.
2. Route resolves to manual_transfer; banks list appears; player transfers offline.
3. Player uploads receipt; status pending.
4. Telegram ops reviewer gets `dama_receipt_pending`, opens detail, approves.
5. Player wallet credits; notification deep-links to receipts/transactions.
6. If an admin later tries to approve again, they get a conflict (already reviewed).

## 4.5 Story D - Publisher launches in-match ads
1. Publisher Mira tops up wallet and opens `/ads/campaigns`.
2. She creates a campaign, drops a map pin in Addis Ababa, pays Ethiopia create fee (ETB).
3. She uploads creative, enables schedule (first show 60s default unless overridden), sets daily impression cap, sets servable status.
4. Eligible live matches show the overlay after eligibility passes; impressions record with placement `in_match`.
5. Mira watches CTR/CPC on Analytics; closes the campaign when budget is done.

## 4.6 Story E - Admin go-live morning
1. Superadmin confirms Currency (USD + ETB) and Geo routing domestic country.
2. Banks saved for manual transfer; Progression match_clock presets include 60/180/600/1800.
3. Events catalog enables all five formats; Swiss map and groups defaults set.
4. Feature flags: VS-AI on, hosted events on, cash on for allowed countries.
5. Smoke: two accounts queue; one invite; one manual receipt approve; one Official cup enroll.
""")

add("""# 5. Sign-in (Google Only) and Session Basics

## Who
Everyone who needs PvP, money, hosting, ads, or admin.

## What
Google via Supabase Auth (PKCE) only. After Google finishes, the app exchanges the Supabase access token at the Dama API for a Dama JWT. Email/password register and login do not exist.

## When
Before any real account action. Casual sign-in preserves the page you were on (including `?view=` play context). Default return for plain login is Play home `/`. Overview `/dashboard` is opened from the signed-in menu, not forced as OAuth next.

## Why
One trusted identity for play, social, and compliance. Brand-new identities are checked against email domain denylist before account creation.

## Where
- Web: Sign-in modal / `SignInLink`; `/auth/login` opens modal on home shell; quiet shimmer at `/auth/oauth/complete`
- Flutter: Sign-in dialog
- Admin: Admin login chrome paths from database `auth_providers`

## How
1. Tap Sign in with Google (label from database auth providers).
2. Complete Google consent.
3. App lands on OAuth callback, then `/auth/oauth/complete` shimmer while exchanging tokens.
4. Dama JWT is stored; auth-scoped queries load your me profile.
5. If unauthorized later (401), JWT clears and you bounce to login with an unauthorized error toast from chrome.

## Guest vs signed-in contrast
| Topic | Guest | Signed-in |
|-------|-------|-----------|
| Token | Practice guest JWT | Full account JWT |
| VS-AI | Yes if flagged | Yes if flagged |
| Queue / invites | No | Yes |
| Wallet | No | Yes |
| OTP | N/A on guest practice path | Applies when global OTP flag on |

## OTP (when enabled)
Global OTP can gate: matchmaking join, invite create/accept, moves, abandon, enroll, host create/join, checkout, receipt submit, payouts. Cash phone OTP is separate and only for phone KYC when that flag is on.
""")

add("""# 6. Play Home, New Game, Queue, Invites, Friends, DMs, Spectate, Chat

Deep dive companion: `Dama_Play_And_Matchmaking_Guide.md`. This section is the complete-guide map.

## 6.1 Play home layout
Who: Guests and players
What: Chess.com-style shell - board center; right rail New Game | Games | Players; desktop left nav from client_nav; bottom nav on mobile web
When: Default landing
Why: One place to start or resume play
Where: Web `/` (legacy `/play` redirects here); Flutter Home

Center board
- Lobby preview or live session
- Opponent seat above, you below (desktop); clocks when armed
- 2D/3D toggle; optimistic moves; AI thinking indicator; confetti on win when signed in

## 6.2 New Game rail
- AI tab: depth + start
- Challenge / Create Game: opponent typeahead or open link; time preset; rated toggle; color white/black/random
- Link to Find Match / matchmaking center `/?view=match`
- Tournaments hub opens as center view `/?view=tournaments` (not a fourth rail tab)

## 6.3 Global queue (Find Match)
Who: Signed-in only
What: Single global FIFO queue; always rated; default platform time control; no accept dialog; no rating bands
Where: `/?view=match` or legacy `/matchmaking`
How:
1. Join queue (OTP if required).
2. Wait; queue size may show.
3. Second joiner pairs immediately; both get match_found.
4. Open `/?gameId=...&mode=pvp`.
5. Leave queue if still waiting.

## 6.4 Invites and open challenges
Who: Signed-in sender and recipient
What: Pending invite until accept; game created only on accept; sender picks rated, color, preset seconds
Where: New Game Challenge; matchmaking direct invite; profile/hover Challenge; open link `/?challenge={token}`
How:
1. Create invite (or open link).
2. Recipient accepts/declines (UI dialog, REST, or matchmaking websocket).
3. On accept, navigate to game.
4. Cancel/expire uses invite TTL from match_clock settings.

## 6.5 Games rail - Watch and History
- Watch: public unfinished PvP live list (excludes AI and private hosted bracket games); search; spectator counts; open spectate
- History: your matches; resume live with `/?gameId=&mode=`

## 6.6 Spectate and votes
Where: `/?view=spectate&gameId=`
What: Board, clocks (read-only), move scrub, activity panel, optional chat
Votes: signed-in non-seated spectators cast one predicted winner; tallies public; after finish, correct voters sample may show
Private Community cup games: only organizer or approved entry may spectate

## 6.7 Players rail - Friends, Requests, DMs, All
- Server search with debounce (not local-only filter)
- Friend request accept/deny/cancel; notifications deep-link to Requests/Friends
- DMs: request -> accept -> thread; text/emoji/images; reactions; read receipts (single check until peer seen, then double check brand); durable outbox
- Presence: Online / Playing / Offline dots
- Message and Challenge CTAs from hover cards and profiles `/players/{id}`

## 6.8 Game chat
Per game_id; seated + joined spectators; seated can disable; newest 100 messages per fetch; images allowlisted; tournament boards reuse the same chat (no separate tournament room).

## 6.9 Stop / abandon
Stop game resigns your seat; opponent wins; OTP may apply; finished games cannot abandon again.
""")

add("""# 7. Match Timer - Dual Clocks, Flag-fall, Reconnect

## Who
Seated players in clock-armed games; spectators see clocks but cannot claim flag; admins configure platform defaults on Progression.

## What
Two real clocks (one per seat). Only the side to move loses time. Server is the only authority. Clients display smooth interpolated time between server snapshots.

## When
Armed at game create when `match_clock` is enabled: StartGame, queue pair, accepted invite (may use invite preset), tournament/hosted/arena starts.

## Why
Fair flag-fall. Refresh must not reset clocks to full. Spectators must not burn your time.

## Where
Live board web + Flutter; Admin Progression edits enabled / initial_seconds / increment / invite TTL / presets list (read-only list in UI; presets preserved on save).

## How it works
1. Admin sets enabled, default initial seconds (must match a preset), increment seconds, invite TTL, presets.
2. On create, server arms both seats.
3. On each move, server checks correct seat, then debits active clock, applies move, may grant increment.
4. Background sweeper (~2s) walks active clock games (PvP and VS-AI armed).
5. Game state fetch syncs debit when time advanced; reconnect never rewinds.
6. At local 0:00, seated client sends clock_flag (websocket, REST fallback).
7. Server confirms ForcedOutcome with end_reason clock_flag (decisive win + points), or rejects if time remains. Bare king vs bare king may end clock_draw with draw_reason insufficient_material.
8. Seated UI uses DB you_*_on_time_message (Won/Lost/Drew on time), never generic You won - including board status/seat hints during the short land-animation grace before the finished overlay (turn hints stay off while clock-owned). Clients never invent a board-wipe winner over clock_flag/clock_draw. Spectate uses status_*_on_time (fail-closed if outcome delayed); play-rail has on-time aria. Finalize is single-flight so career/arena points apply once.

## Support truths
- Hitting 0:00 on your phone alone is not enough; server must confirm.
- Queue uses default initial_seconds; invite uses selected preset (they can differ).
- Watch rail still excludes AI games even though VS-AI clocks can be armed.
""")

add("""# 8. Player Portal - Profile, Wallet, Settings

## Who
Signed-in players

## What
Ops hub separate from Play: Overview KPIs + recent matches; Profile; Wallet; Transactions; Receipts; Settings; Ads entry. Portal left rail is ops-only (no Play/Matchmaking public menus).

## When
Manage money, identity, history, compliance, ads entry.

## Why
Keep Play focused on the board.

## Where
Web `/dashboard`, `/profile`, `/wallet`, `/transactions`, `/receipts`, `/settings`; Flutter DashboardPage and portal routes; Hosting and Ads nest the same wallet stack under `/events/*` and `/ads/*`.

## Wallet top-up How
1. Open Wallet.
2. Server geo chooses route: Ethiopia local_checkout (Chapa) or manual_transfer; elsewhere international_checkout (Paddle).
3. Provider: follow checkout URL. Manual: see banks, transfer offline, upload receipt.
4. Manual stays pending until admin or Telegram approves.
5. Balance updates; Transactions/Receipts show history; PDF download/print available on web; Flutter shares PDF.

## KYC How
1. Age gate 18+ when cash policy requires.
2. Phone KYC (immediate verify if cash phone OTP off; OTP challenge if on).
3. Document KYC when required for payout: ID photos + selfie + legal name + type; submit for admin review.
4. Cash/RMG kill switch or country lists can block paid enroll, top-up, payout.

## Payout How
1. Save payout method with primary phone (length 8).
2. Pass cash + document KYC if required.
3. Request payout (wallet debits to pending).
4. Admin/Telegram approve -> mark paid; reject refunds wallet.

## Settings
Document/cash panels, account export/delete, theme, sign out.
""")

add("""# 9. Official + Community Cups Overview

Deep dive: `Dama_Competition_Formats_Guide.md`.

## Shared idea
Official and Community cups reuse the same five format engines. Discovery is one Tournaments hub with Official | Community | All. Player-facing word is Tournament; Hosting is the organizer brand for Community create/manage.

## Official
- Created and started by Admin Console (`tournaments.write`)
- Players enroll free (Join) or paid (Enroll + wallet)
- Career rating on boards follows `public_event_matches_rated` flag
- Admin force tools and arena finish on console

## Community / Hosting
- Created by organizers; catalog is admin-owned (enabled formats only)
- Public lists under Community when `public_events_enabled`; private = code/link/QR only
- Host fee at create; entry commission split on paid joins
- Private never rated; public rated only if flag on
- Join always auto-approved
- Private bracket games hidden from public Watch and gated for spectate/chat/votes

## Money touchpoints
Host fee, entry fee + commission, optional prize guarantee, freeze pot (classic at Start; arena often at finish), escrow, dispute window, settle to wallet. Open reports block settle.

## Player How (both)
1. Hub -> pick Official or Community (or open invite).
2. Join/enroll.
3. Cup lobby `/?view=tournaments&id=`.
4. Check-in (classic) -> Ready -> board, or arena queue.
5. Await results and prize credit.
""")

add("""# 10. Five Formats Overview

Companion guide has numeric examples and organizer/admin steps. Summary:

| Format | Idea | Who sets special rules |
|--------|------|------------------------|
| Knockout | Lose once out; pad to power of 2; byes | Catalog size/min players |
| Round robin | All play all; standings points | Catalog size; admin standings win/draw points |
| Swiss | Fixed rounds by max players map | Admin Swiss rounds map only |
| Groups + KO | Group RRs then auto promote to KO | Admin target group size + advance per group (organizer does not set) |
| Arena | Timed continuous queue; arena points + streaks | Admin arena settings; organizer may set duration on cup |

Classic draws rematch. Ready-timeout can forfeit no-shows. Arena draws award points (not rematch). Payout modes: places_percent, score_share, dual_purse.
""")

add("""# 11. Ads Overview

Deep dive: `Dama_Ads_And_Admin_Ops_Guide.md`.

## Who / What / Where
Publishers use Ads shell create -> configure schedule/caps -> manage status -> measure analytics. Admins set global playback and can override campaigns. Players may see lobby geo ads and in-match overlays when eligibility passes.

## Money
Campaign create fee (Ethiopia vs global), impression unit cost, required daily spend cap (>0), shared wallet.

## Delivery rules (plain)
Servable status + schedule enabled + geo match + first-show delay + repeat interval + period impression caps + spend cap. Period cap exhausted waits until next UTC period boundary. Skip locked during non-skippable seconds. ends_at worker can auto_close (no reopen).
""")

add("""# 12. Admin Console Map

Deep dive permissions and daily ops: `Dama_Ads_And_Admin_Ops_Guide.md`.

| Section | Leaves (typical) | Purpose |
|---------|------------------|---------|
| Overview | Dashboard, Activity | Live pulse KPIs; DAU/WAU/MAU style analytics |
| Customers | Users, Avatars | Search users, roles/active; moderate avatars |
| Sales and revenue | Currency, Geo routing, Document KYC, Payouts, Receipts, Transactions, Banks, Telegram ops | Money policy and review |
| Competition | Tournaments, Events, Progression | Official cups; Hosting catalog/reports; clocks + ad pricing |
| Product and growth | Ads runtime, Media pool | Playback policy + campaign overrides; creative pool |
| Access and security | Feature flags, RBAC, Telemetry | Toggles; permissions matrix; fingerprints/geo/audit |

Console roles: `admin`, `superadmin`. Every sensitive route also needs a permission key (examples: `payments.review`, `tournaments.write`, `events.manage_catalog`, `progression.write`, `ads.manage_runtime`, `ads.manage_campaigns`, `feature_flags.write`, `rbac.manage`, `activity.read`, `telemetry.read`). Default seed: superadmin all; admin all except `rbac.manage`.
""")

add("""# 13. Telegram Ops Overview

Who: configured Telegram admins
What: receipt and payout review only
When: bridge Ready
Why: mobile dual-actuator
Where: Telegram + Admin Telegram ops page
How: notify on submit -> approve/reject/mark paid -> wallet updates; 409 if already reviewed
Cannot: replace console; review KYC/ads in Telegram; reject without reason
""")

add("""# 14. Master Checklists

## 14.1 Player go-live
1. Google sign-in on web and Flutter.
2. VS-AI as guest and signed-in.
3. Queue once; confirm match_found and clocks.
4. Send/accept invite with a short preset (example 60s).
5. Friend request + DM + image send.
6. Spectate public game; cast a vote while not seated.
7. Complete age/phone/document KYC paths your market needs.
8. Top up (provider and/or manual receipt).
9. Join free cup; check-in; Ready; play.
10. Open Overview, Transactions, Receipts, Settings.

## 14.2 Organizer go-live
1. Fund wallet for host fee (+ guarantee if testing).
2. Create public and private Community cups.
3. Start each enabled format once in staging.
4. Confirm Ready auto-start and arena pairing.
5. Confirm payout mode and settlement path.

## 14.3 Publisher go-live
1. Fund wallet; create campaign; pay create fee.
2. Creative + schedule + servable.
3. Confirm analytics on eligible matches.
4. Invoice/receipt PDF path.

## 14.4 Admin go-live
1. Console role + permissions.
2. Currency + geo payment.
3. Banks for manual top-up.
4. Progression match_clock presets/default/increment/invite TTL.
5. Official cup + Hosting catalog (sizes, formats, fees, Swiss map, groups rules).
6. Feature flags for market.
7. Receipt/payout review (console + Telegram if used).
8. Activity + Telemetry load; Ads runtime defaults.

## 14.5 Telegram Ready checklist
1. Enable telegram_ops_bot in Admin.
2. bot_service_url, bot_api_key, reviewer_user_id, notify_timeout_ms > 0.
3. TELEGRAM_ADMIN_IDS on bot worker.
4. Public DAMA_API_BASE_URL + DAMA_BOT_API_KEY on worker.
5. Submit test receipt -> Telegram notify -> approve -> wallet credit.
6. Confirm second review conflicts.
7. Test payout approve/reject/mark paid.
""")

add("""# 15. Troubleshooting FAQ

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| Cannot join queue | Guest, OTP, or auth | Signed-in? OTP verified? |
| VS-AI missing | Flag off | Feature flag VS-AI / depths |
| Invite TC error | Seconds not in presets | Progression presets |
| Clock hit 0 but game continues | Waiting for server flag | Sweeper / claim path |
| Clock reset after refresh | Should not happen | Report if remaining rewound |
| Queue TC differs from invite | Different sources | Default vs preset |
| Manual top-up shows nothing | Product bug if no banks UI | Must show banks + receipt step |
| Receipt pending forever | Awaiting human review | Console or Telegram |
| Cannot payout | Phone method, doc KYC, cash gates, country, age, locate | Settings + Wallet eligibility |
| Paid entry but not in cup | Payment vs enroll failure; wrong Official/Community id | Transactions + cup lobby |
| Cannot spectate private cup | Authz | Organizer or entrant only |
| Ads not showing | Not servable, schedule off, geo/cap/interval | Campaign + eligibility |
| Cannot reopen campaign | auto_closed | Expected after ends_at worker |
| Telegram silent | Not Ready / no admin IDs | Telegram ops checklist |
| Admin page blank / forbidden | Missing permission or chrome | RBAC grants + role |
| Sign-in loop | OAuth path mismatch | auth_providers vs app path env |
| Community invite opens OAuth | Middleware mistaking code | Invite uses tournaments Community code path; OAuth code only on auth routes |

## Support checklist (any play ticket)
1. Guest vs signed-in?
2. Feature flags: VS-AI, OTP, hosted, public, cash?
3. Match clock enabled + presets?
4. Reproduce with two accounts (queue) and one invite accept.
5. Money: which route (manual/Chapa/Paddle) and which shell (player/events/ads)?
""")

add("""# 16. URL Reference

Menu titles and some hrefs come from `GET /platform/client-nav` and Admin `console_nav`. Prefer these canonical player paths:

| Intent | Path |
|--------|------|
| Play home | `/` |
| Live PvP resume | `/?gameId={id}&mode=pvp` |
| Spectate | `/?view=spectate&gameId={id}` |
| Matchmaking | `/?view=match` (legacy `/matchmaking`) |
| Leaderboard | `/?view=leaderboard` |
| Platform stats | `/?view=status` |
| Tournaments hub | `/?view=tournaments` |
| Community invite | `/?view=tournaments&source=community&code=` |
| Official/Community lobby | `/?view=tournaments&id=` |
| Open challenge | `/?challenge={token}` |
| Players rail deep link | `/?rail=players&sub=friends\|requests\|dms\|all` |
| Portal overview | `/dashboard` |
| Profile / Wallet / Transactions / Receipts / Settings | `/profile`, `/wallet`, `/transactions`, `/receipts`, `/settings` |
| Public profile | `/players/{id}` |
| Hosting | `/events/dashboard`, `/events/events`, `/events/analytics`, `/events/join` |
| Host create | `/events/events?create=1` |
| Ads | `/ads/dashboard`, `/ads/campaigns`, `/ads/analytics`, `/ads/wallet` |
| Receipt detail | `/receipts/{id}` (also under `/events/receipts/{id}`, `/ads/receipts/{id}`) |
| Auth complete | `/auth/oauth/complete` |

Admin examples: `/dashboard`, `/activity`, `/users`, `/payments/receipts`, `/payments/payouts`, `/payments/kyc`, `/payments/telegram-ops`, `/tournaments`, `/events`, `/progression`, `/ads`, `/media-pool`, `/feature-flags`, `/rbac`, `/telemetry`, `/banks`.

## Legacy redirects (still work)
`/play` -> `/`; `/spectate` -> `/?view=spectate`; `/tournaments` -> hub; `/?view=events` and `/events/public` -> Community tab.
""")

add("""# 17. Related Companion Bibles
- [Dama_Play_And_Matchmaking_Guide.md](./Dama_Play_And_Matchmaking_Guide.md) - every play path, timer, social, stop game, troubleshooting
- [Dama_Competition_Formats_Guide.md](./Dama_Competition_Formats_Guide.md) - knockout, RR, Swiss, groups+KO, arena with numeric examples
- [Dama_Wallet_Payments_And_Compliance_Guide.md](./Dama_Wallet_Payments_And_Compliance_Guide.md) - geo, providers, receipts, KYC, payouts, Telegram, cup/ads money
- [Dama_Ads_And_Admin_Ops_Guide.md](./Dama_Ads_And_Admin_Ops_Guide.md) - publisher lifecycle + full admin sections + daily ops

# 18. Accuracy Note
This bible describes the current Dama product as implemented across web, Flutter, Admin Console, API, and Telegram ops. It does not invent features. When a live label differs, trust database chrome. For architecture-level contracts see `docs/architecture.md` and `docs/ops-rbac-and-ads-runtime.md`.
""")

text = "".join(parts)
# Guard: no em dash
if "\u2014" in text:
    raise SystemExit("em dash found")
OUT.write_text(text, encoding="utf-8")
print(f"Wrote {OUT} bytes={OUT.stat().st_size}")