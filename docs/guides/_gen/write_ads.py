# -*- coding: utf-8 -*-
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / "Dama_Ads_And_Admin_Ops_Guide.md"
P=[]
def add(s): P.append(s.rstrip()+"\n\n")

add("""# Dama - Ads & Admin Ops Guide
Publisher Campaign Lifecycle, Admin Console Map, RBAC, Feature Flags & Daily Ops Bible

This companion bible covers the Ads publisher shell and the full Admin Console for non-technical operators. Regular hyphens only. Ads money uses the same shared wallet ledger as players (nested under `/ads/*`).

## What is included
1. Who this guide is for
2. Ads + admin glossary
3. Publisher campaign lifecycle (create -> configure -> manage -> measure)
4. Pricing, geo fees, serve matching, caps, auto_close
5. Placements and playback
6. Publisher URLs and Flutter parity
7. Full Admin Console map by section/leaf
8. RBAC roles and permissions
9. Feature flags catalog
10. Telegram ops boundary (money only)
11. Publishers vs admins matrix
12. Daily ops checklists
13. Scenarios
14. Troubleshooting
""")

add("""# 1. Who This Guide Is For

| Audience | Needs |
|----------|-------|
| Ads publisher | Create/schedule/measure campaigns |
| Console admin | Day-to-day ops across money, cups, ads runtime, users |
| Superadmin | RBAC + full grants |
| Support lead | Know what publishers cannot force |

# 2. Glossary

| Term | Meaning |
|------|---------|
| Ads shell | Publisher app area `/ads/*` |
| Campaign create fee | Wallet debit at create (Ethiopia vs global) |
| Servable | Status that allows delivery when other gates pass |
| Schedule enabled | Required for in-match period-cap counting path |
| Placement lobby / in_match | DB keys for where ads show |
| Non-skippable seconds | Time before skip unlocks |
| Period cap | Impression limit per UTC day/week/month/year |
| Daily spend cap | Budget gate using impressions * unit cost |
| auto_closed | Worker archived after ends_at; cannot reopen |
| Console nav | Database accordion sections for Admin |
| RBAC | Permission keys on top of console role |
| Media pool | Admin creative/channel pool |
| Progression ad_pricing | Unit cost + dual create fees |
| Activity | Admin analytics DAU/WAU/MAU style page |
| Telemetry | Fingerprints, GeoIP, audit vault |
""")

add("""# 3. Publisher Campaign Lifecycle

## Who
Signed-in Ads shell users.

## Where
Web `/ads/dashboard`, `/ads/campaigns`, `/ads/analytics`, `/ads/wallet`, `/ads/receipts`, `/ads/transactions`. Flutter PublisherShell tabs from client_nav bottom_nav.ads only (fail closed if incomplete).

## Create
1. Ensure wallet can pay geo-resolved create fee.
2. Create campaign: title, creative type (DB enums), map pin / geo_targets (required; server stamps country), required daily_spend_cap (>0; separate from create fee), optional ends_at, optional creative URL. After create, detail opens and focuses device creatives / media upload.
3. Server debits create fee; insufficient balance rolls campaign back (402).
4. Cash gate / OTP may apply.
5. Default status from DB default_campaign_status.

## Configure
1. Upload thumbnail/gallery or YouTube attach when supported (media pool backend).
2. Set schedule_enabled, first show after game start, repeat interval, optional non-skippable override within admin bounds.
3. Set daily/weekly/monthly/yearly impression caps (null = unlimited for that period).
4. Move status to servable.

## Manage
1. Pause/close as needed.
2. Reopen only if not auto_closed.
3. Use nested Ads wallet for top-ups/payouts/receipts.

## Measure
1. Analytics: impressions, reach, clicks, CTR, CPC, completion, create fee spend.
2. GraphQL publisherDashboard KPIs.
3. Invoice PDF download path.

## Cannot
Change global ad_playback defaults; invent placements; force serve when eligibility fails; reopen auto_closed.
""")

