# -*- coding: utf-8 -*-
"""Append dense sections so each companion reaches 25KB+."""
from pathlib import Path

G = Path(__file__).resolve().parents[1]

PLAY_EXTRA = r'''

# 19. Seat Clocks UX Explained Like a Scoreboard

Think of each seat clock like a chess clock beside the board.

1. When the game starts (and match_clock is enabled), both clocks get the same starting seconds (queue/AI/default cup path) or the invite preset seconds.
2. Only the player whose turn it is loses time.
3. After you complete a move, the server may add increment seconds back to your clock.
4. Your phone draws the numbers smoothly, but the server is the scoreboard of record.
5. If you refresh, you should see nearly the same remaining time the server had - not a brand new full clock.
6. If your display hits 0:00, your app asks the server to flag. If the server still thinks you have time, the game continues.
7. Spectators see the same clocks but cannot press flag and cannot make your clock run faster by watching.

## Practice drill for support
1. Start a 60-second invite game.
2. Do not move on account A.
3. Watch A hit 0:00 and lose by flag.
4. Refresh both clients; result stays finished.
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
Update when match_clock, play rail, friends/DM, spectate votes, or queue behavior changes. Keep hyphens only. No invented features.
'''

COMP_EXTRA = r'''

# 21. Organizer Runbooks by Format

## Knockout runbook
1. Create size power-friendly (8/16/32) when possible to reduce bye confusion.
2. Share invite early; kick ghosts before Start.
3. Remind players to check in.
4. Start; paste bracket screenshot to your chat group.
5. Watch Ready timeouts; force-start only when policy allows.
6. After final, share result card; wait settle.

## Round robin runbook
1. Keep fields small (4-8) because game count grows fast.
2. Publish expected game count to players (n*(n-1)/2).
3. Start; players grind the slate; champion is standings leader at the end.
4. Do not expect early elimination drama - everyone keeps playing.

## Swiss runbook
1. Confirm admin rounds map for your max size before advertising "3 rounds" or "5 rounds".
2. Explain byes to odd counts.
3. After each round completes, announce new pairings.
4. Final standings decide placements for payout mode.

## Groups+KO runbook
1. Tell players group size and advance count come from platform catalog (you cannot change them).
2. Start; publish group lists.
3. Require all group games finished before expecting KO.
4. When KO appears automatically, treat it like a normal knockout from there.

## Arena runbook
1. Set duration; announce hard stop time.
2. Explain points (win/draw/loss/streak) from admin settings.
3. Players should re-queue quickly between games.
4. If chaos, force finish; then settle.

# 22. Admin Catalog Change Checklist

Before editing Events catalog in production:
1. Snapshot current sizes/formats/fees/Swiss map/groups rules.
2. Disable a format before removing it from marketing.
3. Change Swiss rounds map only between seasons if players already enrolled expecting N rounds.
4. Changing groups size/advance mid-season confuses organizers who already advertised structure.
5. After save, create a staging Community cup per enabled format and Start with test accounts.

# 23. Player FAQ (Competition)

Q: I joined but I am not in the bracket.
A: Classic formats seed checked-in players at Start. If you missed check-in, you are out of the seed.

Q: We drew - why is there another game?
A: Classic formats rematch on draws instead of writing a terminal draw row.

Q: Why can't I join after the cup started?
A: Classic formats block post-start join. Arena may allow late join only if admin enabled it.

Q: Where is the Start knockout button for groups?
A: There is none. Promotion is automatic when every group match finishes.

Q: My private cup game is not on Watch.
A: Correct. Private bracket games are hidden from the public Watch rail.

Q: When do I get prize money?
A: After finish, dispute window, and settle (blocked if reports are open).

# 24. Official vs Community Side-by-Side Tasks

| Task | Official | Community |
|------|----------|-----------|
| Create | Admin | Organizer |
| Pay host fee | No | Yes |
| Start | Admin | Organizer |
| Enroll players | Players | Players |
| Kick before live | Admin tools / product | Organizer kick |
| Arena force finish | Console | Organizer/console |
| Catalog fees | Admin sets | Organizer pays/picks |
| Discovery | Official tab | Community or code |

# 25. Payout Mode Teaching Examples (non-technical)

Assume frozen pot = 1000. Full chapter: Part K2 in this Formats Guide.

## Place percent (places_percent) - podium envelopes
Who: cups that only care about final place.
What: percents on 1st / 2nd / 3rd (must sum to 100).
Example 50/30/20: 1st 500, 2nd 300, 3rd 200.
Why: easy to explain at the door.
Ignores: points that do not change place.

## Share-score (score_share) - scoreboard pie
Who: cups where points are the fairness story (often arena).
What: each sharer gets (their points / total points) of the pot.
Example points 10, 6, 4 (total 20): 500, 300, 200.
Knockout note: early-round winners can still hold phase points after they are eliminated, so they can still share.
Why: money follows effort on the scoreboard, not only the Final medal.

## Dual purse (dual_purse) - two cash boxes
Who: cups that want both podium drama and score fairness.
What: admin dual place percent splits the pot into a place purse and a performance purse.
Example dual place percent 60: place purse 600 (then 50/30/20 inside it), performance purse 400 (then by points).
A player can be paid from both boxes.
If total performance points are 0, product fails closed toward full-pot place behavior.
Why: reward finish place and strong overall scoring in one cup.

# 26. Ready Timeout Explainer

If one seat taps Ready and the opponent never does, a worker can auto-forfeit the no-show after competition_match_ready_timeout_seconds when auto-forfeit is enabled. Lobby shows ready_timeout_blurb from chrome. This applies to Official and Community classic matches.

# 27. Competition Support Severity

| Severity | Example |
|----------|---------|
| P0 | Prize double-pay; pot freeze stuck; settle with open reports |
| P1 | Start fails with full check-ins; groups never promote |
| P2 | QR download filename wrong; toast wording |
| P3 | Badge color / empty state copy |

# 28. Document Control (Competition Bible)
Update when catalog, engines, arena settings, payout modes, or hub URLs change.
'''

