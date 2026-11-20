# -*- coding: utf-8 -*-
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / "Dama_Play_And_Matchmaking_Guide.md"
parts = []
def add(s): parts.append(s.rstrip()+"\n\n")

add("""# Dama - Play & Matchmaking Guide
End-to-End Guest, Player, Spectate, Friends, Chat, Timer & Troubleshooting Bible

This companion bible zooms into how people actually play Dama day to day. It is written for non-technical readers: guests, signed-in players, spectators, and support staff. Regular hyphens only. Product button labels in the live apps come from database chrome; this guide uses plain English that matches product intent.

Read with the Complete App Guide for audience maps and wallet/cups/ads. This file is the deep play path reference.

## What is included
1. Who this guide is for
2. Play glossary (play-specific)
3. Play home layout in detail
4. Guest VS-AI practice
5. Sign-in gates that affect play
6. Global queue (Find Match)
7. Direct invites, open challenges, friend challenges
8. Rated vs unrated rules for casual play
9. Live game loop: moves, Stop game, reconnect
10. Authoritative dual clocks and flag-fall
11. Spectate, Watch rail, QR, votes
12. Friends, Requests, presence
13. DMs and game chat (including outbox)
14. Notifications that open play surfaces
15. Flutter parity notes
16. URL reference for play
17. Step-by-step scenarios
18. Troubleshooting FAQ and support checklists
""")

add("""# 1. Who This Guide Is For

| Audience | Why they open this bible |
|----------|--------------------------|
| Guest | Learn VS-AI and spectate limits |
| Signed-in player | Queue, invites, friends, chat, clocks |
| Spectator | Watch and vote correctly |
| Support / CS | Explain why a game started, did not start, or flagged |
| Trainer | Run onboarding drills with two accounts |

## Style reminder
Every major section uses Who / What / When / Why / Where / How with numbered steps.
""")

add("""# 2. Play Glossary

| Term | Meaning |
|------|---------|
| Play home | Main board shell at web `/` or Flutter Home |
| New Game rail | Right-rail tab to start AI, Find Match, or Challenge |
| Games rail | Watch live public PvP and open your History |
| Players rail | Friends, Requests, DMs, All search |
| Guest practice token | Short JWT for VS-AI only |
| Queue / Find Match | Global FIFO waiting list; always rated |
| Invite / challenge | Accept-gated match with chosen preset / rated / color |
| Open challenge link | Shareable `/?challenge=` token anyone but sender can accept |
| Time control (TC) | Seconds on each clock when the game arms |
| Preset | Allowed TC values from database match_clock.presets |
| Default TC | Platform initial_seconds used by queue/AI when no invite preset |
| Flag-fall | Loss when active seat reaches 0 and server confirms |
| Spectate | Watch without sitting; clocks visible read-only |
| Vote | Predict winner while signed in and not seated |
| Presence Online | Recently heartbeating |
| Presence Playing | Currently in an active game |
| Outbox | Local retry queue for DM/chat sends |
| Abandon / Stop game | Resign; opponent wins |
| OTP | Extra verify step when global OTP flag is on |
| Chrome | Database UI strings; apps fail closed if missing |
""")

add("""# 3. Play Home Layout

## Who
Guests and signed-in players.

## What
Chess.com-style shell: center board column; right rail New Game | Games | Players; desktop left navigation from client_nav; mobile bottom nav for play / matchmaking / tournaments / spectate.

## When
Default landing after opening the app or finishing OAuth back to Play.

## Why
One place to start, resume, socialize, and discover cups without leaving the board metaphor.

## Where
- Web: `/` (legacy `/play` redirects here preserving query)
- Flutter: Home with PlayRailPanel
- Tournaments discovery swaps center to hub via `/?view=tournaments` (not a fourth rail tab)

## How - what you see
1. Center: lobby preview board or live session. Opponent seat above, you below on desktop. Mobile keeps avatar/timer rail beside the board.
2. Seat clocks appear when a game is clock-armed.
3. 2D/3D toggle. Moves animate. AI shows thinking state. Confetti on win for signed-in sessions when product enables it.
4. Right rail scrolls independently so the board stay framing stays stable.
5. Open New Game to start; Games to watch/history; Players to socialize.

## Presence colors
Green Online, red Playing, muted Offline - labels from play rail chrome.
""")

