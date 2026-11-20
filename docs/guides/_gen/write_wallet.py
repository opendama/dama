# -*- coding: utf-8 -*-
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / "Dama_Wallet_Payments_And_Compliance_Guide.md"
P=[]
def add(s): P.append(s.rstrip()+"\n\n")

add("""# Dama - Wallet, Payments & Compliance Guide
Geo Routing, Providers, Manual Receipts, KYC, Payouts, Telegram Ops & Cup/Ads Money Bible

This companion bible explains money and compliance for non-technical readers: players, organizers, publishers, admins, and Telegram reviewers. Regular hyphens only. One shared wallet ledger powers the player portal, Hosting nested wallet, and Ads nested wallet.

## What is included
1. Who touches money
2. Money glossary
3. Wallet balance and currencies (ETB / USD)
4. Geo routing and private IP defaults
5. Checkout providers (Chapa, manual, Paddle)
6. Manual receipt upload path
7. Cash / RMG gates
8. Phone KYC and cash phone OTP
9. Document KYC
10. Payouts request and review
11. Telegram dual-actuator ops
12. Admin Sales console map
13. Cup and ads money touchpoints
14. Receipts list/detail/PDF/print
15. Guest limits
16. Deep link reference
17. Scenarios
18. Troubleshooting and Ready checklists
""")

add("""# 1. Who Touches Money

| Role | What they do with money |
|------|-------------------------|
| Player | Top up, paid enroll, receive prizes, request payout |
| Hosting organizer | Pay host fee, optional guarantee hold, earn entry nets |
| Ads publisher | Pay campaign create fee, spend against impression caps |
| Admin (payments.review) | Currency, geo, banks, KYC, receipts, payouts, transactions, Telegram ops config |
| Telegram reviewer | Approve/reject receipts; approve/reject/mark paid payouts |

Guests cannot use wallet, KYC, or payouts.
""")

add("""# 2. Money Glossary

| Term | Meaning |
|------|---------|
| Wallet | Per-user balance by currency inside Dama |
| Ledger | History of credits/debits by kind |
| Geo routing | Server picks domestic vs global pay path from IP |
| ETB | Ethiopia currency when domestic |
| USD | Global currency otherwise |
| local_checkout | Chapa checkout URL path |
| manual_transfer | Banks + receipt upload path |
| international_checkout | Paddle checkout URL path |
| Manual receipt | Proof of offline transfer awaiting human review |
| Cash / RMG | Real-money gates for enroll/checkout/receipt/payout |
| Phone KYC | Save/verify phone for cash eligibility |
| Cash phone OTP | Optional OTP only for phone KYC |
| Document KYC | Government ID photos + selfie + legal name + type |
| Age gate | 18+ confirmation before cash actions |
| Payout method | Saved phone (length 8) required before payout |
| Dual-actuator | Console and Telegram; first success wins |
| review_note | Reject reason stored on receipt/payout |
| Campaign create fee | Ads create debit (Ethiopia vs global amounts) |
| Host fee | Community create debit |
| Entry commission | Platform cut of paid cup entry |
""")

add("""# 3. Wallet Balance & Currencies

## Who / What / When / Why / Where
Who: Signed-in users in portal, Hosting, or Ads shells
What: One ledger; `GET /payments/wallet` returns balance + display currency from server geo
When: Before paid actions; after credits
Why: No second ledger for organizers/publishers
Where: `/wallet`, `/events/wallet`, `/ads/wallet` (Flutter mirrors)

## How currency is chosen
1. Admin sets platform currency: global USD + Ethiopia ETB (Admin Currency page).
2. Admin sets geo_payment domestic country ISO + private default city/region.
3. At pay time, server resolves country from IP chain (no client country spoof on pay chain).
4. Domestic -> ETB + Ethiopia providers. Else -> USD + Paddle.

Incomplete currency/geo config fails closed.
""")

add("""# 4. Geo Routing & Locate

## IP order for pay/checkout
X-Forwarded-For -> CF-Connecting-IP -> True-Client-IP -> socket.

## Private / loopback
Treated as domestic using geo_payment ethiopia_country + private_default_city/region. Local dev therefore often sees Ethiopia manual_transfer, not Paddle.

## Public IP
ipinfo.io if DAMA_IPINFO_TOKEN set, else ipapi.co.

## POST /geo/locate
Sources geoip | gps | dev_default only. Does not accept client country_code hint for cash binding. Also updates profile country for flags/display (separate from pay-chain spoof rules).

## Ads pin
Create fee can use pin lat/lng; server stamps country from reverse geocode; map pin required for create fee at pin.
""")

