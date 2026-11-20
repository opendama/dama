# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "Dama_Complete_App_Guide.md"
extra = r'''

# 19. Deeper Audience Walkthroughs With Real Examples

## 19.1 Guest evening on web
Who: First-time visitor on a laptop
What: Learn the board without an account
When: Marketing link lands on `/`
Why: Decide whether to sign in
Where: Play home only
How:
1. Land on `/`. See lobby board and New Game rail.
2. Open Games -> Watch. If public PvP games exist, open one into Spectate (`/?view=spectate&gameId=`).
3. Return to New Game -> AI. Pick an allowed depth. Start practice. Guest practice token is created quietly.
4. Try Stop game to resign the practice seat.
5. Open Tournaments hub (`/?view=tournaments`). Browse Official and Community cards. Attempt Join - sign-in is required.
6. Tap Sign in with Google. After OAuth complete shimmer, return to Play with a full session.

## 19.2 Signed-in social night
Who: Returning player with friends
What: Mix of queue, challenge, DM, and spectate vote
When: After work
Why: Rated play plus social graph
Where: Play rail Players + Matchmaking
How:
1. Open Players -> All. Search a username (server relevance search). Send friend request.
2. Open Requests when notified (`/?rail=players&sub=requests`). Accept.
3. Message the friend (`/?rail=players&sub=dms`). Send text and an image allowed by chat media rules.
4. Challenge them with rated on, color random, 180-second preset.
5. While waiting, remember queue is separate from invites and is always rated with default clocks.
6. After the challenge is accepted, play. Open game chat. Opponent may disable chat - history rules still apply per product.
7. After the game, spectate another public match and cast a win vote (you are not seated).

## 19.3 Official cup weekend (player)
Who: Enrolled Official player
What: Check-in through prize credit
When: Admin-scheduled cup
Where: `/?view=tournaments&id=`
How:
1. See `player.tournament_created` notification -> open lobby.
2. Free Join or paid Enroll. Paid path opens payment modal; shortfall may deep-link wallet top-up.
3. When check-in opens, check in. Missing check-in means no classic bracket seat.
4. Admin Starts. Your KO match appears. Both seats Ready. Board opens with clocks.
5. Win through rematches on draws as designed. Engagement points toast may appear.
6. Cup finishes. Dispute window runs. Prize settles to wallet. Open Transactions.

## 19.4 Private Community invite (participant)
Who: Friend invited by QR
What: Private cup access without public listing
When: Organizer shares code
Where: Invite URL with `source=community&code=`
How:
1. Open invite on phone. Sign in if needed (OAuth must not steal the join `code` as an auth code).
2. Join (auto-approved). Private details now visible because you are an entry.
3. Check-in / Ready / play. Attempt to find the game on public Watch - private bracket games stay hidden.
4. Spectate only if allowed for private games (organizer or approved entry).

## 19.5 Hosting organizer day-of ops
Who: Community organizer
What: Roster hygiene through finish
When: Cup start day
Where: `/events/events` manage + dashboard
How:
1. Confirm host fee already paid at create. Review nested Hosting wallet balance.
2. Kick a no-show before Start (refunds paid entry; status kicked; they may rejoin fresh).
3. Start when min players and check-ins satisfied for classic format.
4. For groups+knockout: do not look for a manual "start knockout" button - promotion is automatic when all group matches finish.
5. For arena: announce end time; optional force finish; late join only if admin arena setting allows.
6. After finish, share result card PNG; review analytics gross/commission/net.

## 19.6 Publisher weekly campaign
Who: Ads publisher
What: Create through auto-close awareness
When: Promo week
Where: `/ads/campaigns`
How:
1. Check Ads wallet. Create campaign with pin in target city.
2. Pay geo create fee. Upload creative type from allowed enums.
3. Set schedule_enabled, first show, interval, daily/weekly caps, optional ends_at.
4. Set servable status. Confirm lobby placement and in-match eligibility separately.
5. Watch analytics KPIs (impressions, reach, clicks, CTR, CPC, completion, create fee spend).
6. If ends_at passes, campaign auto_closed - reopen is blocked; create a new campaign if needed.

## 19.7 Admin money dual-actuator conflict drill
Who: Console admin + Telegram reviewer
What: Prove first-writer-wins
When: Training
Where: `/payments/receipts` and Telegram
How:
1. Test player submits manual receipt.
2. Both reviewers open the pending item.
3. Telegram approves first. Wallet credits.
4. Console approve attempt returns conflict (already reviewed). Expected.

## 19.8 Superadmin access setup
Who: Superadmin
What: Grant a limited admin payments reviewer
When: Hiring ops
Where: `/users`, `/rbac`
How:
1. Open Users; assign console role `admin`.
2. On RBAC Grants (superadmin), ensure `payments.review` is granted to admin (default seed usually includes it).
3. Confirm the user cannot open RBAC manage if `rbac.manage` is superadmin-only.
4. Have them clear one receipt successfully.

# 20. Notifications Map (Player & Admin)

In-app bell notifications are database-backed. Click marks read then navigates. Titles/hrefs come from chrome.

## Player kinds (selected)
| Kind | Meaning | Typical deep link |
|------|---------|-------------------|
| player.match_found | Queue paired | `/?gameId=` |
| player.invite_received | Challenge arrived | `/?view=match` |
| player.invite_accepted | Game ready | `/?gameId=` |
| player.invite_declined / cancelled / expired | Invite ended | `/?view=match` |
| player.game_finished | Board finished | `/?gameId=` |
| player.friend_request* | Friend graph | Players rail requests/friends |
| player.dm_* | DM request/message | Players rail dms |
| player.wallet_credited | Money in | `/transactions?id=` |
| player.receipt_reviewed | Manual receipt decided | `/receipts?id=` |
| player.payout_updated | Payout decided | `/wallet?id=` (history; `focus=payout` is request form) |
| player.kyc_reviewed | Docs reviewed | `/settings` |
| player.tournament_created / status | Official lifecycle | `/?view=tournaments&id=` |
| player.competition_points_awarded | Engagement points | tournaments id |
| player.arena_* | Arena lifecycle | tournaments id |
| Community hosted lifecycle | joined/started/finished/kicked/... | Community hub with id/code |
| player.campaign_status / auto_closed | Ads status | `/ads/campaigns` |

## Admin kinds (selected)
| Kind | Meaning | Deep link |
|------|---------|-----------|
| admin.receipt_pending | Manual receipt | `/payments/receipts?receipt=` |
| admin.payout_pending | Payout request | `/payments?payout=` |
| admin.kyc_pending | Document KYC | `/payments?kyc=` |
| admin.avatar_pending | Avatar moderation | `/avatars?user=` |
| admin.campaign_auto_closed | Ads worker | Ads console |

# 21. Hall of Fame, Status, Presence

## Hall of Fame / leaderboard
Who: Guests and players
What: Period tabs (week/month/year/all) for rated wins; all-time rating ladder; Your Rank when signed in
Where: `/?view=leaderboard`
Why: Celebrate rated career, not cup standings points
Note: Period HoF counts rated=true wins only.

## Platform Status
Who: Anyone
What: Community activity analytics (usage series, heatmap, cumulative games, breakdowns) without admin-only new_users series
Where: `/?view=status`

## Presence
Online heartbeat about 90s TTL; Playing derived from active game. Lists and seat bars show Online / Playing / Offline using chrome labels.

# 22. Web vs Flutter Parity (Player-Facing)

| Area | Web | Flutter |
|------|-----|---------|
| Play shell | HomePlayHub + rail | HomePage + PlayRailPanel |
| VS-AI | In-place embed + guest token | In-place AI token; PvP pushes MatchBoardPage |
| Matchmaking | `/?view=match` | MatchmakingPage |
| Spectate | center view | SpectatePage |
| Clocks | useServerMatchClocks | match + spectate timers gated on server clock_active |
| Portal | `/dashboard`... | DashboardPage + routes |
| Hosting | `/events/*` | events_shell |
| Ads | `/ads/*` | PublisherShell from client_nav |
| Receipts | HTML print + PDF download | PDF share sheet |
| Chat outbox | localStorage | SharedPreferences |
| Theme | system/light/dark | ThemeCubit |

# 23. Money Touchpoints Across the Product (Map)

| Action | Who pays / receives | Shell |
|--------|---------------------|-------|
| Wallet top-up | Player funds wallet | Portal / Hosting / Ads wallet |
| Manual receipt approve | Credits player | Admin or Telegram |
| Official/Community paid enroll | Player debit; organizer net on Community | Cup join |
| Host fee | Organizer debit | Hosting create |
| Prize guarantee hold/capture | Organizer | Hosting create/start/finish rules |
| Prize settle | Winner credit | After dispute |
| Campaign create fee | Publisher debit | Ads create |
| Impression spend / caps | Publisher budget | Ads delivery |
| Payout request | Player debit pending | Wallet |
| Payout reject | Refund wallet | Admin/Telegram |

VS-AI and casual non-entry PvP do not charge entry fees. Free cups use Join without payment modal.

# 24. Feature Flags Players Feel

| Flag | Player-visible effect |
|------|----------------------|
| VS-AI practice mode | AI tab available; depths allow-list |
| Global OTP | Extra verify step on play/money writes |
| Ethiopian payment mode | chapa vs manual for domestic |
| Cash / RMG | Paid enroll/top-up/payout allowed |
| Cash phone KYC / Cash phone OTP | Phone compliance path |
| Hosted events | Host CTA / Hosting shell |
| Public events | Community public list |
| Public event matches rated | Career rating on public cup boards |
| Prize pool display / guarantee | Pot UI and organizer guarantee toggle |

# 25. Extended Troubleshooting Playbook

## Play
1. Confirm token type: guest practice vs account.
2. Confirm flags and OTP session.
3. For clocks: compare Admin Progression default vs invite preset.
4. For spectate empty Watch: only public unfinished PvP listed.
5. For chat post denied: not joined / chat disabled / unauthenticated.

## Cups
1. Confirm Official vs Community id.
2. Confirm check-in before classic Start.
3. Groups+KO: wait for all group matches before expecting KO.
4. Arena: confirm arena_ends_at and queue join; late join flag.
5. Private access: code/QR membership.
6. Prize missing: dispute window, open reports block, settle worker/console.

## Money
1. Geo: private IP often domestic/manual in local dev - not Paddle.
2. Manual must show banks+upload - toast-only is a bug.
3. Banks ciphertext after key rotate: re-save in Admin Banks.
4. Payout: phone length 8, doc KYC, cash allowlist, age, fresh locate.
5. Telegram: Ready fields + admin IDs + public API URL.

## Ads
1. Create fee geo from pin/pay geo.
2. Servable + schedule_enabled required for in-match period caps path.
3. Eligibility uses server geo.
4. auto_closed cannot reopen.
5. Placement must be lobby or in_match DB keys.

## Admin
1. 403: missing permission.
2. Blank chrome: incomplete platform_settings.
3. RBAC: cannot delete protected permission or strip last holder of protected key.

# 26. Master Glossary Addendum (Ops Phrases)

| Phrase | Meaning |
|--------|---------|
| Seed / catalog | Admin-configured sizes and formats organizers pick from |
| MarkLive | Hosted cup moves to live after Start path |
| Freeze pot | Lock prize pool calculation before/at live rules |
| Dispute window | Wait time after finish before prize settle |
| Servable status | Campaign status enum value that allows delivery |
| Period cap | Impression limit per UTC day/week/month/year |
| Dual-purse | Prize split into place purse + performance purse |
| Score-share | Prize share by standings/arena points |
| Places percent | Prize by finish place percentages summing to 100 |
| Ready timeout | Auto-forfeit if one side Ready and other is late |
| Content-Disposition | Header that carries download filenames for QR/PDF |

# 27. Training Script - 90 Minute Onboarding

Minute 0-10: Glossary + apps table.
Minute 10-25: Guest VS-AI + sign-in + queue with two trainers.
Minute 25-40: Invite with 60s preset + flag-fall discussion + reconnect refresh proof.
Minute 40-55: Friends/DM/spectate vote.
Minute 55-70: Wallet manual receipt path + Telegram or console approve.
Minute 70-85: Create tiny Community KO + join + Ready.
Minute 85-90: Open Admin map + Ads dashboard read-only.

# 28. Final Quick Reference Cards

## Player card
Sign in Google -> Find Match or Challenge -> watch clocks -> Wallet if cups/ads -> Tournaments hub -> Portal for history.

## Organizer card
Fund wallet -> Host create from catalog -> Share link/QR -> Start -> Manage Ready/arena -> Analytics.

## Publisher card
Fund wallet -> Create+pin+fee -> Creative -> Schedule+servable -> Analytics -> Close (mind auto_close).

## Admin card
Currency/Geo/Banks -> Progression clocks -> Catalog/flags -> Money queues -> Cups health -> Ads runtime -> Telegram Ready.

## Telegram card
Ready bridge -> Receipt approve/reject(reason) -> Payout approve/reject/mark paid -> Never double-apply.
'''

assert "\u2014" not in extra
text = p.read_text(encoding="utf-8")
if "# 19. Deeper Audience Walkthroughs" not in text:
    p.write_text(text + extra, encoding="utf-8")
print("bytes", p.stat().st_size)