add("""# 4. Guest VS-AI Practice

## Who
Anyone not signed in (and signed-in players who also use AI).

## What
Immediate single-player game versus the engine at an allowed search depth.

## When
Learning, warming up, or trying Dama before Google sign-in.

## Why
No opponent search and no wallet. Completely non-monetary.

## Where
New Game -> AI tab on Play home. Legacy deep links `/?mode=ai&depth=` normalize into an in-place session then strip the query on web.

## How
1. Confirm VS-AI feature flag is on. If off, AI start shows unavailable chrome.
2. Pick a depth from the allow-list only.
3. Start. Unsigned web calls ensurePracticeToken -> `POST /auth/guest` and stores a practice token for the session.
4. Board starts in the center column. Dual clocks arm from platform default when match_clock is enabled.
5. Play. Stop/abandon resigns the human seat (AI wins per server rules).
6. Guests can also browse Watch and open public Spectate, browse tournaments discovery, leaderboard, status, profiles, legal pages.

## Cannot
Use guest token for queue, invites, friends, DMs, wallet, cups enroll/host, ads, or spectator votes that require sign-in. Cannot start non-AI games as guest.
""")

add("""# 5. Sign-in Gates That Affect Play

## Who
Anyone moving from guest to full play.

## What
Google via Supabase PKCE, then Dama JWT exchange. No password login.

## When
Before queue, invites, friends, DMs, rated career PvP, votes.

## Why
Identity for rated matches and social graph.

## Where
Sign-in modal on Play; `/auth/login` opens modal; `/auth/oauth/complete` quiet shimmer.

## How
1. Tap Sign in with Google.
2. Complete OAuth.
3. Exchange succeeds; JWT stored.
4. Casual sign-in preserves `?view=` play context. Default next is `/`. `/dashboard` is not forced as OAuth next.

## OTP when enabled
Gates matchmaking join, invite create/accept/token accept, moves, abandon, and other writes. Guest practice JWT path skips account OTP. Challenge accept can retry after verify without burning the invite.
""")

add("""# 6. Global Queue (Find Match)

## Who
Signed-in players only (not guests).

## What
Automatic 1v1 pairing across everyone currently waiting. Single global FIFO queue. No accept dialog. Always rated. Time control uses platform default initial_seconds (must be a valid preset). No rating-band matchmaking in the current product.

## When
You want a fast rated game without picking a friend.

## Why
Lowest-friction competitive pairing.

## Where
- Embedded center: `/?view=match`
- Legacy: `/matchmaking` maps to the same intent
- Flutter MatchmakingPage
- Play rail Find Match entry

## How
1. Open Matchmaking / Find Match.
2. Tap Join queue. Complete OTP if required.
3. Wait. UI may show queue size. Websocket events: queue_joined / queue_updated / queue_left.
4. When a second player is available, server creates the game immediately.
5. Both receive match_found (notification + realtime). After a short delay web navigates to `/?gameId=...&mode=pvp`.
6. Leave queue cancels waiting if not yet paired.
7. You cannot join queue while an outgoing invite wait UI is active (button disabled).

## Failure modes
| Symptom | Cause |
|---------|-------|
| Cannot join | Guest, missing auth, OTP, Redis unavailable |
| Queue size 0 forever | You are alone |
| No match_found | Left queue, WS dropped, or still alone |
| Guest WS 403 | By design |

## Important
Queue TC is the platform default. It can differ from an invite that used a custom preset.
""")