add("""# 5. Checkout Providers

## Route table
| Country | Ethiopia mode flag | Provider | Public label | Currency |
|---------|--------------------|----------|--------------|----------|
| Domestic | chapa | chapa | local_checkout | ETB |
| Domestic | manual | manual | manual_transfer | ETB |
| Domestic | missing/invalid | - | fail closed | - |
| Non-domestic | n/a | paddle | international_checkout | USD |

Ethiopia mode must be explicit chapa or manual - no invented default.

## How - top up
1. Open Wallet -> Add funds.
2. Pass OTP and cash gates when required.
3. POST checkout.
4. If checkout_url present (Chapa/Paddle): same-tab assign / external launch.
5. If manual_transfer: show banks immediately + receipt UI (toast-only close is a product bug).
6. Deep links: `?focus=topup`, `?focus=receipt`, `?focus=payout`.

Webhooks: local Chapa HMAC; international Paddle-Signature. Dev stub only when DAMA_ALLOW_PAYMENT_STUB=1.
""")

add("""# 6. Manual Receipt Path

## Who
Players (also organizers/publishers topping up nested wallets).

## How
1. Checkout returns manual_transfer with banks from Admin Banks (secrets decrypted server-side; sealed with DAMA_SECRETS_KEY).
2. Transfer offline using account name/number/mobile.
3. Upload proof POST receipts/upload then submit POST receipts.
4. Status pending.
5. Admin or Telegram approves -> wallet credit (atomic; no double credit on re-approve).
6. Reject -> notify player; optional review_note.
7. List mine via receipts/mine; see transactions list.

## UI notes
Sticky Cancel/Submit footers; bank copy icons; gold-styled receipt modal across player/events/ads shells.
""")

add("""# 7. Cash / RMG Gates

## What actions are gated
Paid tournament enroll, wallet checkout, manual receipt submit, payout request. Free enroll skips cash gate.

## Policy pieces
- cash_rmg_enabled (+ optional disabled_countries payload)
- allowed_country_codes allowlist (admin CRUD on Feature Flags)
- cash_phone_kyc_required
- cash_phone_otp_required (default OFF)
- age gate PUT /me/age-gate (18+)
- Fresh geo_ip_records via locate; fail closed if unknown/stale
- Document KYC when require_document_kyc_for_payout

## How - player eligibility
1. Open Wallet/Settings eligibility panels (DB chrome).
2. Complete age, phone, locate as prompted.
3. When kill switch or country block applies, cash CTAs hide/disable.
""")

add("""# 8. Phone KYC & Cash Phone OTP

## Who / What
Players needing phone verification for cash.

## How when Cash phone OTP is OFF (default)
1. PUT /me/phone-kyc saves and marks verified immediately.
2. OTP start/verify endpoints reject.

## How when Cash phone OTP is ON
1. Save phone.
2. Start phone-channel OTP; verify.
3. Verified timestamp set.

Do not confuse with global platform OTP (queue/moves/checkout). Both can be on simultaneously for different purposes.
""")

add("""# 9. Document KYC

## Who
Players who must unlock payouts when policy requires document KYC.

## What
Government photo ID (passport / national ID / driver license) + selfie + legal name + document type. National ID/license require back photo. Printed ID number/date fields removed from product.

## Where
Settings / wallet Document KYC panels; Admin Document KYC queue `/payments/kyc`.

## How
1. Upload images (magic-byte sniff; URLs only Cloudinary /dama/kyc/ or /api/v1/media/kyc/).
2. Save draft; submit -> pending.
3. Admin approves or rejects (reject -> resubmit).
4. users.document_kyc_verified_at gates payout when required.
""")

add("""# 10. Payouts

## How - player
1. PUT payouts/method with primary phone length 8.
2. Pass cash + document KYC if required.
3. POST payouts/request (OTP) -> wallet debited, status pending (default from policy).
4. History GET payouts/mine; notification player.payout_updated -> `/wallet?id=` history seek.
5. `focus=payout` opens request form only (not history seek).

## How - admin
1. Open `/payments/payouts` (payments.review).
2. Approve / reject from approvable; mark paid from approved.
3. Reject refunds wallet atomically with status.
4. admin.payout_pending deep link `/payments?payout=`.
""")

add("""# 11. Telegram Dual-Actuator Ops

## Who
Telegram admin IDs on the bot; reviewer_user_id configured in Admin Telegram ops.

## What
Receipts: list pending, view, approve, reject (reason required -> review_note).
Payouts: list pending + approved-unpaid, approve, reject (reason), mark paid.

## When
telegram_ops_bot enabled and Ready: bot_service_url, bot_api_key, reviewer_user_id, notify_timeout_ms > 0; TELEGRAM_ADMIN_IDS set; public DAMA_API_BASE_URL + DAMA_BOT_API_KEY on worker.

## Why
Mobile money review without opening full console. Independent of in-app admin notification emit.

## Where
Telegram DMs; config Admin `/payments/telegram-ops`.

## How
1. Admin enables and saves bridge (key required when enabling if DB lacks key).
2. Player submits receipt/payout -> notify types dama_receipt_pending / dama_payout_pending.
3. Reviewer acts in Telegram.
4. Wallet/status updates; player notified.
5. Second actor (console or Telegram) gets 409 conflict if already reviewed.

## Cannot
Replace Admin Console; review Document KYC or ads in Telegram; reject without reason; operate when not Ready / no admin IDs (fail closed, never ok with notified=0).
""")