add("""# 4. Pricing, Geo, Serve, Caps, Auto-close

## Pricing (Admin Progression)
- impression_unit_cost > 0 required
- campaign_create_fee_ethiopia_* and campaign_create_fee_global_* locked to payment currencies
- GET /ads/pricing returns unit cost + geo-resolved create fee (optional lat/lng)

## Geo matching
Eligibility uses server geo only (ignores spoofed body country). Campaign geo_targets matched allowlist-style (country/region/district/pin). Lobby GeoAdSlot locates user then serves creative-only payload (no publisher internals).

## In-match eligibility order (plain)
Intersect geo-matched servable campaigns with schedule_enabled; then check spend cap, period caps, first-show delay, repeat interval. On period_cap_reached, next_check_after_seconds is next UTC period boundary (not repeat interval).

## Platform pacing seeds (admin-editable)
First show 60s after game start; repeat 300s; non-skippable 10s within min/max bounds. Campaign may override or inherit.

## ends_at / auto_closed
Worker (~60s) archives expired campaigns, sets auto_closed, removes from geo index, notifies publisher and console roles. Reopen blocked.
""")

add("""# 5. Placements & Playback

| Placement | DB key use |
|-----------|------------|
| Lobby | placement_lobby |
| In-match | placement_in_match |

Impression POST requires placement matching DB keys. Skip locked until non_skippable_seconds. Overlay copy from ad_player_chrome + enums. Admin GET/PUT /console/ads/playback needs ads.manage_runtime.
""")

add("""# 6. Publisher URL & Flutter Parity

Web routes listed in section 3. Desktop nav from client_nav.ads. Flutter PublisherShell initialRouteKey deep links for campaigns/analytics/wallet/receipts. Player portal Ads entry can open `/ads/dashboard`. Notifications remap `/ads/*` into PublisherShell.
""")

add("""# 7. Full Admin Console Map

Nav from GET /platform/console-nav. Console role admin|superadmin plus per-leaf permissions.

## Overview
| Leaf | Route | Purpose | Permission |
|------|-------|---------|------------|
| Overview | `/dashboard` | Live pulse KPIs / queues | role + widget data perms |
| Activity | `/activity` | DAU/WAU/MAU, usage, heatmap, breakdowns | activity.read |

## Customers
| Leaf | Route | Purpose | Permission |
|------|-------|---------|------------|
| Users | `/users`, `/users/[id]` | Search, roles, active, KYC/payout detail | users.read; write_role; write_active |
| Avatars | `/avatars` | Approve/flag/reset | avatars.moderate |

## Sales and revenue
| Leaf | Route | Purpose | Permission |
|------|-------|---------|------------|
| Currency | `/payments/currency` | Settlement currencies | payments.review |
| Geo routing | `/payments/geo` | Domestic + private defaults | payments.review |
| Document KYC | `/payments/kyc` | ID queue | payments.review |
| Payouts | `/payments/payouts` | Approve/reject/paid | payments.review |
| Receipts | `/payments/receipts` | Manual proofs + PDF/print | payments.review |
| Transactions | `/payments/transactions` | Ledger | payments.review |
| Banks | `/banks` | Manual accounts | payments.review |
| Telegram ops | `/payments/telegram-ops` | Bot bridge Ready | payments.review |

## Competition
| Leaf | Route | Purpose | Permission |
|------|-------|---------|------------|
| Tournaments | `/tournaments` | Official cups + arena/standings/payout/toast cards | tournaments.write |
| Events | `/events` | Hosting catalog, list, reports | events.manage_catalog / manage_reports |
| Progression | `/progression` | XP, match clock, board rules, ad_pricing, web_app_origin | progression.write |

## Product and growth
| Leaf | Route | Purpose | Permission |
|------|-------|---------|------------|
| Ads runtime | `/ads` | Global playback + console campaign overrides | ads.manage_runtime / ads.manage_campaigns |
| Media pool | `/media-pool` | Channels/quotas/test uploads | media_pool.write |

## Access and security
| Leaf | Route | Purpose | Permission |
|------|-------|---------|------------|
| Feature flags | `/feature-flags` | Product toggles + cash countries | feature_flags.write |
| RBAC | `/rbac` | Roles, permissions, grants | rbac.manage (superadmin seed) |
| Telemetry | `/telemetry` | Fingerprints, GeoIP, audit | telemetry.read |
""")

add("""# 8. RBAC Roles & Permissions

## Console roles
admin, superadmin (from client_enums).

## Default seed
superadmin: all permissions. admin: all except rbac.manage.

## Permission catalog (complete seed + extensions)
users.read, users.write_role, users.write_active, rbac.manage, feature_flags.write, progression.write, tournaments.write, payments.review, media_pool.write, avatars.moderate, telemetry.read, ads.manage_runtime, ads.manage_campaigns, activity.read, events.manage_catalog, events.manage_reports.

## RBAC UI rules
Cannot delete role in use. Protected permission keys cannot be deleted. Cannot strip protected key from last holding role. Self permissions via GET /console/me/permissions.
""")