add("""# 7. Direct Invites, Open Challenges, Friend Challenges

## Who
Signed-in sender and recipient.

## What
Accept-gated match. Game is created only on accept - not when the invite is sent. Sender chooses rated bool, preferred color (white/black/random), and time_control_seconds from database presets.

## When
You want a specific opponent or a shareable open challenge.

## Why
Controlled pairing and chosen clock preset.

## Where
- New Game -> Challenge / Create Game form
- Matchmaking page Direct invite block
- Profile / hover card Challenge CTAs
- Friend is not automatic challenge; Challenge is a separate action
- Open link: `/?challenge={share_token}`

## How - targeted challenge
1. Pick opponent via typeahead (server search).
2. Choose rated, color, preset seconds (examples often include 60, 180, 600, 1800 - live values are DB-only).
3. Send (`POST /invites`, OTP if required). Cannot invite yourself.
4. Recipient sees invite dialog via websocket invite_received and/or notification to `/?view=match`.
5. Accept via UI / REST / websocket. Decline or cancel supported.
6. On accept, game arms with invite TC; navigate to `/?gameId=`.
7. Invite TTL comes from match_clock.invite_ttl_seconds (fail closed if missing).

## How - open challenge link
1. Create with open link mode (empty to_user).
2. Copy share URL with challenge token.
3. First signed-in acceptor other than sender takes the seat via token accept.
4. Session guard prevents double-accept; OTP may delay accept until verified.

## How - from Players / profile
1. Open player hover or `/players/{id}`.
2. Tap Challenge (chrome label).
3. Optional deep link primes opponent chip: `/?opponent=&opponentId=&opponentRating=`.
""")

add("""# 8. Rated vs Unrated (Casual Play Scope)

| Source | Rated? | Player choice |
|--------|--------|---------------|
| Global queue | Always rated | None |
| Direct invite / Create Game | Default toggle often on | Sender chooses |
| VS-AI | Practice; not queue-rated PvP career | N/A |
| Cup boards | Outside casual; see Competition bible | Flag + visibility rules |

Hall of Fame period wins count rated=true results only.
""")

add("""# 9. Live Game Loop

## Who
Seated players on a game_id.

## What
Legal moves, clocks, optional chat, resign/abandon, reconnect.

## When
After queue pair, invite accept, AI start, or cup Ready auto-start.

## Why
Fair authoritative play.

## Where
Web LivePlayHub embed / full hub; Flutter MatchBoardPage for PvP; AI may stay in-place on home.

## How - move
1. It is your turn (your clock running when armed).
2. Play a legal move on web or Flutter.
3. Server asserts you are the correct seat before burning clock (spectators cannot debit).
4. Server debits clock, applies move, may grant increment.
5. Opponent and spectators receive websocket move updates.
6. Optimistic UI freezes/merges carefully with server state.

## How - Stop game / abandon
1. Tap Stop game (chrome confirm).
2. `POST /games/{id}/abandon` resigns; opponent wins.
3. OTP may apply.
4. Already finished -> error.
5. Embedded AI stop returns to Play lobby on `/`.

## How - reconnect
1. Re-open `/?gameId=` or Flutter match route.
2. Fetch game state; clocks load from server remaining (never invent full reset).
3. Rejoin game websocket room.
4. Continue playing.

## Share for watchers
Spectate URL `/?view=spectate&gameId=` - not the seated resume link.
""")

add("""# 10. Authoritative Dual Clocks & Flag-fall

## Who
Seated players; spectators see read-only clocks; admins configure Progression match_clock.

## What
Two server clocks. Only side to move loses time. Clients interpolate between snapshots for smooth display.

## When
Armed at create when enabled: StartGame, queue, invite accept (invite preset), cup/arena starts via shared arming.

## Why
Fair flag-fall; prevent client rewind/cheat.

## Where
Live/Spectate boards; Admin Progression fields: enabled, initial_seconds, increment_seconds, invite_ttl_seconds, presets list.

## How
1. Admin sets defaults and presets (initial must match a preset).
2. Game create arms both seats.
3. Move path debits active seat; already-zero can flag immediately on move path.
4. GetGameState syncs debit when advanced; reconnect does not rewind.
5. ~2s sweeper walks clock-active games (PvP + VS-AI armed; Watch list still excludes AI).
6. At local 0:00 seated client sends websocket clock_flag (REST fallback).
7. Server ForcedOutcome end_reason=clock_flag (decisive win + points) or rejects if time remains. Bare king vs bare king may end clock_draw with draw_reason insufficient_material.
8. Seated UI uses DB you_*_on_time_message (Won/Lost/Drew on time), never generic You won - including board statusText/seat hints during the short land-animation grace before the finished overlay (turn hints stay off while clock-owned). Clients never invent a board-wipe winner over clock_flag/clock_draw. Spectate uses status_*_on_time (fail-closed if outcome delayed); play-rail has on-time aria. Finalize is single-flight so career/arena points apply once.

## Support truths
- UI 0:00 alone is insufficient without server confirm.
- Queue default TC may differ from invite preset TC.
- Spectate cannot claim flag.
""")

