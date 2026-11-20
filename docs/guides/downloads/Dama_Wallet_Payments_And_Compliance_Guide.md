# Dama - Wallet, Payments and Compliance Bible
Players, Organizers, Publishers, Admin, Telegram Ops

Non-technical. Who / What / When / Why / Where / How.

## 1. Who touches money
| Audience | What they do |
|----------|--------------|
| Player | Top-up, entry fees, prizes, payout |
| Organizer | Host fee / guarantee holds; nested Hosting wallet |
| Ads publisher | Campaign create fee; nested Ads wallet |
| Admin | Currency, geo, banks, review receipts/KYC/payouts |
| Telegram ops | Same money reviews from Telegram |

One wallet ledger is shared across player portal, Hosting nested wallet, and Ads nested wallet.

## 2. Currency and geo
Who: Admin
What: Global USD vs Ethiopia ETB and payment routes by geo
When: Before live payments
Why: Correct provider and bank instructions
Where: Admin Currency + Geo routing
Players do not invent country on pay screens; server uses geo locate.

## 3. Player top-up
### Provider checkout
1. Open Wallet
2. Choose amount
3. Complete configured provider checkout
4. Balance credits on success path

### Manual bank transfer
1. Open manual path
2. Copy bank details from Admin Banks
3. Transfer offline
4. Upload receipt
5. Pending until human review
6. Admin Console or Telegram approve/reject
7. Approve increases balance; reject notifies (with note when provided)

## 4. Cash / RMG gates (plain language)
When cash features are used, the server checks safety rules and can block the action:
- Master cash switch off
- Country disabled or not on allowlist
- Age gate not passed
- Phone KYC missing
- Document KYC missing when required for payout
- OTP gates when those flags are on

## 5. Phone KYC
If phone KYC required:
- Phone OTP flag OFF (default): saving phone can mark verified
- Phone OTP flag ON: save phone, then enter phone OTP

## 6. Document KYC
Who: Players needing payout when policy requires documents
What: ID front, ID back, selfie, legal name, document type
Where: Settings / wallet gate; Admin KYC review
How: Upload -> submit -> admin approve/reject (reject may allow resubmit)

## 7. Payouts
Player: add payout method with primary phone -> pass gates -> request (wallet holds pending) -> wait -> approved then mark paid by ops; rejected returns funds per design
Admin/Telegram: approve / reject / mark paid using policy statuses
Dual-actuator: first successful review wins; second gets conflict

## 8. Cup and ads money
- Entry fees debit wallet on paid enroll/join
- Host fee on Community create (Ethiopia amount + payment_currency.ethiopia, or global amount + payment_currency.global by organizer country; admin Host sizes DataTable)
- Prize escrow/settle after finish and dispute windows
- Ads create fee on campaign create by geo (Ethiopia vs global amounts; same pattern as host fees)
- Receipts/invoices downloadable as PDF (Flutter uses share sheet)

### Host fee vs ads create fee (same geo pattern)
| Setting | Ethiopia organizers | Outside Ethiopia |
|---------|---------------------|------------------|
| Host size fee (Community create) | Ethiopia host fee in payment_currency.ethiopia | Global host fee in payment_currency.global |
| Campaign create fee (Ads) | Ethiopia create fee in payment_currency.ethiopia | Global create fee in payment_currency.global |

Admin configures host fees on Events → Host sizes (DataTable: Add / edit / delete / filter / skip-go pagination / view / selection). Admin configures ads fees on Progression → Campaign create fees. Geo blurbs use `{ethiopia}` / `{global}` from payment_currency.

### How cup prize money is split (pointer)
Wallet holds and settles prizes. The **rule that divides the pot** is the cup payout mode (chosen when the cup is created):

| Mode | Plain meaning |
|------|---------------|
| Place percent | Pay by finish place only (1st / 2nd / 3rd envelopes) |
| Share-score | Pay by points on the scoreboard |
| Dual purse | Split pot into podium money + score money, then pay each box |

Full Who / What / When / Why / numeric examples: Competition Formats Guide Part K2. This Wallet guide covers top-up, KYC, cash-out request, and ops review of cash-out - not the cup place math.

## 9. Telegram ops Ready checklist
1. Admin -> Payments -> Telegram ops
2. Bot URL, API key, reviewer user, timeout
3. Telegram admin IDs on bot
4. Test manual receipt notify
5. Approve in Telegram
6. Confirm console shows reviewed
7. Confirm double review conflicts

## 10. Support scripts
Receipt pending: waiting for human review.
Cannot payout: check phone method, document KYC, cash flag, country, OTP.
Paid entry but not in cup: confirm payment success and correct Official vs Community id.


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
- kyc_auto_approve (default ON; OFF means Payments → KYC manual government-ID review; platform-wide)
- require_document_kyc_for_payout (policy)
- host_paid_create_requires_phone_kyc / host_guarantee_requires_document_kyc (policy; mig 522 to 529)
- Open paid cups (defaults): new host 1 / phone 3 / ID 25; too many open reports or cancel-heavy hosts blocked (edit on Sales → Host trust policy)
- Host trust badges: Unverified host / Phone verified / Verified host (API-driven labels on cups, hoster, profiles, inspect, Watch)
- global OTP separate

Human host-trust / scammer-protection bible: `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.

# 28. Document Control (Wallet Bible)
Update when geo, providers, KYC fields, Telegram bridge, or ledger kinds change.


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

1. Organizer verifies government ID (auto-approve or admin Payments → KYC).
2. Organizer has 500 wallet balance.
3. At create: host fee 40 + promised floor 200 must be lockable (phone already verified; open-cup limits and reputation already passed).
4. Create locks the 200 and takes the fee together, or does neither.
5. Before Start, organizer cancels; locked money unlocked; entries refunded.
6. Alternate path: Start commits the locked money to the pot floor; finish holds results, dispute window, then pays winners.

More host-trust stories: `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.

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
