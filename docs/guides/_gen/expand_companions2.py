# -*- coding: utf-8 -*-
from pathlib import Path
G = Path(__file__).resolve().parents[1]

COMP = r'''

# 29. End-to-End Story - Community Swiss Weekend

## Friday night (organizer Maya)
1. Maya opens Hosting, confirms wallet balance covers host fee.
2. Creates public Swiss cup, max 16, entry fee set from catalog guidance, payout places_percent.
3. Pays host fee; shares `/?view=tournaments&source=community&code=...` to a club chat.
4. Downloads QR for the venue poster.

## Saturday morning (players)
1. Fourteen players join and pay entry (auto-approved).
2. Maya waits for two more; kicks one duplicate account test seat and they rejoin cleanly.
3. Check-in window opens; thirteen check in.
4. Maya Starts. Only checked-in seats seed. Swiss rounds map says 4 rounds for max 16.

## Saturday afternoon
1. Round 1 pairings appear; both seats Ready; clocks arm; boards open.
2. One no-show hits Ready timeout and is forfeited.
3. Round completes; round 2 pairings generate.
4. Players watch standings between rounds.

## Sunday
1. Final round ends; standings freeze champion path for places%.
2. Dispute window begins; one report is filed then dismissed by admin.
3. Settle credits top places; Maya reviews Hosting analytics gross/commission/net.
4. Maya shares result card PNG.

# 30. End-to-End Story - Official Arena Night

1. Admin creates Official arena, duration 60, paid entry, score_share payout.
2. Players enroll from Official tab; notifications fire tournament_created.
3. Admin Starts; arena_ends_at set; pot freeze deferred to finish for platform arena.
4. Players join arena queue; worker pairs; streak points apply on consecutive wins.
5. Late joiner enters because allow-join-while-live is on.
6. Admin force-finishes five minutes early for venue closing.
7. Freeze at finish; escrow; dispute; settle by score_share.

# 31. Groups+KO Classroom Example (Names)

Players: A B C D E F G H.
Admin catalog: group size 4, advance 2.
Start shuffle example:
- Group 1: A C F H
- Group 2: B D E G
Each group plays RR (6 games).
Standings top 2 each: A,C and B,E.
KO semis: A vs B, C vs E; winners to final.
No one pressed "promote".

# 32. Competition URL Cheatsheet for Support

| Player says | You send |
|-------------|----------|
| Where are Official cups? | `/?view=tournaments` filter Official |
| I have a code | `/?view=tournaments&source=community&code=CODE` |
| My lobby | `/?view=tournaments&id=ID` |
| My board | `/?gameId=ID` |
| Watch | `/?view=spectate&gameId=ID` |
| I want to host | `/events/events?create=1` after sign-in |

# 33. Competition Bible Closing Checklist
- [ ] Catalog formats enabled match marketing
- [ ] Swiss map documented for organizers
- [ ] Groups size/advance documented as admin-only
- [ ] Arena settings reviewed
- [ ] Prize flags reviewed
- [ ] Sample cup per format started in staging
'''

WAL = r'''

# 29. End-to-End Story - First Paid Player

1. Noah signs in with Google on Flutter.
2. He opens Wallet; locate runs; domestic geo -> manual_transfer.
3. He sees bank list, copies account number, pays from his bank app.
4. He uploads receipt photo; status pending.
5. Telegram reviewer opens notify, checks amount, approves.
6. Noah gets receipt_reviewed + wallet_credited style notifications.
7. He enrolls in a paid Official cup; cash gates pass because phone KYC already saved (OTP flag off).
8. He later requests payout; blocked on document KYC; uploads ID+selfie; admin approves; payout request succeeds; admin marks paid.

# 30. End-to-End Story - Organizer Guarantee

1. Organizer has 500 wallet balance.
2. Host fee 40 + guarantee hold 200 required at create.
3. Create succeeds; 200 held.
4. Before Start, organizer cancels; guarantee released; entries refunded.
5. Alternate path: Start captures guarantee into pot; finish settles winners.

# 31. Banks & Secrets Desk Card

1. Admin Banks stores account_number/mobile_code sealed.
2. Players see plaintext only via server decrypt on banks list for manual_transfer.
3. Rotate DAMA_SECRETS_KEY -> re-save every bank row.
4. If players see gibberish, stop and re-save; do not tell them to "try anyway".

# 32. Notification Money Map

| Event | Player link | Admin link |
|-------|-------------|------------|
| Receipt submitted | (wait) | `/payments/receipts?receipt=` |
| Receipt reviewed | `/receipts?id=` | - |
| Wallet credited | `/transactions?id=` | - |
| Payout requested | `/wallet?focus=payout` form elsewhere | `/payments?payout=` |
| Payout updated | `/wallet?id=` history | - |
| KYC reviewed | `/settings` | `/payments?kyc=` |

# 33. Local Dev Money Expectations

Private IP invents domestic country -> usually manual or Chapa, not Paddle.
E2E auth labs may persist geo hints only when allowed.
Never teach producers that localhost equals USD/Paddle.

# 34. Wallet Bible Closing Checklist
- [ ] Currency + geo set
- [ ] Ethiopia mode explicit
- [ ] Banks saved after any key rotate
- [ ] Cash flags + allowlist match market
- [ ] Document KYC queue staffed
- [ ] Telegram Ready if used
- [ ] Sample top-up + payout + cup entry in staging
'''