add("""# 11. Spectate, Watch Rail, QR, Votes

## Watch rail (Games tab)
Who: Guests and players
What: Unfinished public PvP list with seats, spectator counts, avatar stacks, search over username or game id
Cannot list: AI/practice games; private hosted bracket games
How: Open Games -> Watch; tap row -> `/?view=spectate&gameId=`; open viewers roster via spectators endpoint when exploring who watches.

## Spectate center
Who: Anyone for public games; private Community cup games need organizer or approved entry
What: Board 2D/3D, seat clocks read-only, move history scrub, activity/match log panel, chat per join rules
Where: `/?view=spectate&gameId=` (legacy `/spectate` redirects)
WS: spectate socket; token optional for public, required for private authz

## QR / join URL
Games expose join-url pointing at spectate view; QR PNG warmed at create with brand mark; download filename from chrome.

## Votes
Who: Signed-in, not seated
What: One predicted winner per game; public tallies; after finish up to 10 random correct voters
Cannot: Guests casting; seated players casting (UI hidden + API reject)
WS vote_update sends public tallies only (clients keep own pick)
""")

add("""# 12. Friends, Requests, Presence

## Who
Signed-in players

## What
Pending friend_requests; accept/deny/cancel; friends list; remove friend; presence dots

## When
Building a social graph to challenge and message people you know

## Where
Players rail: Friends | Requests | DMs | All
Notifications: friend_request -> `/?rail=players&sub=requests`; accepted -> friends

## How
1. Search All with debounced server `q` (exact/prefix/contains then rating, stable id paging).
2. Send friend request.
3. Peer accepts/denies; sender can cancel pending.
4. already_friends is a stable API conflict code (not English prose).
5. Challenge and Message remain separate CTAs on cards/profiles.

## Presence
Heartbeat keeps Online. Active game marks Playing (including live seat rows).
""")

add("""# 13. DMs and Game Chat

## DMs
Who: Signed-in
What: One pending DM request pair; after accept, thread with text/emoji/images; reactions; read receipts pending->sent (single check) ->read (double check brand when peer seen); durable outbox with client_id idempotent retry
Where: Players -> DMs; compose deep link `/?rail=players&sub=dms` (+ dm/thread query)
How:
1. Message from hover/profile/compose.
2. Outbox paints pending bubble immediately; POST may retry safely.
3. Peer accepts request to open full thread.
4. Sender ticks: single check (sent) until peer read watermark; then double check brand (read). Never premature double-check from stale peer open.
5. Failed bubbles support tap-to-retry.
6. Emoji catalog is database-only (no hardcoded glyph lists).

## Game chat
Who: Seated players and joined spectators (auth + joined room)
What: Per game_id text/emoji/image; replies; reactions; seated toggle enable/disable; newest 100 ASC per fetch
Where: Live and Spectate chat panels; cup boards reuse same per-game chat (no separate tournament chat room)
Cannot: Post without auth/join; use non-allowlisted image URLs
""")

add("""# 14. Play Notifications Quick Map

| Kind | Opens |
|------|-------|
| match_found / invite_accepted / game_finished | `/?gameId=` |
| invite_received / declined / cancelled / expired | `/?view=match` |
| friend_request* | players rail requests/friends |
| dm_* | players rail dms (+ ids) |

Bell marks read before navigating.
""")

add("""# 15. Flutter Parity Notes

- Home + PlayRailPanel mirrors three tabs; AI in-place; PvP navigates MatchBoardPage.
- Matchmaking realtime scope shared; challenge accept session + OTP retry.
- SpectatePage; share URL same query shape.
- Chrome select sheets; compose followComposeMessageResult; SharedPreferences outbox.
- Bottom nav Home-first; dashboard opens portal intentionally.
- Board: pinch-zoom 3D, ai_thinking, abandon/stop, OTP-gated auto-start.
""")