WALLET_EXTRA = r'''

# 19. Shell-by-Shell Money Map

## Player portal
`/wallet` top-up + payout + KYC entry; `/transactions`; `/receipts`; Settings compliance panels.

## Hosting nested
Same WalletWorkspace under `/events/wallet`, `/events/transactions`, `/events/receipts` with host fee and entry ledger kinds visible in history.

## Ads nested
`/ads/wallet` etc. Campaign create fee and payouts for publishers.

All three share one balance; moving between shells does not create a second wallet.

# 20. Provider Decision Tree (Support Script)

1. Is the client on private/loopback IP? -> treat as domestic defaults.
2. Is resolved country domestic ISO? -> Ethiopia path.
3. Is ethiopian_payment_mode `chapa`? -> local_checkout URL.
4. Is it `manual`? -> banks + receipt mandatory UI.
5. Else if non-domestic -> Paddle international_checkout.
6. If mode missing/invalid on domestic -> fail closed (do not invent).

# 21. KYC Desk Scripts

## Age
"Please confirm the age gate in Settings/Wallet before paid actions."

## Phone OTP off
"Save your phone in the cash phone panel; it should verify immediately."

## Phone OTP on
"Save phone, request the code, enter it, then retry top-up/enroll/payout."

## Document
"Upload clear ID front (and back for national ID/license), a selfie, legal name, and document type. Wait for admin review before payout."

# 22. Receipt Review SOP (Admin or Telegram)

1. Open pending receipt detail.
2. Match amount/currency/reference to bank statement.
3. Approve -> confirm wallet credit notification path.
4. Reject with reason -> confirm player sees review_note where UI shows it.
5. Never re-approve an already reviewed item (expect conflict).

# 23. Payout Review SOP

1. Confirm method phone present.
2. Confirm document KYC approved if required.
3. Approve -> status approved.
4. After real-world payout, mark paid.
5. If rejecting, ensure wallet refund succeeded in same transition.

# 24. Cup Money Timeline Example

1. Organizer pays host fee 50 on create.
2. Eight players pay entry 100 each (gross 800).
3. Commission 10% -> platform 80, organizer net 720 into pot accounting.
4. Optional guarantee hold 200 captured at Start.
5. Freeze pot; play; finish; dispute 24h; settle places.
6. Winners see wallet credits; transactions list kinds for prize.

# 25. Ads Money Timeline Example

1. Publisher create fee 25 debit on create.
2. Campaign serves 1000 impressions at unit cost 0.01 -> spend 10 against daily cap logic.
3. Publisher tops up when balance low.
4. Invoice PDF reflects create fee spend KPIs.

# 26. Wallet FAQ

Q: Why do I see ETB on my phone at home but USD on travel Wi-Fi?
A: Server geo from IP chooses currency/route. Profile flag country is not the pay-chain authority.

Q: I closed the top-up dialog and saw only a toast.
A: For manual_transfer that is a bug - banks and receipt upload must appear.

Q: Can Telegram reject without a reason?
A: No. Reason is required and stored.

Q: Does approving a receipt twice credit twice?
A: No. Atomic pending-only update; second review conflicts.

Q: Free cup asked me for payment.
A: Free uses Join silent enroll. Paid uses Enroll + modal. Confirm the cup fee fields.

# 27. Compliance Flags Desk Card

Keep this card on the ops wall:
- cash_rmg_enabled
- disabled_countries payload
- allowed_country_codes
- cash_phone_kyc_required
- cash_phone_otp_required
- require_document_kyc_for_payout (policy)
- global OTP separate

# 28. Document Control (Wallet Bible)
Update when geo, providers, KYC fields, Telegram bridge, or ledger kinds change.
'''

