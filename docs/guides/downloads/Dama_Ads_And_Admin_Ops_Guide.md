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
3. Pay database create fee from wallet (amount depends on geo; create fails if balance is insufficient). This is a one-time fee, not the daily spend cap.
4. Title + creative type + **required daily spend cap** (must be greater than zero; caps daily impression spend in wallet currency)
5. After create succeeds, the campaign detail opens immediately with device creatives / media upload first (then title, status, schedule) so creatives can be attached without hunting the row
6. Upload media: thumbnail/gallery as today, plus **device creatives** (desktop / tablet / mobile) when `ad_runtime_chrome` viewport keys are complete. Per-slot aspect labels come from DB (`viewport_*_ratio_label`; typically 16:9 / 4:3 / 9:16). Per slot: drag-drop or pick image/video. Fill all three or only the sizes you need; each size plays only on that screen.
7. Schedule: first show, interval, period impression caps, optional non-skippable within admin bounds
8. Set servable status (Draft / Active / Paused / Archived) from the detail form or bulk row selection
9. Save

### Campaigns table
- Status column, impressions/clicks/reach, daily spend cap, View, and row actions (including **Delete** when the campaign has zero impressions and zero clicks; otherwise archive)
- Web: OpsDataTable selection checkboxes + bulk status apply. Flutter: expandable cards with the same select / bulk status / delete / upload actions
- Create fee is never refunded on delete

### Manual transfer (Ethiopia payment route only)

Wallet and Receipts do not embed the bank-transfer form. ET geo users open the dedicated Manual Transfer page (nav + CTA). Outside Ethiopia, Manual Transfer is hidden; Paddle/card top-up stays on Wallet.
- Shown only when `GET /payments/route` resolves to `manual_transfer` (domestic geo). Outside Ethiopia, Paddle/card checkout on Wallet; Manual Transfer nav and pages stay hidden.
- Dedicated pages: `/transfer`, `/ads/transfer`, `/events/transfer` (web + Flutter shells). Receipts stays list-only with a CTA into Manual Transfer when the route is manual.
- Banks list + amount + receipt screenshot upload; admin reviews receipts as today.

### Day to day
- Pause/close; reopen only if not auto-closed
- Read analytics (impressions, clicks, CTR, spend)
- Nested wallet / Manual Transfer (ET) / receipts / transactions / payout
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
Hosted events catalog (formats, Swiss rounds map, groups target/advance, arena defaults). Host sizes use a DataTable with Ethiopia and global host fees per size (currencies from payment_currency), same geo pattern as Campaign create fees on Progression. Unlimited sizes (null max or high safety ceiling) are Arena-only for Community and Official; admin labels them Unlimited from DB chrome; the Unlimited toggle requires empty max or a high ceiling (classic-range max is rejected so it cannot save as a fixed Arena size by mistake; mig **490** `err_unlimited_max_high_or_empty`; EventsAdminChrome API requires that key fail-closed with the admin SPA); classic sizes stay fixed. Official Arena create/edit uses the same null or high ceiling rules (`ValidateOfficialMaxPlayers`).
Hosted reports moderation.
Progression: XP ladder; **rated match rewards** (win/draw/loss XP + rating deltas + **minimum rating floor** + **new player starting rating** - full admin edit of `match_rewards`; floor ≥ 0; starting ≥ floor; starting applies to new accounts only; match results clamp to floor); match_clock (enable, default preset, increment, invite TTL; presets listed from DB; **pause_enabled** + **pause_duration** as number + Seconds/Minutes unit stored as seconds - PauseDurationField, not a calendar picker).

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
2. Check KYC queue (and Events / Feature Flags KYC auto-approve, mig 522 to 529: ON = government ID approved right away; OFF = manual Payments → KYC)
3. Healthy Official cups
4. Skim hosted reports (too many open reports or cancel-heavy hosts can be blocked from paid create)
5. Confirm feature flags for market (include host-trust cash/KYC flags). Edit open-cup caps and reputation on Sales → Host trust policy (new 1 / phone 3 / ID 25 defaults).
6. If ads live, skim runtime and stuck campaigns
7. If Telegram ops on, confirm Ready and overnight notifies

Scammer protection (human steps): `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.


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
See Competition bible for formats. Progression also owns match_clock (including pause on/off and max pause duration) and ad_pricing - coordinate with Play and Ads owners before changing unit cost or pause length.

## Ads runtime
Global non-skippable and pacing. Console can patch campaign schedule/status for any publisher campaign with ads.manage_campaigns.

## Media pool (`/media-pool`)
Register YouTube channels before large video pushes. Each channel has daily quota (about **10** uploads/day is the practical cap), **failover order** (`sort_order`, lower tried first), and an active flag. CRUD channels in console; test upload tab verifies the pool. Publisher campaign videos (per slot or legacy) queue against this pool automatically. Deleting a channel does not remove video IDs already attached to live campaigns.

## Device creatives on player apps
Lobby (`GeoAdSlot`) and in-match overlay resolve the screen band from `viewport_breakpoint_mobile_max` / `viewport_breakpoint_tablet_max` on `GET /ads/playback` `schedule_chrome`. They show **only** the matching slot creative (desktop / tablet / mobile). They do not borrow another device slot. If the current screen has no creative, the lobby tile stays hidden and in-match does not open (no impression). Legacy single creative is used only when no viewport slots are filled. Aspect ratio labels also come from that chrome. Missing or invalid breakpoints or ratio labels **fail closed**. Do not patch client defaults; fix platform settings instead.

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


# 23. End-to-End Story - Publisher + Admin Assist

1. Publisher Lila tops up Ads wallet via portal nested `/ads/wallet`.
2. She creates a campaign pinned to downtown; pays Ethiopia create fee.
3. Creative uploads; she forgets schedule_enabled; in-match never shows.
4. Admin with ads.manage_campaigns opens console Ads, enables schedule, sets first show 60, interval 300, daily impression period cap 500 (schedule, not publisher wallet spend cap), status servable.
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
- [ ] Creative attached and previewed (legacy and/or device slots)
- [ ] Device creatives filled for target phones/tablets/desktops if using viewport uploads
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
- [ ] Media pool: channels registered, sort_order set, quota understood (~10/day/channel)
- [ ] `viewport_breakpoint_*` present in ad_runtime (playback schedule_chrome)
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