ADS = r'''

# 23. End-to-End Story - Publisher + Admin Assist

1. Publisher Lila tops up Ads wallet via portal nested `/ads/wallet`.
2. She creates a campaign pinned to downtown; pays Ethiopia create fee.
3. Creative uploads; she forgets schedule_enabled; in-match never shows.
4. Admin with ads.manage_campaigns opens console Ads, enables schedule, sets first show 60, interval 300, daily impression cap 500, status servable.
5. Eligible live match shows overlay after 60s; skip locked for non_skippable seconds.
6. Cap hits period_cap_reached; next check waits for UTC day boundary.
7. Lila watches analytics CTR/CPC; closes campaign manually before ends_at.

# 24. End-to-End Story - Auto-close Week

1. Publisher sets ends_at for Friday 18:00.
2. Worker archives after expiry; auto_closed true.
3. Publisher notification campaign_auto_closed; admin also notified.
4. Publisher tries reopen -> blocked blurb.
5. Publisher duplicates settings into a new campaign for next week.

# 25. Console Navigation Training Script (30 min)

Minutes 0-5: Overview KPIs meaning.
Minutes 5-12: Sales receipts/payouts/KYC practice on staging.
Minutes 12-18: Competition tournaments list + events catalog read-only tour.
Minutes 18-24: Ads runtime form + one campaign override.
Minutes 24-28: Feature flags for the market.
Minutes 28-30: What you cannot do without rbac.manage.

# 26. Publisher Launch Checklist (Printable)

- [ ] Wallet funded above create fee
- [ ] Pin placed; pricing preview matches expectation
- [ ] Creative attached and previewed
- [ ] schedule_enabled on
- [ ] First show / interval understood
- [ ] Caps set intentionally (blank = unlimited)
- [ ] Status servable
- [ ] ends_at set or consciously omitted
- [ ] Test device in geo sees lobby and/or in-match
- [ ] Analytics non-zero after a real eligible game
- [ ] Invoice/receipt path known

# 27. Admin Ads Runtime Checklist

- [ ] non_skippable within min/max
- [ ] platform first show / interval defaults sane
- [ ] impression_cap_min understood
- [ ] ad_pricing unit cost and dual create fees set on Progression
- [ ] media pool ready
- [ ] permissions ads.manage_runtime / manage_campaigns assigned

# 28. Cross-Link Matrix

| If you are doing... | Open bible |
|---------------------|------------|
| Queue/clocks/friends | Play guide |
| Cup formats | Competition guide |
| Receipts/KYC/Telegram | Wallet guide |
| Console IA / campaigns | This guide |
| Master map | Complete App Guide |

# 29. Ads & Admin Bible Closing
Keep console_nav labels as source of truth for section names. If a leaf moves in the database nav, update this map the same day.
'''

def exp(name, marker, extra):
    p = G / name
    assert "\u2014" not in extra
    t = p.read_text(encoding="utf-8")
    if marker not in t:
        p.write_text(t + extra, encoding="utf-8")
    print(name, p.stat().st_size)

exp("Dama_Competition_Formats_Guide.md", "# 29. End-to-End Story - Community Swiss", COMP)
exp("Dama_Wallet_Payments_And_Compliance_Guide.md", "# 29. End-to-End Story - First Paid", WAL)
exp("Dama_Ads_And_Admin_Ops_Guide.md", "# 23. End-to-End Story - Publisher + Admin", ADS)
