# Dama - Play and Matchmaking Bible
Guest, Player, Spectate, Friends, Chat, Timer, Stop Game

Non-technical bible. Who / What / When / Why / Where / How everywhere.

## 1. Who this bible is for
- Guests trying VS-AI
- Players using queue, invites, friends, chat
- Spectators
- Support explaining why a game started or did not

Host trust / scammer protection (Community cups only, not VS-AI or casual bots):
- Paid cups: host must verify phone, stay under open-cup limits (new 1 / phone 3 / ID 25), and not be blocked by reports or cancel rate (mig 522 to 529).
- Guaranteed prize cups: host must verify government ID and lock the promised floor in their wallet at create. Cancel before start unlocks it; start commits it to the pot.
- Players see Unverified host / Phone verified / Verified host on cup cards, hoster pages, profiles, dashboards, inspect, leaderboard / players rail when stamped, Watch seats/spectators, match-history seats.
- KYC auto-approve (default ON) approves ID right away; OFF means manual Payments → KYC.
Full human bible: `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.

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
3. Pick Time from the same match_clock presets as Challenge / matchmaking (default is Admin → Progression default time control, currently 3 min when set to 180 seconds).
4. Start (guest ticket minted if needed). Server requires `time_control_seconds` in presets for AI start.
5. Clocks arm from the chosen preset when clocks enabled.
6. Move on your turn; computer replies.
7. Stop game: confirm -> server abandon/resign when a game id exists -> success toast -> return to Play lobby for embedded practice.
8. If stop fails, you should see a load/stop failure message (not Play chrome unavailable) and still return to lobby for embedded AI.

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
6. Ends by board win, resign/abandon, cup forfeit, or flag-fall (clock_flag is a real win with points).
7. On flag-fall / clock_draw, seated UI shows database "Won on time" / "Lost on time" / "Draw on time" - never a generic "You won" (including the short board-status / seat-hint window before the finished overlay; turn hints stay off while the clock owns the end). Clients do not invent a board-wipe winner over a clock ending.
8. Concurrent flag claims finalize once (single-flight) so career/arena points cannot double-apply.

Spectators: watch only; do not claim clock flag. Spectate status uses database "White/Black won on time" / "Draw on time."

## 7. Timer detail for support
Q: Does 0:00 end the game?
A: Yes, when the server confirms the side to move has no time left (flag-fall). The flagged seat loses; opponent wins on time. Rare bare king vs bare king may draw on time (end_reason clock_draw, draw_reason insufficient_material).

Q: Why does the board say "Won on time" instead of "You won"?
A: Flag-fall keeps the decisive result and points, but copy must say it was on time (play_chrome you_*_on_time_message; play_rail / play_chrome on-time aria for overlays). Board wipe detection must not invent a different winner over a clock ending.

Q: Refresh reset my clock?
A: It should not. Reconnect loads remaining time after server update.

Q: Queue vs invite times differ?
A: Expected. Queue = platform default. Invite = chosen preset.

## 8. Friends and DMs
How: Search All -> friend request -> accept/deny/cancel -> Message opens DM.
Game chat: per match; seated players can disable chat; images follow media rules.

## 9. Pause / Resume

### 9a. Player pause
Who: Any seated player (and unbound VS-AI human), when admin enables pause
What: Freeze both clocks and block moves until Resume or the admin-set pause duration ends (`pause_kind=player`)
When: On the board Pause control, or automatically when you leave the board while a live match is playing
Why: Step away without burning time or allowing opponent/AI moves
Where: Web + Flutter boards; floating Resume while browsing other pages; admin Progression sets duration (number + Seconds/Minutes)
How:
1. Admin turns pause on and sets max pause length in Progression (number + Seconds or Minutes unit - not a calendar date picker).
2. Seated player taps Pause (hidden when pause is disabled).
3. Server freezes clocks, stores pause_expires_at, blocks moves/flag/AI, stamps `pause_kind=player` + actor display name.
4. Board shows MatchIntro-style blur cover (VS seats + banner + who). Player pause adds countdown from `pause_remaining_fmt`; official pause adds reason/note/since and until-resume (no player countdown).
5. Leave the board → auto-pause (skipped when pause is disabled or an official pause is active). Web: `LeaveBoardPauseHost`. Flutter: tab dispose or covering push (`RouteAware`).
6. Floating Resume + countdown follows you while browsing (hidden during official pause); tap Resume to continue.
7. When the admin duration elapses, the server auto-resumes; clients clear the FAB after confirming state.
8. Works for VS-AI, queue/invite PvP, official tournament boards, and organizer hosted games (same server game state).
9. Leaving a finished board does not POST pause and does not show an error toast.

### 9b. Official pause (host / organizer / admin)
Who: Hosted-event organizer for boards linked to their event, or console role with RBAC `games.official_pause`
What: Freeze both clocks and block moves until an official resumes (`pause_kind=official`; no auto-resume)
When: Organizer Manage Event bracket/live actions, admin tournament control room, or `POST /games/{id}/official-pause`
Why: Ops (tech, dispute, stream delay, fairness) without ending the match
Where: Web organizer + player board; Flutter organizer + board; admin tournaments (control room filter + pause/resume/meta); audit in `match_official_pause_events`
How:
1. Official picks a DB reason (`official_pause_chrome.reasons`) and optional note, then confirms.
2. Server freezes clocks, clears auto-resume deadline (`pause_expires_at=0`), stamps actor role/name/reason/note, audits the event, broadcasts `game_state`.
3. Players and spectators see the same blur VS board cover (MatchIntro parity). Official pause shows status, official blurb banner, who, reason, note, since time, and until-resume footer. Player pause shows status, game_paused_blurb banner, who, and countdown (`pause_remaining_fmt`) only (no wall-clock since). Spectate rails fall back to banner/blurb when overlay chrome/VS is incomplete. On resume, a dismissible "Resumed by {role} · {name}" banner appears (plus toast). Activity strip (seated players, organizers/admins, and former seats after finish) shows pause/resume/meta audit; signed-in spectators who are not a seat see the blur cover only. Officials can update reason/note via `POST /games/{id}/official-pause-meta` while paused (omit `note` keeps the existing note; send `note: ""` to clear). Both seats get in-app notify (`player.official_pause` / `player.official_resume`). Player Resume and Stop/resign are hidden; seat pause/resume/abandon APIs return `err_officially_paused` (player pause still allows Stop). Organizer Manage Event live tab and admin control room can filter officially paused boards and show Live / Player pause / Official pause labels from `official_pause_chrome`, plus frozen/since/duration and meta; dashboard KPI counts currently officially paused boards plus avg completed official pause seconds. Pause audit history remains available after the board finishes (DB trail; Redis eviction safe). Scope: any live board linked to that organizer's hosted event (or any board for RBAC admin). Default action is per-match; optional bulk round pause uses the same per-match core.
4. Only an authorized official can resume (`POST /games/{id}/official-resume`); clocks continue from remaining time.
5. Applies to every board the organizer owns for their event, and any board for admins with the permission.
6. Bulk round pause: organizer/admin confirms once with a shared reason; server pauses each live board in that round via the same per-match official-pause core (already-paused boards skipped). Web + Flutter hosted event live tab support event bulk; tournament bulk is admin/API. Selection bulk: `POST /games/official-pause/bulk` with `game_ids` and `POST /games/official-resume/bulk` (mig **518** chrome; mig **519** ASCII heal for pending/activity/banner joins). Admin Live boards uses OpsDataTable row-actions menu (Copy / Pause / Resume / Meta / Pause round) plus checkbox selection toolbar (incl. Select all). Host manage (web + Flutter) uses the same menu + Select all + selection bulk on the live tab. Tournament detail control room uses the same row-actions menu for Copy / Pause / Meta / Resume. Menu trigger is fail-closed on `actions_menu_label` only (no `col_actions` invent); mig **518** selection/menu/resume-toast keys are required for official-pause chrome-ready on admin/web/Flutter (API `OfficialPauseChrome` required list matches). Mig **520** heals `reasons` when stored as a JSON string so the public chrome endpoint stays fail-closed array-shaped. Mig **521** adds `live_boards_empty` for admin/web/Flutter empty live boards (OpsDataTable / host live tab). Device push is not wired; seats get in-app notify only.

## 10. Stop game / abandon
Who: Seated player (not while officially paused)
What: Resign the match so opponent wins (AI counts as human loss)
How: Stop -> confirm -> server abandon -> success message -> finished screen or lobby for embedded AI
While officially paused: Stop is hidden on web/Flutter; `POST /games/{id}/abandon`, move, and clock-flag return Conflict/WS error with `error_key` `err_officially_paused` (player pause uses `err_game_paused`; WS pause rejects leave `error` empty so clients map chrome only; player pause still allows Stop).
If abandon fails: show load-failed style message; embedded AI should still exit to lobby.

## 11. Common failures
| Symptom | Likely cause |
|---------|--------------|
| Cannot join queue | Guest, missing OTP, signed out |
| Invite time rejected | Preset not in match_clock presets |
| Clock still running on claim | Client hit 0 early; server still has time |
| No match_found | Alone in queue or left queue |
| Stuck on tournaments after AI click | Browse view not cleared - should go to `/` |
| Play chrome unavailable on whole page | Required DB play labels missing |
| Play chrome unavailable on Stop only | Wrong error label (should be load/stop failed) |
| Pause control missing | Admin turned pause off, or play_chrome pause labels missing |
| Leave board does not pause | Pause disabled; guest/sign-in token missing; or Flutter leave before board mounted |
| Floating Resume missing while paused | Chrome label/aria missing; still on board surface; session lost expires; or official pause (FAB intentionally hidden) |
| Player cannot resume | Official pause active - only organizer/admin can resume |
| Official pause button missing | Not organizer of that event; missing `games.official_pause`; or organizer/tournament chrome keys missing |
| Blur pause cover missing | `pause_overlay_*` / intro VS / `role_player_label` (mig 507) chrome missing; or play_chrome fail-closed |
| Toast "game already finished" on leave | Should be silent - finished session / leave-pause silent errors; check leave-pause host + session phase |
| Board shimmers every Soft nav back | Keep-alive / session `game-state` cache missed; hub remounted instead of hidden |

## 12. Support checklist
1. Signed-in vs guest
2. VS-AI and OTP flags
3. match_clock enabled + presets
4. Two accounts queue pair
5. Invite accept with 60s preset
6. Stop from embedded AI returns to Play home
7. Pause on → leave board → FAB Resume → auto-resume after admin duration
8. Finished board → leave → no error toast; Soft nav Play ↔ Spectate keeps board paint (no shimmer)


# 19. Seat Clocks UX Explained Like a Scoreboard

Think of each seat clock like a chess clock beside the board.

1. When the game starts (and match_clock is enabled), both clocks get the same starting seconds (queue/AI/default cup path) or the invite preset seconds.
2. Only the player whose turn it is loses time.
3. After you complete a move, the server may add increment seconds back to your clock.
4. Your phone draws the numbers smoothly, but the server is the scoreboard of record.
5. If you refresh, you should see nearly the same remaining time the server had - not a brand new full clock.
6. If your display hits 0:00, your app asks the server to flag. If the server still thinks you have time, the game continues.
7. Spectators see the same clocks but cannot press flag and cannot make your clock run faster by watching.
8. When the server ends on clock_flag / clock_draw, seated players see "Won on time" / "Lost on time" / "Draw on time" from the database (not a plain "You won"), and competition/career points still apply on a decisive flag-fall.

## Practice drill for support
1. Start a 60-second invite game.
2. Do not move on account A.
3. Watch A hit 0:00 and lose by flag; B should see "Won on time."
4. Refresh both clients; result stays finished with the same on-time framing.
5. Repeat with a queue game using default TC and note the different starting seconds if default is not 60.

# 20. New Game Rail Field-by-Field

## AI tab
- Depth select: only allowed depths from feature flags.
- Start CTA: starts in-place board session.
- Stop: resign practice seat.

## Challenge tab
- Opponent typeahead: server search, not a local-only list.
- Open link toggle/mode: creates share_token challenge URL.
- Rated toggle: on/off for career.
- Color: white, black, or random.
- Time preset: must be in match_clock.presets.
- Send / copy link CTAs.
- Find Match link: jumps to matchmaking center for queue.

## Games tab
- Watch: live public PvP rows with viewers and search.
- History: your matches with resume when still live.

## Players tab
- Friends list with search.
- Requests dual-side pending with accept/deny/cancel.
- DMs list and compose.
- All players search with relevance ordering.

# 21. Matchmaking Center Details

Who: Signed-in players
What: Queue controls plus direct invite block on the same surface
Where: `/?view=match`
How:
1. Join/leave queue buttons with pending labels from chrome.
2. Queue size readout when provided.
3. Direct invite username typeahead + TC/rated/color - same rules as Challenge tab.
4. Outgoing invite wait state disables queue join until resolved.
5. Incoming invite dialog can appear over this view via realtime.

# 22. Profile & Hover Card Play CTAs

From PlayerHoverCard, profile modal, and `/players/{id}`:
- Add Friend / Challenge / Message / Watch (when playing)
- Country flag image from DB template `{code}` substitution
- Username (rating) ordering Chess.com-style
- Friends count and friends preview on profile page
- Match history enriched with opponent cards and move counts
- Algebraic move log on inspected games

# 23. Live Watch Row Anatomy

A Watch row typically shows:
1. Both seat faces (rounded) with hover actions
2. Ratings/flags when hydrated
3. Time control label from presets
4. Spectator count and viewer sample stack
5. Overflow +N for extra viewers
6. Game id truncated per chrome
7. Tap opens spectate; viewers panel can open roster search

# 24. Chat Quality Rules (Support)

1. Images only through allowlisted chat upload path (Cloudinary dama/chat).
2. Non-image uploads reject.
3. Emoji picker uses DB catalog only.
4. Read receipts: UI never invents ticks - glyphs from chrome.
5. Game chat disable: seated control; history policy when disabled still follows product.
6. Compose-from-secondary-entry navigates to Players DMs so outbox shell appears before POST resolves.
7. Idempotent client_id means double-tap send should not duplicate the real message.

# 25. OTP & Play Matrix

| Action | OTP when global flag on |
|--------|-------------------------|
| Join queue | Yes |
| Create/accept invite | Yes |
| Token accept open challenge | Yes |
| Move | Yes |
| Pause / Resume | Yes |
| Abandon | Yes |
| Guest VS-AI | Guest JWT path skips account OTP |
| Spectate public | No |
| Browse Watch | No |

# 26. Extended Play FAQ

Q: Why did my queue game use 10 minutes but my invite used 1 minute?
A: Queue uses platform default initial_seconds. Invites use the preset you picked.

Q: Can I play rated VS-AI?
A: VS-AI is practice. Rated career is for rated PvP (queue always; invites when rated on; cups per flag rules).

Q: Why is the AI game missing from Watch?
A: Watch lists unfinished public PvP only. AI is excluded on purpose.

Q: I accepted an invite but no board opened.
A: Check OTP overlay, websocket connectivity, and whether invite expired (TTL). Try opening `/?gameId=` from the invite_accepted notification.

Q: Spectator chat says I cannot post.
A: Sign in and ensure you joined the spectate room; private cups need membership.

Q: Friend request says already_friends.
A: You are already connected. Use Challenge or Message instead.

# 27. Play Support Severity Guide

| Severity | Examples | First checks |
|----------|----------|--------------|
| P0 | Clocks rewind on refresh; double rated results | Capture game_id, before/after state |
| P1 | Queue never pairs with two waiters | Redis/auth/OTP; WS match_found |
| P2 | Chat outbox stuck; vote cast fails for eligible user | Auth, join state, chrome |
| P3 | Label missing / shimmer forever | Chrome fail-closed; feature flags |

# 28. Document Control (Play Bible)
Update when match_clock, pause/resume, play rail, friends/DM, spectate votes, or queue behavior changes. Keep hyphens only. No invented features.
