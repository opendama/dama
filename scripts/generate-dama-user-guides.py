#!/usr/bin/env python3
"""Generate Dama end-user guides (Markdown + DOCX) into docs/guides/.

Style mirrors Smart Menu Complete App Guide: Who / What / When / Why / Where / How.
No em dash characters.
"""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_LINE_SPACING
from docx.shared import Pt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "guides"
DOWNLOADS = OUT / "downloads"


def no_em(s: str) -> str:
    return (
        s.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def md_to_blocks(md: str) -> list[tuple[str, str]]:
    """Parse simple markdown into (kind, text) blocks."""
    blocks: list[tuple[str, str]] = []
    lines = no_em(md).replace("\r\n", "\n").split("\n")
    i = 0
    para: list[str] = []
    table_buf: list[str] = []

    def flush_para() -> None:
        nonlocal para
        if para:
            blocks.append(("p", " ".join(para).strip()))
            para = []

    def flush_table() -> None:
        nonlocal table_buf
        if table_buf:
            blocks.append(("table", "\n".join(table_buf)))
            table_buf = []

    while i < len(lines):
        line = lines[i]
        raw = line.rstrip()
        if not raw.strip():
            flush_para()
            flush_table()
            i += 1
            continue
        if raw.lstrip().startswith("|"):
            flush_para()
            table_buf.append(raw)
            i += 1
            continue
        flush_table()
        if raw.startswith("# "):
            flush_para()
            blocks.append(("h1", raw[2:].strip()))
        elif raw.startswith("## "):
            flush_para()
            blocks.append(("h2", raw[3:].strip()))
        elif raw.startswith("### "):
            flush_para()
            blocks.append(("h3", raw[4:].strip()))
        elif raw.startswith("- "):
            flush_para()
            blocks.append(("li", raw[2:].strip()))
        elif raw.startswith(tuple(f"{n}. " for n in range(1, 40))):
            flush_para()
            # numbered list
            dot = raw.find(". ")
            blocks.append(("li", raw[dot + 2 :].strip()))
        else:
            para.append(raw.strip())
        i += 1
    flush_para()
    flush_table()
    return blocks


def write_markdown(name: str, body: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.md"
    path.write_text(no_em(body).strip() + "\n", encoding="utf-8")
    return path


def write_docx(name: str, body: str) -> Path:
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    pf = style.paragraph_format
    pf.space_after = Pt(6)
    pf.line_spacing_rule = WD_LINE_SPACING.SINGLE

    for kind, text in md_to_blocks(body):
        if kind == "h1":
            doc.add_heading(text, level=1)
        elif kind == "h2":
            doc.add_heading(text, level=2)
        elif kind == "h3":
            doc.add_heading(text, level=3)
        elif kind == "li":
            doc.add_paragraph(text, style="List Bullet")
        elif kind == "table":
            rows = [r for r in text.split("\n") if r.strip().startswith("|")]
            parsed: list[list[str]] = []
            for r in rows:
                cells = [c.strip() for c in r.strip().strip("|").split("|")]
                if all(set(c) <= set("-: ") for c in cells):
                    continue
                parsed.append(cells)
            if not parsed:
                continue
            cols = max(len(r) for r in parsed)
            table = doc.add_table(rows=len(parsed), cols=cols)
            table.style = "Table Grid"
            for ri, row in enumerate(parsed):
                for ci in range(cols):
                    table.rows[ri].cells[ci].text = row[ci] if ci < len(row) else ""
            doc.add_paragraph("")
        else:
            doc.add_paragraph(text)

    path = DOWNLOADS / f"{name}.docx"
    doc.save(path)
    return path


COMPLETE = r'''# Dama - Complete App Guide
End-to-End Player, Organizer, Publisher, Admin & Ops Documentation

This document explains the entire Dama product from first visit to daily operations. It is written for non-technical readers: players, tournament organizers, ad publishers, support staff, and platform admins. No coding knowledge is required.

Dama is an international draughts (dama) competition platform. Players practice vs AI, find rated matches, challenge friends, join Official and Community tournaments, host cups, fund a wallet, run in-match ads, and manage compliance (age, phone, document KYC) from web or Flutter. Platform operators run everything from a separate Admin Console.

## What is included in this guide
- Who uses Dama (roles and audiences)
- How Dama works (big picture layers)
- Sign-in, apps, and getting into each shell
- Guest practice and signed-in player play
- Friends, invites, matchmaking, spectate, chat
- Match timer (authoritative dual clocks)
- Wallet, top-up, receipts, payouts, cash compliance
- Official tournaments and Community hosting
- Competition formats (knockout, round robin, Swiss, groups+knockout, arena)
- Ads publisher shell
- Admin Console (sections, permissions)
- Telegram ops money review lane
- Master setup and go-live checklists
- URL reference and glossary

Regular hyphens only. Product copy in the live apps comes from the database (chrome). This guide uses plain English labels that match the product intent.

---

## 1. Who Uses Dama - Roles & Audiences

Dama serves several distinct audiences. Each sees a different part of the product. Understanding who does what prevents confusion during setup and daily play.

### Guest (practice visitor)
Anyone who has not signed in with Google. Can browse Play, watch public games, try VS-AI practice (when the flag is on), and discover public tournaments. Cannot play real PvP, join queues, use wallet money, host cups, or open publisher tools.

When they use it: First visit, try-before-account, watching a shared spectate link.

### Signed-in Player
The default account after Google sign-in. Full play, friends, invites, queue, chat/DMs, wallet, KYC, Official and Community cups as a participant, profile and settings.

When they use it: Everyday rated and casual play, social, money, and competition.

### Official Tournament Player
A signed-in player enrolled in an admin-created Official cup. Same play tools, plus check-in, ready, bracket or arena loops, and prize settlement.

When they use it: During platform-run competitions.

### Community Event Participant
A signed-in player who joins someone else's hosted cup (public Community list or private join code).

When they use it: After receiving an invite link/QR or browsing Community cups.

### Hosting Organizer (Community cup owner)
A signed-in player who creates and runs Community tournaments from the Hosting shell (`/events/*`). Pays host fee from wallet, starts the cup, manages roster, and can force-finish arena when allowed.

When they use it: Running community competitions for friends or the public.

### Ads Publisher / Ad Creator
A signed-in user of the Ads shell. Creates campaigns, uploads creatives, sets schedule/caps, pays create fee, watches analytics, uses nested wallet/receipts.

When they use it: Promoting brands inside live matches.

### Platform Admin / Superadmin
Operators of the separate Admin Console app. Permission-gated control of users, payments, Official cups, Hosting catalog, progression/clocks, ads runtime, feature flags, RBAC, telemetry.

When they use it: Ops shifts for money review, cup ops, abuse, and configuration.

### Telegram Ops Reviewer
A distinct money-review lane. Humans listed for the Telegram ops bot who approve/reject manual receipts and payouts from Telegram DMs. Same money actions as console payments review (dual-actuator; first writer wins).

When they use it: Mobile ops while receipts/payouts are pending.

---

## 2. How Dama Works - The Big Picture

Think of Dama as connected layers that share one live backend (API + Postgres + Redis):

- Play home (web `/` and Flutter Home) - Chess.com-style board + New Game / Games / Players rail
- Player portal - Overview, Profile, Wallet, Transactions, Receipts, Settings, Ads entry
- Tournaments hub - Official | Community | All discovery and cup lobbies
- Hosting shell - Organizer create/start/analytics under `/events/*`
- Ads shell - Publisher dashboard/campaigns/analytics under `/ads/*`
- Admin Console - Separate Next.js app for platform ops
- Telegram ops bot - Optional dual lane for receipt/payout review

End-to-end flow (one sentence per step)
1. Guest opens Play and may practice VS-AI
2. Player signs in with Google and receives a Dama session
3. Player may complete OTP when the platform requires it for play/money actions
4. Player finds a match (queue), invites a friend, or starts VS-AI
5. Server arms dual match clocks from database settings; clients only display them
6. Players move; chat optional; at 0:00 the server can flag-fall the game
7. Player tops up wallet (provider or manual bank receipt) when needed
8. Admin or Telegram ops reviews manual receipts / payouts
9. Player enrolls in Official cups or joins Community cups; organizers host Community cups
10. Cup formats generate brackets or arena queues; Ready starts the board
11. Publishers create ad campaigns that can serve inside eligible matches
12. Admin configures clocks, catalogs, flags, and reviews money from the Console

---

## 3. Apps & Where People Sign In

| App | Who | What it is |
|-----|-----|------------|
| Web player | Guests, players, organizers, publishers | Main browser experience |
| Flutter mobile | Same audiences on phone | Same product shells |
| Admin Console | Admin / superadmin | Platform operations only |
| Telegram | Ops reviewers | Money review DMs |

Sign-in
- Who: Everyone who needs a real account
- What: Google sign-in only (no password login)
- When: Before PvP, money, hosting, ads, or admin
- Why: One trusted identity for play and compliance
- Where: Web auth modal / `/auth/login`; Flutter sign-in; Admin `/auth/login`
- How:
  1. Tap Sign in with Google
  2. Complete Google / Supabase OAuth
  3. App exchanges for a Dama JWT
  4. You land back on Play, portal, Hosting, Ads, or Admin based on where you started

Important notes
- Guest practice JWT is VS-AI only and is not a full account
- OTP (when enabled) gates queue, invites, moves, enroll, host create/join, checkout, receipts, and payouts
- Cash phone OTP is a separate optional gate used only for phone KYC when that feature flag is on

---

## 4. Guest Practice - What Visitors Can Do

Who: Anyone not signed in
What: Browse and practice without money
When: First visit or shared watch links
Why: Low-friction board experience
Where: Web `/`, Flutter Home; spectate and public tournament browse

Step-by-step (VS-AI)
1. Open Play home
2. Choose VS-AI depth (allowed depths come from feature flags)
3. Client creates a guest practice session when needed
4. Board starts; dual clocks arm from platform default time control when clocks are enabled
5. Play until board win, resign/abandon, or flag-fall

Guests can also
- Browse live Games and open Spectate on public matches
- Open Tournaments hub (Official / Community / All) for discovery
- View leaderboard / Status and public player profiles
- Read Privacy, Terms, Refunds

Guests cannot
- Join matchmaking queue or send/accept challenges
- Use friends, DMs, wallet, KYC, payouts
- Enroll, check-in, ready, host, or publish ads
- Cast spectator win votes that require sign-in

---

## 5. Signed-in Player - Play Home Day to Day

Who: Default player account
What: Full casual and competitive play surface
When: After Google sign-in
Why: Identity, rated play, social, and competition
Where: Web `/` Play hub; Flutter Home; portal `/dashboard`

### 5.1 New Game rail
What you see and can do
- VS-AI practice (when enabled)
- Find match (global matchmaking queue)
- Create challenge / invite (rated, color, time preset)
- Open Tournaments hub

### 5.2 Global matchmaking queue
Who: Signed-in players only
What: Automatic 1v1 pairing across everyone currently in the queue
When: You want a rated game without picking a friend
Why: Fast pairing with no accept step
Where: Matchmaking join from Play rail or `/matchmaking`
How:
1. Tap Find match / Join queue
2. Complete OTP if the platform requires it
3. Wait in Redis FIFO queue
4. When a second player is available, the server creates the game immediately
5. Both receive match_found and open the live board

Important notes
- Queue matches are always rated
- Time control uses the platform default from Progression match clock settings (not a per-player pick on queue)
- There is no "accept match" dialog for the queue

### 5.3 Direct invite / challenge
Who: Signed-in players
What: Named challenge or open share link with chosen rated / color / time preset
When: You want a specific opponent or an open challenge link
Why: Controlled pairing with an accept step
Where: Players rail Challenge / Create challenge form
How:
1. Pick opponent (or open link mode)
2. Choose rated, preferred color, time preset from database presets
3. Send invite
4. Opponent accepts (or declines); open-link first acceptor takes the seat
5. Game is created only on accept

### 5.4 Live board, spectate, abandon
- Seated players move on web or Flutter; server validates every move
- Spectators open Watch / Spectate; they do not burn your clock
- Abandon / resign ends the game through server rules
- In-game chat and DMs use auth; seated players can disable game chat

### 5.5 Friends, Players rail, DMs
Who: Signed-in players
What: Friends requests, DMs, player search, online presence
When: Building a social graph around play
Why: Challenge people you know and message them
Where: Play home Players rail (Friends | Requests | DMs | All)
How:
1. Search players (server search, not a local-only filter)
2. Send friend request or Message
3. Accept / deny / cancel on Requests
4. Open DM threads; images go through chat media rules

---

## 6. Match Timer - Authoritative Dual Clocks

Who: Every seated player in a clock-armed game; spectators see clocks but do not claim flags
What: Two real clocks (one per seat). Only the side to move loses time.
When: Armed at game create when match_clock is enabled in the database
Why: Fair flag-fall; clients cannot invent or rewind time
Where: Live board on web and Flutter; Admin Progression configures platform defaults

How it works end to end
1. Admin sets enabled, default seconds, increment, invite TTL, and presets on Progression
2. On game create, server arms both seats (invite may use a chosen preset; queue/AI/cups use default)
3. Server subtracts elapsed time from the active seat on moves, on game-state fetch, and via a background sweeper
4. After a completed ply, optional Fischer increment is added to the mover
5. Web/Flutter only interpolate between server snapshots for smooth display
6. At local 0:00 the seated client asks the server to flag; server confirms and ends with end_reason clock_flag (opponent wins on time), or rejects if time remains. Rare bare king vs bare king may draw on time (end_reason clock_draw, draw_reason insufficient_material)
7. Seated UI shows database Won/Lost/Drew on time (never generic You won), including board status/seat hints during the land-animation grace (turn hints stay off while clock-owned). Spectate uses White/Black won on time / Draw on time (fail-closed if outcome delayed). Competition/career points still apply on decisive flag-fall; finalize is single-flight
8. Reconnect fetches state; server updates clocks first so remaining time does not reset to full

Admin role for timers
- Configure platform match_clock only
- No live admin play board clock UI

---

## 7. Player Portal - Profile, Wallet, Settings

Who: Signed-in players
What: Ops hub separate from the Play rail
When: Manage money, identity, history, ads entry
Why: Keep Play focused on the board
Where: Web `/dashboard`, `/profile`, `/wallet`, `/transactions`, `/receipts`, `/settings` (Flutter mirrors)

### Wallet top-up
How:
1. Open Wallet
2. Choose payment route (geo decides Ethiopia vs global providers / banks)
3. Pay by provider checkout, or upload a manual bank transfer receipt
4. Wait for admin or Telegram ops review on manual receipts
5. Balance updates when approved

### KYC and cash compliance
- Age gate when required by cash policy
- Phone KYC (optional phone OTP when that flag is on)
- Document KYC (government ID front/back + selfie + legal name + document type) when required for payout
- Cash/RMG kill switch and country allowlist can block paid enroll, top-up, and payout

### Payouts
How:
1. Save a payout method with primary phone
2. Complete document KYC if policy requires it
3. Request payout from Wallet
4. Admin or Telegram ops approve / reject / mark paid
5. Reject returns funds to wallet when designed that way

### Settings
- Document and cash compliance panels
- Account export / delete
- Sign out

---

## 8. Official Tournaments (Platform Cups)

Who: Signed-in players as participants; Admin creates and starts cups
What: Platform-run competitions with shared formats and prize escrow
When: During enroll, check-in, live, and settle windows
Why: Fair official ladder of cups
Where: Tournaments hub Official tab `/?view=tournaments`; Admin `/tournaments`

Player steps
1. Open Tournaments -> Official
2. Free Join (silent enroll) or paid Enroll with wallet payment
3. Wait for admin start; check in when the window opens
4. Classic formats: both seats Ready -> board starts
5. Arena: join cup queue, play rounds until arena clock ends
6. After finish, wait dispute/settle; prizes credit wallet when you place

Admin steps (summary)
1. Create Official cup (format, size, fees, media)
2. Open enroll / check-in as designed
3. Start cup (seeds bracket or starts arena clock)
4. Force-start / forfeit / rematch / arena finish when needed
5. Settle prizes after dispute window

---

## 9. Community Hosting (Organizer + Participant)

### Organizer
Who: Any signed-in player hosting a Community cup (when hosted events are enabled)
What: Create, brand, start, and close Community cups
When: After wallet can pay host fee
Why: Run your own competitions
Where: Hosting `/events/events`, `/events/dashboard`, create from Tournaments Host CTA

Organizer steps
1. Open Host a tournament / Hosting create
2. Choose size and format from the admin catalog (enabled formats only)
3. Set visibility (public Community vs private code/QR), entry fee, payout mode, branding
4. Pay host fee (and prize guarantee hold if used)
5. Share invite link or QR
6. Start when ready; players check in; Ready or arena queue
7. Close / finish; review analytics and nested Hosting wallet

Organizer cannot
- Change global catalog fees or formats (admin only)
- Edit Official platform cups
- Bypass cash/OTP gates when those flags require them

### Participant
Who: Signed-in joiner of someone else's cup
What: Join, check-in, ready, play, report issues
Where: Community tab or invite `/?view=tournaments&source=community&code=...`

Participant steps
1. Open Community or invite link
2. Join / pay entry if needed (auto-approved)
3. Check in -> Ready -> play (or arena queue)
4. See results; report if needed

Private cups stay hidden unless you are organizer or approved entry.

---

## 10. Competition Formats (All Five)

Shared for Official and Community unless noted. Classic draws usually rematch. Ready-timeout can forfeit no-shows.

### Knockout
Lose once and you are out. Random shuffle into a power-of-2 bracket; byes auto-advance. Final winner is champion.

Example: 8 players -> quarters -> semis -> final. 6 players pad to 8 with 2 byes.

### Round robin
Everyone plays everyone once. Highest standings points when all matches finish wins.

Example: 4 players -> 6 matches.

### Swiss
Fixed number of rounds from catalog by max players (example: max 8 -> 3 rounds). Pair by points each round; avoid rematches when possible; odd player gets a bye.

### Groups + knockout
Admin catalog sets target group size (default 4) and advance per group (default 2). On start, server shuffles into groups and builds group round robins. When every group match is done, the server automatically promotes top N per group into a knockout. Nobody presses a manual "start knockout" button.

### Arena
Timed continuous queue. Start opens arena_ends_at. Players join the cup queue; a worker pairs them; optional auto-start. Streak-based arena points. Late join may be allowed while live. Winner is top arena points when the arena clock ends (or force finish).

---

## 11. Ads Publisher Shell

Who: Signed-in ad creators / publishers
What: Create and schedule in-match campaigns
When: After wallet funds cover create fee
Why: Self-serve advertising into eligible live games
Where: `/ads/dashboard`, `/ads/campaigns`, `/ads/analytics`, nested wallet/receipts

Publisher steps
1. Open Ads dashboard
2. Create campaign (pay DB create fee by geo)
3. Upload creative (image/video/YouTube attach as supported)
4. Set schedule, interval, caps, status
5. Monitor analytics (impressions, clicks, CTR, spend)
6. Close when done; reopen only if not auto-closed

Publisher cannot
- Change global ad playback policy (admin)
- Invent placements client-side
- Serve without schedule + servable status + eligibility

Admin can manage runtime policy and console campaign overrides under Product and growth -> Ads.

---

## 12. Admin Console - Full Ops Map

Who: Users with console roles admin or superadmin plus RBAC permissions
What: Platform control plane
When: Money reviews, cup ops, configuration
Why: Operate Dama safely with fail-closed permissions
Where: Separate Admin app (not inside player web)

### Console sections (typical)
| Section | What you do there |
|---------|-------------------|
| Overview | Dashboard KPIs, Activity analytics |
| Customers | Users, roles/active flags, Avatars moderation |
| Sales and revenue | Currency, Geo routing, Document KYC, Payouts, Receipts, Transactions, Banks, Telegram ops |
| Competition | Official Tournaments, Hosted Events catalog/list/reports, Progression (XP + match clock) |
| Product and growth | Ads runtime/campaigns, Media pool |
| Access and security | Feature flags, RBAC (superadmin), Telemetry |

### Permissions (concept)
Every sensitive page needs a permission (examples: payments.review, tournaments.write, events.manage_catalog, progression.write, ads.manage_runtime, feature_flags.write, rbac.manage). Superadmin usually has all; admin usually has all except rbac.manage unless granted.

### Progression (match clock + ladder)
Who: Admins with progression.write
What: Enable clocks, choose default time from presets, set increment and invite TTL, manage XP-related settings
When: Before go-live and when changing pace of play
Why: Database is the only source of truth for time controls

### Feature flags (examples)
- VS-AI on/off and depth allow-list
- OTP required for play/money
- Cash/RMG enable + country disables
- Cash phone OTP
- Hosted events enable
- Public event matches rated
- Arena late-join / auto-start related settings (competition catalog)

---

## 13. Telegram Ops Reviewers

Who: Telegram admin IDs configured for the Dama ops bot
What: Approve/reject manual receipts; approve/reject/mark-paid payouts from Telegram
When: Bridge enabled and Ready in Admin -> Payments -> Telegram ops
Why: Mobile dual-actuator for money ops
Where: Telegram DMs; config in Admin

How
1. Admin enables Telegram ops (URL, bot API key, reviewer user, timeout)
2. Player submits receipt or payout request
3. Bot notifies Telegram admins
4. Reviewer taps approve/reject (reject needs reason) or mark paid
5. Dama wallet/status updates; console can do the same action (409 if already reviewed)

Cannot
- Replace full Admin Console
- Review without bot readiness / admin list
- Reject without a reason

---

## 14. Master Checklists

### Player go-live checklist
1. Sign in with Google on web or Flutter
2. Confirm VS-AI works as guest and as signed-in
3. Join queue once; confirm match_found and clocks
4. Send and accept one invite with a 1-minute preset
5. Add a friend and send a DM
6. Spectate a live game
7. Complete age/phone/document KYC paths your market requires
8. Top up wallet (provider and/or manual receipt path)
9. Join a free Official or Community cup; check-in; Ready; play
10. Open portal Overview, Transactions, Receipts, Settings

### Organizer go-live checklist
1. Fund wallet for host fee
2. Create a public Community cup and a private code cup
3. Start each enabled format at least once in staging (knockout, RR, Swiss, groups+KO, arena)
4. Confirm Ready auto-start and arena queue pairing
5. Confirm prize/settlement path for your payout mode

### Publisher go-live checklist
1. Fund wallet; create campaign; pay create fee
2. Attach creative; set schedule; set servable status
3. Confirm analytics counters move on eligible matches
4. Download invoice/receipt PDF

### Admin go-live checklist
1. Confirm console role + permissions
2. Set currency + geo payment
3. Configure banks for manual top-up
4. Set Progression match_clock presets/default/increment
5. Seed Official cup and Hosting catalog (sizes, formats, fees)
6. Toggle feature flags for your market
7. Test receipt approve/reject and payout mark-paid (console + Telegram if used)
8. Confirm Activity and Telemetry pages load

---

## 15. URL Reference (typical)

| Surface | Example path |
|---------|--------------|
| Play home | `/` |
| Tournaments hub | `/?view=tournaments` |
| Spectate | `/?view=spectate&gameId=` |
| Matchmaking | `/matchmaking` |
| Player portal | `/dashboard` |
| Wallet | `/wallet` |
| Hosting | `/events/dashboard`, `/events/events` |
| Ads | `/ads/dashboard`, `/ads/campaigns` |
| Admin | `/dashboard`, `/tournaments`, `/payments/receipts`, `/progression` |

Exact menu labels come from database client_nav / console_nav.

---

## 16. Glossary

| Term | Meaning |
|------|---------|
| Official | Platform-created tournament |
| Community / Hosting | Player-created cup loop |
| Queue | Global rated matchmaking FIFO |
| Invite / challenge | Accept-gated direct match |
| Flag-fall | Loss when active seat clock hits 0 (end_reason clock_flag; UI says Won/Lost on time) |
| Clock draw | Rare bare king vs bare king on flag-fall (end_reason clock_draw, draw_reason insufficient_material) |
| Ready | Both seats confirm before cup board starts |
| Arena | Timed continuous cup matchmaking |
| Chrome | Database UI strings (fail-closed; apps do not invent copy) |
| Dual-actuator | Console and Telegram can both review the same money item; first success wins |

---

## Related companion guides
- Dama_Play_And_Matchmaking_Guide
- Dama_Competition_Formats_Guide
- Dama_Wallet_Payments_And_Compliance_Guide
- Dama_Ads_And_Admin_Ops_Guide
'''

PLAY = r'''# Dama - Play & Matchmaking Guide
End-to-End Guest, Player, Spectate, Friends, Chat & Timer Documentation

This companion guide zooms into how people actually play Dama day to day. It matches the detail style of focused Smart Menu companion docs. Regular hyphens only.

## 1. Who this guide is for
- Guests trying VS-AI
- Signed-in players using queue, invites, friends, chat
- Spectators watching public boards
- Support staff explaining "why did my game start / not start?"

## 2. Play home layout
Who: Guests and players
What: Board in the center; New Game / Games / Players rail
When: Default landing after opening the app
Why: One place to start or resume play
Where: Web `/`, Flutter Home

What you see
- Live or lobby board with seat clocks when a game is armed
- New Game: VS-AI, Find match, Challenge, Tournaments entry
- Games: live list, watch, history
- Players: Friends, Requests, DMs, All search

## 3. VS-AI practice
Who: Guests (practice token) and signed-in players
What: Immediate single-player game vs engine
When: Learning or warming up
Why: No opponent search
Where: New Game -> VS-AI
How:
1. Confirm VS-AI feature flag is on
2. Pick an allowed search depth
3. Start game
4. Clocks arm from platform default when match_clock is enabled
5. Play; abandon/resign available per product rules

Cannot: Use guest token for PvP or wallet actions.

## 4. Global queue (Find match)
Who: Signed-in players (not guests)
What: Automatic rated pairing among all queued players
When: You want a fast 1v1
Why: No accept dialog; second joiner creates the match
Where: Find match / `/matchmaking`
How:
1. Join queue (OTP if required)
2. Wait; status may show queue size
3. Pairing is FIFO across the whole queue (not friends-only, no rating bands in current product)
4. Server creates rated game with default time control
5. Both get match_found and open the board
6. Leave queue cancels waiting if not yet paired

## 5. Invites and open challenges
Who: Signed-in players
What: Accept-gated match with chosen preset TC / rated / color
When: Specific opponent or shareable challenge
Why: Control who you play and which clock preset you use
Where: Challenge CTAs on Players / profile / create form
How:
1. Choose to_user or open_link
2. Pick time_control_seconds from database presets (example: 60, 180, 600, 1800)
3. Send
4. Recipient accepts/declines (REST or matchmaking websocket)
5. Open link: anyone except sender can accept by token
6. Game creates only on accept; navigation uses invite_accepted

## 6. During a live game
Who: Seated players
What: Moves, clocks, optional chat, resign/abandon
When: After game_id exists
Why: Fair authoritative play
Where: Live Play hub / Flutter match board

Step-by-step move
1. It is your turn (your clock is running)
2. You play a legal move (web or Flutter)
3. Server checks you are the correct seat before burning clock
4. Server debits your clock, applies move, may grant increment
5. Opponent is notified on the game websocket
6. Repeat until board win, resign/abandon, admin/cup forfeit, or flag-fall (clock_flag is a real win with points; UI shows Won/Lost on time, not plain You won)

Spectators
- Join Watch/Spectate
- See board and clocks
- Cannot move or claim clock_flag
- On clock endings see White/Black won on time / Draw on time from spectate chrome (fail-closed if outcome delayed)
- May vote on winner predictions when signed in and not seated (product rules apply)

## 7. Timer detail (support script)
Question: "Does 0:00 end the game?"
Answer: Yes. The server owns remaining time. At 0 for the side to move, flag-fall ends the game for the opponent (end_reason clock_flag). Rare bare king vs bare king may draw on time (clock_draw, insufficient_material). Seated UI must say Won/Lost/Drew on time from the database - never a generic You won. The UI asking is not enough by itself; the server must confirm.

Question: "I refreshed and my clock reset."
Answer: It should not. Reconnect loads game state; server updates clocks first and returns remaining time.

Question: "Why is queue 10 minutes but my invite was 1 minute?"
Answer: Queue uses platform default initial_seconds. Invites use the preset you selected.

## 8. Friends and DMs
Who: Signed-in players
What: Friend graph + direct messages
When: Social play
Where: Players rail
How:
1. Search All players
2. Add friend -> pending request
3. Accept/deny/cancel
4. Message opens DM (compose may show a pending bubble until send succeeds)
5. Game chat is per match; seated players can disable it

## 9. Common failures and what they mean
| Symptom | Likely cause |
|---------|--------------|
| Cannot join queue | Guest, OTP required, or auth missing |
| Invite rejected time | Preset not in match_clock.presets |
| Clock still running on claim | Client hit 0 early; wait for server debit/sweeper |
| No match_found | Still alone in queue, or left queue |
| Cannot post chat | Not joined/seated, chat disabled, or auth |

## 10. Checklist for support
1. Confirm signed-in vs guest
2. Confirm feature flags (VS-AI, OTP)
3. Confirm match_clock enabled and presets
4. Reproduce queue pair with two test accounts
5. Reproduce invite accept with 60s preset
6. Expire/flag path only in lab when e2e auth is allowed
'''

COMP = r'''# Dama - Competition Formats Guide
Official & Community Cups End-to-End

This guide explains knockout, round robin, Swiss, groups+knockout, and arena the way staff and organizers need to run them. Regular hyphens only.

## 1. Shared cup lifecycle
Applies to Official (admin) and Community/Hosting (organizer) unless noted.

1. Create cup (admin or organizer)
2. Players enroll / join (free or paid)
3. Optional check-in window (classic formats seed from checked-in seats)
4. Start cup
5. Matches appear (bracket, Swiss rounds, RR slate, or arena queue)
6. Both seats Ready -> board + clocks start (arena may auto-start)
7. Results advance standings or bracket
8. Finish / settle prizes

Who starts
- Official: Admin Console -> Tournaments -> Start
- Community: Organizer Hosting -> Start

## 2. Knockout
What: Single elimination
Who wins: Final match winner
How groups/bracket are made: On start, shuffle players, pad to next power of 2, insert byes
Player steps: Check in -> see bracket -> Ready when seated -> play -> winner advances
Example 8 players: QF -> SF -> Final
Example 5 players: Pad to 8 with byes; some auto-advance
Draws: Classic rematch reset
Forfeit / ready timeout: Opponent advances

## 3. Round robin
What: Everyone plays everyone once
Who wins: Top standings points when all matches done
How made: All pairings created at start
Example 4 players A B C D: AB AC AD BC BD CD = 6 games
No byes
Cup ends only when the full slate is finished

## 4. Swiss
What: Fixed rounds; re-pair by score each round
Who wins: Top points after last round
Rounds: From catalog swiss_rounds_by_max_players (example max 8 -> 3 rounds)
Pairing: Sort by points; avoid prior opponents; leftover gets bye (bye counts as a win)
Advance: When a whole round finishes, next round is generated (or cup finishes)

## 5. Groups + knockout
What: Group round robins, then knockout of advancers
Who sets group rules: Admin Events catalog
- groups_knockout_target_group_size (default 4)
- groups_knockout_advance_per_group (default 2)
How groups form at Start: Server shuffles and deals into N groups
When knockout starts: Automatically when every group-phase match is done (maybePromote). No manual button.
Who advances: Top N by group standings points
Example: 8 players, size 4, advance 2 -> 2 groups -> top 2 each -> 4-player KO
Degenerate: If fewer than 2 advancers, finish on overall group standings

## 6. Arena
What: Timed continuous matchmaking inside the cup
Who: Enrolled players who join the arena queue
How:
1. Start sets arena_ends_at (duration from cup/catalog, often 60 minutes default)
2. Players Join queue in cup lobby
3. Worker pairs queued players every few seconds (rating or score mode)
4. Boards start (auto-start flag often on)
5. Results add arena points (streak bonuses: example 2 / 3 / 4 for consecutive wins; draws score; losses reset streak)
6. Re-queue until clock ends or force finish
7. Ranking by arena points decides the champion
Late join: Allowed while live if competition_arena_allow_join_while_live is on
Draws: Score points (unlike classic rematch)

## 7. Ready, rematch, forfeit (classic + arena seats)
1. Match status ready with both seats filled
2. Each player taps Ready
3. When both ready, server creates the PvP game and arms clocks
4. Admin/organizer may force-start or rematch when allowed
5. Ready-timeout worker can auto-forfeit no-shows

## 8. Official vs Community differences
| Topic | Official | Community |
|-------|----------|-----------|
| Creator | Admin | Organizer |
| Discovery | Official tab | Community tab / invite code |
| Catalog fees/formats | Admin | Uses same catalog; cannot edit catalog |
| Rated public Community | Only if public_event_matches_rated flag on | Private never rated |
| Force tools | Admin console | Organizer force where product allows |

## 9. Organizer day-of checklist
1. Confirm format and size before taking entry fees
2. Share link/QR early
3. Start only when enough checked-in (classic) or enrolled (arena)
4. Watch Ready timeouts
5. For groups+KO, wait for automatic promotion; do not expect a second Start
6. For arena, announce end time; force finish only if needed
7. Close and confirm prize path

## 10. Player FAQ
Why am I not in the bracket?
You may have missed check-in.

Why no knockout yet in groups format?
Group games are still open. Knockout builds itself when all group matches finish.

Why can I still join this cup after it started?
Only Arena late-join when that flag is on. Classic formats do not allow post-start join.
'''

WALLET = r'''# Dama - Wallet, Payments & Compliance Guide
Players, Publishers, Organizers, Admin & Telegram Ops

Regular hyphens only.

## 1. Who touches money
| Audience | What they do with money |
|----------|-------------------------|
| Player | Top-up, pay entry fees, receive prizes, request payout |
| Organizer | Pay host fee / guarantee holds; receive net per product rules |
| Ads publisher | Pay campaign create fee; fund spend |
| Admin | Currency, geo, banks, review receipts/KYC/payouts |
| Telegram ops | Dual-actuator receipt/payout review |

One wallet ledger is shared across player portal, Hosting nested wallet, and Ads nested wallet.

## 2. Currency and geo routing
Who: Admin (Sales and revenue)
What: Global USD vs domestic Ethiopia ETB and city/geo payment routes
When: Before accepting live payments
Why: Correct provider and bank instructions per country
Where: Admin Currency + Geo routing pages

Players do not invent country on pay screens; server resolve uses geo locate records.

## 3. Player top-up paths
### Provider checkout
1. Open Wallet
2. Choose amount / package as offered
3. Complete Chapa / Paddle (or configured provider) checkout
4. Wallet credits on successful webhook/confirm path

### Manual bank transfer + receipt
1. Open Wallet manual path
2. See bank details from Admin Banks
3. Transfer offline
4. Upload receipt screenshot / form fields
5. Status pending until review
6. Admin Console or Telegram ops approve/reject
7. On approve, balance increases; on reject, player is notified (review note when provided)

## 4. Cash / RMG compliance gates
Who: Players doing paid enroll, checkout, manual receipt, payout
What: Server EvaluateCash fail-closed checks
When: Any cash-sensitive action
Why: Legal/age/jurisdiction safety
Where: Enforced in API; UI hides/disables from flags + chrome

Gates include
- cash_rmg_enabled kill switch
- per-country disabled_countries
- allowed_country_codes allowlist
- age gate
- phone KYC (and optional cash phone OTP)
- document KYC for payout when require_document_kyc_for_payout

## 5. Phone KYC
Flag cash_phone_kyc_required
- OTP flag OFF (default): saving phone can mark verified immediately
- OTP flag ON: save phone, then phone-channel OTP start/verify

## 6. Document KYC
Who: Players needing payout (when policy requires)
What: ID front, ID back, selfie, legal name, document type
When: Before payout request
Where: Settings / wallet proactive gate; Admin Payments KYC review
How:
1. Upload images (trusted media URLs only)
2. Submit
3. Admin reviews images / history
4. Approve or reject (reject can allow resubmit)

## 7. Payouts
Player how
1. Add payout method with primary phone required
2. Pass cash + document gates
3. Request payout (wallet debits to pending)
4. Wait review
5. Approved -> mark paid by ops; Rejected -> funds return per design

Admin how
1. Open Payouts
2. Approve / reject / mark paid using policy statuses
3. Or use Telegram ops for the same transitions

## 8. Cup and ads money touchpoints
- Official/Community entry fees: wallet debit on enroll/join when paid
- Host fee: organizer pays on create
- Prize escrow / settlement: after finish and dispute windows
- Ads create fee: charged on campaign create by geo
- Invoices/receipts: downloadable PDF on web/admin; Flutter share sheet

## 9. Telegram ops Ready checklist
1. Admin -> Payments -> Telegram ops
2. Set bot service URL, bot API key, reviewer user id, notify timeout
3. Ensure TELEGRAM_ADMIN_IDS configured on the bot
4. Submit a test manual receipt
5. Approve from Telegram
6. Confirm console shows reviewed and wallet moved
7. Confirm double-review returns conflict

## 10. Support scripts
"My receipt is pending"
Manual path waits for human review (console or Telegram).

"I cannot payout"
Check phone method, document KYC, cash flag, country allowlist, and OTP gates.

"I paid entry but am not in the cup"
Confirm payment succeeded, enroll API success, and that you are viewing the correct Official vs Community id.
'''

ADS_ADMIN = r'''# Dama - Ads Publisher & Admin Ops Guide
Publishers, Ad Creators, and Platform Operators

Regular hyphens only.

## Part A - Ads publisher

### Who / What / When / Why / Where
Who: Signed-in users of the Ads shell (publisher/advertiser product surface)
What: Create campaigns, upload creatives, schedule, analyze, pay fees
When: After wallet has create-fee funds
Why: Self-serve in-match advertising
Where: Web `/ads/*`, Flutter Publisher shell

### Create campaign step by step
1. Open Ads Dashboard
2. Go to Campaigns -> Create
3. Pay database create fee (Ethiopia vs global amount from settings)
4. Set title and creative type
5. Upload thumbnail/gallery or attach YouTube job when supported
6. Configure first show, interval, caps, optional non-skippable override within admin bounds
7. Set status so the campaign can serve
8. Save

### Day-to-day publisher controls
- Pause/close campaign
- Reopen if not auto-closed by end worker
- Read analytics KPIs (impressions, reach, clicks, CTR, CPC, completion, fee spend)
- Nested Ads wallet / receipts / transactions / payout (same ledger)
- Download invoice PDF

### What publishers cannot do
- Edit global ad_playback defaults
- Force serve when geo/cap/schedule/eligibility fails
- Moderate other publishers without admin permission

## Part B - Admin ads runtime
Who: Admins with ads.manage_runtime / ads.manage_campaigns
Where: Admin -> Product and growth -> Ads
What: Global playback policy, non-skippable bounds, console campaign schedule/status overrides
Why: Protect player experience and billing integrity

## Part C - Admin console map (ops)

### Overview
Dashboard KPIs and Activity analytics (usage, heatmaps, mode breakdowns).

### Customers
Users list/detail: assign roles, activate/deactivate, inspect KYC/payout methods.
Avatars: moderate uploads.

### Sales and revenue
Currency, Geo, KYC review, Payouts, Receipts (view/PDF/print), Transactions, Banks, Telegram ops.

### Competition
Official tournaments lifecycle.
Hosted events catalog (sizes, formats, fees, groups target/advance, Swiss rounds map, arena defaults).
Hosted reports moderation.
Progression: XP and match_clock.

### Product and growth
Ads + Media pool channels.

### Access and security
Feature flags, RBAC (superadmin), Telemetry (fingerprints, geo-ip, audit).

## Part D - Permission quick reference
| Permission | Typical use |
|------------|-------------|
| payments.review | Money reviews + Telegram ops config |
| tournaments.write | Official cups |
| events.manage_catalog | Hosting catalog |
| events.manage_reports | Report moderation |
| progression.write | Clocks / progression |
| ads.manage_runtime | Ad playback policy |
| ads.manage_campaigns | Console campaign ops |
| feature_flags.write | Product toggles |
| rbac.manage | Role/permission catalog |
| users.read / write_* | Customer admin |
| telemetry.read | Security vault |
| activity.read | Activity page |

## Part E - Operator daily checklist
1. Clear pending receipts and payouts
2. Check KYC queue
3. Confirm Official cups in enroll/live states are healthy
4. Skim hosted reports
5. Verify feature flags for the market
6. If ads are live, skim runtime and stuck campaigns
7. If Telegram ops is on, confirm bot Ready and overnight notifies delivered
'''

INDEX = r'''# Dama end-user guides

These guides are written in the same audience style as the Smart Menu reference docs (Who / What / When / Why / Where / How). They describe the current Dama product across web, Flutter, Admin Console, and Telegram ops.

## Downloads (DOCX)
See `docs/guides/downloads/` for Word copies:
- Dama_Complete_App_Guide.docx
- Dama_Play_And_Matchmaking_Guide.docx
- Dama_Competition_Formats_Guide.docx
- Dama_Wallet_Payments_And_Compliance_Guide.docx
- Dama_Ads_And_Admin_Ops_Guide.docx

## Markdown sources
- [Dama_Complete_App_Guide.md](./Dama_Complete_App_Guide.md)
- [Dama_Play_And_Matchmaking_Guide.md](./Dama_Play_And_Matchmaking_Guide.md)
- [Dama_Competition_Formats_Guide.md](./Dama_Competition_Formats_Guide.md)
- [Dama_Wallet_Payments_And_Compliance_Guide.md](./Dama_Wallet_Payments_And_Compliance_Guide.md)
- [Dama_Ads_And_Admin_Ops_Guide.md](./Dama_Ads_And_Admin_Ops_Guide.md)

## Smart Menu reference (read-only samples)
The Smart Menu sample project under `smart-menu-sample-referance-only-frontend/` contains the original hospitality guides this style mirrors. Those docs describe Smart Menu venues/guests/staff, not Dama. Dama guides above are the game-platform equivalents.
'''


GUIDES = {
    "Dama_Complete_App_Guide": COMPLETE,
    "Dama_Play_And_Matchmaking_Guide": PLAY,
    "Dama_Competition_Formats_Guide": COMP,
    "Dama_Wallet_Payments_And_Compliance_Guide": WALLET,
    "Dama_Ads_And_Admin_Ops_Guide": ADS_ADMIN,
}


def main() -> None:
    write_markdown("README", INDEX)
    written = []
    for name, body in GUIDES.items():
        md = write_markdown(name, body)
        docx = write_docx(name, body)
        # assert no em dash leaked
        text = md.read_text(encoding="utf-8")
        assert "\u2014" not in text, name
        written.append((md, docx))
    print("Wrote", len(written), "guides (+ README) into", OUT)
    for md, docx in written:
        print("-", md.name, "|", docx.name, f"({docx.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