add("""# 16. Play URL Reference

| Intent | Path |
|--------|------|
| Play home | `/` |
| Resume PvP | `/?gameId=&mode=pvp` |
| Spectate | `/?view=spectate&gameId=` |
| Matchmaking | `/?view=match` |
| Leaderboard | `/?view=leaderboard` |
| Status | `/?view=status` |
| Tournaments | `/?view=tournaments` |
| Open challenge | `/?challenge=` |
| Opponent prime | `/?opponent=&opponentId=&opponentRating=` |
| Players deep link | `/?rail=players&sub=friends\|requests\|dms\|all` |
| Games rail | `/?rail=games` |
| Profile page | `/players/{id}` |

Legacy: `/play`, `/matchmaking`, `/spectate`, `/leaderboard`, `/tournaments` remap into hub/query forms.
""")

add("""# 17. Step-by-Step Scenarios

## Scenario A - Two accounts queue in under a minute
1. Account A signs in; joins queue.
2. Account B signs in; joins queue.
3. Both receive match_found; both open board with default clocks.
4. Make three moves each; confirm clocks decrement only on active seat.
5. A resigns; B wins; history shows the game.

## Scenario B - 60-second invite flag drill
1. A invites B with 60s preset, rated on.
2. B accepts; both clocks show ~60s.
3. A runs out without moving; client claims flag; server ends clock_flag; B sees Won on time from play_chrome (never generic You won); career/arena finalize once.
4. Refresh B's board; result persists; clocks do not reset to full.

## Scenario C - Open challenge link
1. A creates open link; copies URL.
2. C (signed in) opens URL; accepts.
3. Game starts for A and C.
4. Second person opening same token fails appropriately after first accept.

## Scenario D - Spectate + vote
1. A vs B playing public PvP.
2. Guest G opens Watch -> Spectate; cannot vote.
3. Signed-in S opens same spectate; casts vote for A; sees tallies.
4. A wins; correct voters sample may include S.

## Scenario E - Friends and DM outbox
1. A requests B; B accepts.
2. A messages B; kill network mid-send; pending/failed appears.
3. Restore network; tap retry or auto drain; receipt progresses to read after B opens.

## Scenario F - Guest blocked from queue
1. Guest opens Matchmaking; join fails / sign-in required.
2. Guest starts AI successfully.
3. Guest signs in; queue works.
""")

add("""# 18. Troubleshooting FAQ

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| Cannot join queue | Guest/OTP/auth/Redis | Token type; OTP; service health |
| VS-AI missing | Flag off | Feature flags |
| Invite TC rejected | Not a preset | Progression presets |
| No match_found | Solo or left | Two-account test |
| Clock 0 but playing | Server not flagged yet | Wait claim/sweeper |
| Clock reset on refresh | Bug if rewound | Capture before/after state |
| Queue vs invite different times | Different TC sources | Default vs preset |
| Cannot post chat | Not joined / disabled / auth | Seat vs spectate rules |
| Cannot vote | Guest or seated | Sign in; leave seat |
| Watch empty | Only AI or private cups | Need public PvP |
| Private spectate denied | Authz | Organizer/entrant |
| Friend already_friends | Already connected | Expected code |
| Challenge link dead | TTL expired | invite_ttl_seconds |
| Sign-in loop | OAuth path mismatch | auth_providers vs env paths |
| Outbox stuck pending | Drain not resumed | Reopen Players DMs; retry |

## Support checklist
1. Guest vs signed-in?
2. Flags: VS-AI, OTP?
3. Match clock enabled + presets?
4. Reproduce queue with two accounts.
5. Reproduce invite accept with short preset.
6. Confirm spectate URL vs seat resume URL.
7. Lab expire-clock tools only when DAMA_ALLOW_E2E_AUTH=1.

## Related
Complete App Guide; Competition Formats Guide for cup Ready/arena queues (different from global Find Match).
""")

text="".join(parts)
assert "\u2014" not in text
OUT.write_text(text, encoding="utf-8")
print(OUT.stat().st_size)