add("""# 12. Admin Sales Console Map

| Leaf | Path | Purpose |
|------|------|---------|
| Currency | `/payments/currency` | Global + Ethiopia currencies |
| Geo routing | `/payments/geo` | Domestic ISO + private defaults |
| Document KYC | `/payments/kyc` | ID review queue |
| Payouts | `/payments/payouts` | Approve/reject/mark paid |
| Receipts | `/payments/receipts` | Manual proof review (+ detail/PDF/print) |
| Transactions | `/payments/transactions` | Platform ledger |
| Banks | `/banks` | Manual transfer accounts |
| Telegram ops | `/payments/telegram-ops` | Bridge Ready config |

Permission: payments.review for these money leaves.
After rotating DAMA_SECRETS_KEY, re-save banks so players never see ciphertext.
""")

add("""# 13. Cup & Ads Money Touchpoints

## Cups
- Paid enroll debit; free Join no modal
- Community host fee at create
- Entry commission to organizer net
- Guarantee hold/capture/release rules
- Prize escrow -> settle wallet credit after dispute
- Refunds on kick/cancel/archive before start where designed

## Ads
- Campaign create fee dual amounts Ethiopia ETB / global USD; geo-resolved debit; rollback create on insufficient funds
- impression_unit_cost from Progression ad_pricing
- daily_spend_cap vs today's impressions * unit cost
- Nested Ads wallet/receipts/transactions/payout

## Not money
VS-AI practice; casual non-entry PvP queue/invite without cup entry.
""")

add("""# 14. Receipts: List, Detail, PDF, Print

## Player web
List `/receipts`; detail `/receipts/{id}`; also `/events/receipts/{id}`, `/ads/receipts/{id}`.
`?download=1` fetches PDF then strips query; `?print=1` light-force print CSS.

## Admin
`/payments/receipts`, `/payments/receipts/{id}` same download/print query pattern; console PDF API.

## Flutter
List opens PaymentReceiptDocumentSheet; PDF via API then share sheet (no window.print). autoDownload for list deep-link parity.

API owner vs console reviewer endpoints; CORS exposes download filename header.
""")

add("""# 15. Guest Limits
No wallet, KYC, payouts, paid enroll, host, ads create. May spectate/browse only.
""")

add("""# 16. Deep Links

| Intent | Link |
|--------|------|
| Wallet history payout | `/wallet?id=` |
| Payout form | `/wallet?focus=payout` |
| Receipt focus | `/wallet?focus=receipt` or `/receipts?id=` |
| Top-up focus | `/wallet?focus=topup` |
| Wallet credited tx | `/transactions?id=` |
| Admin receipt | `/payments/receipts?receipt=` |
| Admin payout | `/payments?payout=` |
| Admin KYC | `/payments?kyc=` |
| Hosting/Ads money | `/events/wallet`, `/ads/wallet` (+ focus params) |
""")

add("""# 17. Scenarios

## A - Ethiopia manual top-up
1. Domestic geo -> manual_transfer.
2. See banks; copy account number; transfer.
3. Upload receipt; pending.
4. Telegram approve; balance increases; receipt_reviewed notification.

## B - Global Paddle top-up
1. Non-domestic geo -> international_checkout URL.
2. Complete Paddle; webhook credits.

## C - Payout blocked then unblocked
1. Request fails without phone method.
2. Save phone; still fails without doc KYC.
3. Submit docs; admin approves.
4. Request succeeds; admin marks paid.

## D - Dual-actuator race
1. Receipt pending.
2. Console and Telegram both click approve.
3. First wins; second 409; single credit.

## E - Organizer host fee
1. Create Community cup; host fee debits.
2. Players pay entry; organizer sees net KPIs.
3. Cancel before start releases guarantee if held; refunds entries.
""")

add("""# 18. Troubleshooting

| Symptom | Check |
|---------|-------|
| Receipt pending | Human review lane |
| Cannot payout | Phone, doc KYC, cash flags, country, age, locate, OTP |
| Paid entry missing seat | Payment success? enroll API? Official vs Community id? |
| Manual UI missing banks | Bug if toast-only |
| Expected Paddle on localhost | Private IP -> domestic |
| Banks garbage after key rotate | Re-save banks |
| Telegram silent | Ready + TELEGRAM_ADMIN_IDS + public API URL |
| Double review error | Expected 409 |
| Ethiopia checkout fails | Mode must be chapa or manual; currency/geo complete |
| Blank wallet chrome | Fail closed until DB chrome complete |

## Telegram Ready checklist
1. Enable bridge in Admin.
2. URL, API key, reviewer user, timeout > 0.
3. Bot env admins + DAMA_API_BASE_URL + DAMA_BOT_API_KEY.
4. Test receipt notify -> approve -> credit.
5. Test conflict on second review.
6. Test payout approve/reject/mark paid.
7. Confirm chrome secrets not returned on chrome GET.

## Related
Complete App Guide; Ads & Admin Ops for permissions; Competition guide for pot freeze timing.
""")

t="".join(P)
assert "\u2014" not in t
OUT.write_text(t, encoding="utf-8")
print(OUT.stat().st_size)