ADS_EXTRA = r'''

# 15. Admin Leaf Deep Dives (Operator Notes)

## Overview / Activity
Use Activity for trend health (DAU/WAU/MAU, heatmap). Overview for operational queues (pending receipts, avatars, open reports). Period select uses API default_period; do not invent first period client-side.

## Users
Search username/email/phone/id. Detail shows DOB/KYC and payout methods. Confirm dialogs for role and active changes. Copy controls for ids.

## Avatars
Moderate pending uploads; bulk tools available. Notify player on review.

## Payments leaves
Work receipts before payouts when liquidity ops require it. Always leave review_note on rejects. Use Transactions to audit ledger after a dispute.

## Banks
After secret key rotation, re-enter account numbers. Players must never see sealed ciphertext.

## Tournaments / Events / Progression
See Competition bible for formats. Progression also owns match_clock and ad_pricing - coordinate with Play and Ads owners before changing unit cost.

## Ads runtime
Global non-skippable and pacing. Console can patch campaign schedule/status for any publisher campaign with ads.manage_campaigns.

## Media pool
Register channels/quotas before large creative pushes.

## Feature flags / RBAC / Telemetry
Flags first for market launches. RBAC only for superadmin changes. Telemetry when investigating abuse/fraud.

# 16. Publisher Analytics Literacy

| Metric | Plain meaning |
|--------|---------------|
| Impressions | Times a creative was recorded shown |
| Reach | Distinct reach KPI from dashboard when provided |
| Clicks | Click events |
| CTR | Clicks / impressions style percent from server |
| CPC | Cost per click derived with unit cost and currency |
| Completion | Completion percent KPI |
| Create fee spend | Sum of create fees |

If counters stay zero: campaign not servable, schedule off, geo mismatch, or no eligible live games.

# 17. Eligibility Failure Reasons (Plain)

Operators may see reasons like period_cap_reached or spend cap reached. Teach publishers:
1. Wait for next UTC period if period capped.
2. Raise daily_spend_cap or top up economics understanding (unit cost * impressions).
3. Widen geo_targets carefully (server stamps country from pin).
4. Ensure first-show delay elapsed since game start.

# 18. RBAC Change SOP (Superadmin)

1. Open `/rbac` Catalog/Permissions/Grants tabs.
2. Prefer granting existing permissions to admin role over inventing new keys.
3. Never delete protected permissions.
4. After grant changes, have the admin refresh and open the target leaf.
5. Smoke with e2e-rbac-ads when DAMA_ALLOW_E2E_AUTH=1 in staging.

# 19. Daily Ops Timeline Example

09:00 Clear receipts/payouts/KYC.
09:30 Confirm Telegram Ready.
10:00 Skim Official live cups + hosted reports.
10:30 Ads runtime + stuck campaigns.
11:00 Feature flags / users tickets.
16:00 Re-check money queues.
17:00 Activity glance for anomalies.

# 20. Ads + Admin FAQ

Q: Can I reopen an ended campaign?
A: Not if auto_closed after ends_at. Create a new campaign.

Q: Why does lobby show an ad but in-match does not?
A: In-match also requires schedule_enabled and timing/cap gates; lobby uses geo serve path.

Q: Who changes CPC economics?
A: Admins set impression_unit_cost on Progression; publishers consume it.

Q: Why is Ads nav missing on Flutter?
A: client_nav bottom_nav.ads incomplete - fail closed until chrome fixed.

Q: Can Telegram approve campaigns?
A: No. Telegram is money review only.

# 21. Permission Cheat Sheet for New Admins

| Job | Need |
|-----|------|
| Money reviewer | payments.review |
| Cup operator | tournaments.write (+ events perms as needed) |
| Catalog editor | events.manage_catalog |
| Report moderator | events.manage_reports |
| Clock/pricing editor | progression.write |
| Ads ops | ads.manage_runtime and/or ads.manage_campaigns |
| Flag editor | feature_flags.write |
| Access manager | rbac.manage |
| Analyst | activity.read |
| Security vault | telemetry.read |

# 22. Document Control (Ads & Admin Bible)
Update when console_nav sections, RBAC seeds, ad_playback defaults, or publisher routes change.
'''

def expand(name: str, marker: str, extra: str) -> None:
    path = G / name
    assert "\u2014" not in extra
    text = path.read_text(encoding="utf-8")
    if marker not in text:
        path.write_text(text + extra, encoding="utf-8")
    print(f"{name}: {path.stat().st_size}")

expand("Dama_Play_And_Matchmaking_Guide.md", "# 19. Seat Clocks UX", PLAY_EXTRA)
expand("Dama_Competition_Formats_Guide.md", "# 21. Organizer Runbooks", COMP_EXTRA)
expand("Dama_Wallet_Payments_And_Compliance_Guide.md", "# 19. Shell-by-Shell Money Map", WALLET_EXTRA)
expand("Dama_Ads_And_Admin_Ops_Guide.md", "# 15. Admin Leaf Deep Dives", ADS_EXTRA)