add("""# 9. Feature Flags Catalog

| Key | Player/ops effect |
|-----|-------------------|
| vs_ai_practice_mode | VS-AI on + depths |
| global_otp_verification | OTP gates |
| ethiopian_payment_mode | chapa vs manual |
| cash_rmg_enabled | Cash on (+ disabled countries) |
| cash_phone_kyc_required | Phone KYC |
| cash_phone_otp_required | Phone OTP (default off) |
| hosted_events_enabled | Hosting |
| public_events_enabled | Public Community list |
| public_event_matches_rated | Career on public cup boards |
| prize_pool_display_enabled | Pot UI |
| prize_pool_guarantee_enabled | Guarantee toggle |

Cash allowlist countries CRUD lives under Feature Flags UI (feature_flags.write). Arena late-join/auto-start live in competition arena settings (tournaments.write), not only this flag list.
""")

add("""# 10. Telegram Ops Boundary
Money review only (receipts/payouts). No ads campaign moderation in Telegram. No Document KYC in Telegram. Dual-actuator with console. See Wallet bible for Ready checklist.
""")

add("""# 11. Publishers vs Admins

| Capability | Publisher | Admin |
|------------|-----------|-------|
| Global playback defaults | No | ads.manage_runtime |
| Other publishers' campaigns | No | ads.manage_campaigns |
| Force ineligible serve | No | No |
| Invent placements/timings | No | No |
| Set ad_pricing | No | progression.write |
| Own campaign CRUD/schedule | Yes | Can patch any |
| Reopen auto_closed | No | No |
| Media pool channels | No | media_pool.write |
| Wallet in Ads shell | Yes | Full platform money |
| RBAC / flags / telemetry | No | Permission-gated |
""")

add("""# 12. Daily Ops Checklists

## Money shift
1. Clear pending receipts.
2. Clear payouts (approve/reject/mark paid).
3. Clear Document KYC queue.
4. If Telegram on: confirm Ready and overnight notifies.

## Competition shift
1. Official cups enroll/live healthy.
2. Skim hosted reports; deactivate if needed.
3. Confirm catalog/flags for the market.

## Ads shift
1. Skim runtime defaults.
2. Find stuck campaigns (schedule on but never eligible).
3. Confirm auto_closed notifications look sane.
4. Media pool quotas if creators upload today.

## Access shift
1. New admin users: role + permissions.
2. Feature flags match market.
3. Telemetry/Activity load.

## Go-live (admin)
Currency+geo; banks; progression clocks+ad_pricing; catalog; flags; sample Official cup; sample receipt/payout; ads playback; Telegram Ready.
""")

add("""# 13. Scenarios

## Publisher launch
1. Top up Ads wallet.
2. Create with Addis pin; pay ETB create fee.
3. Creative + schedule + caps + servable.
4. Confirm in-match overlay after 60s first-show on eligible game.
5. Analytics counters move; download invoice.

## Admin lowers non-skippable
1. Open Ads runtime.
2. Set non_skippable within min/max.
3. New eligibility responses return new seconds.

## Auto-close
1. Campaign ends_at in the past.
2. Worker archives; publisher notified; reopen blocked.
3. Publisher creates a new campaign instead.
""")

add("""# 14. Troubleshooting

| Symptom | Check |
|---------|-------|
| Create 402 | Wallet < create fee; geo fee pair |
| Ads never show | servable? schedule? geo? first-show/interval? caps? |
| period_cap_reached early | UTC period counters |
| Cannot reopen | auto_closed |
| Admin 403 | Missing permission |
| RBAC save refused | Protected key / last holder / role in use |
| Publisher nav empty | client_nav ads incomplete (fail closed) |
| Telegram unused for ads | Expected - money only |

## Related
Complete App Guide; Wallet guide for Telegram/money detail; Competition guide for Events/Tournaments admin leaves; ops-rbac-and-ads-runtime.md for engineering contracts.
""")

t="".join(P)
assert "\u2014" not in t
OUT.write_text(t, encoding="utf-8")
print(OUT.stat().st_size)
