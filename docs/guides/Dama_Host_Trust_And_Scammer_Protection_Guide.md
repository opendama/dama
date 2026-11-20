# Dama - Host Trust and Scammer Protection Bible

Non-technical bible. Who / What / When / Why / Where / How.
Covers Community cup host trust (migrations 522 to 529), cash KYC, escrow, and admin review.
Technical detail also lives in `docs/architecture.md` and the Wallet / Competition guides.

---

## 1. What problem this solves

Who: Players paying into Community cups, and organizers hosting them.
What: Stops unpaid "ghost" hosts from taking entry money or promising prizes they cannot cover.
Why: Real-money cups need identity, limits, and held funds before risk grows.
Where: Community Hosting cups (not VS-AI, not casual free play).
How (three layers):
1. Know who people are (age, phone, optional government ID).
2. Limit how many paid cups a new or risky host can run at once.
3. For guaranteed prizes, lock real wallet money so the promise is real.

Money protection (escrow) and identity limits (KYC + caps) work together.

---

## 2. Trust badges (what players see)

| Host state | Badge players see | Plain meaning |
|------------|-------------------|---------------|
| Nothing verified | Unverified host | Can still host free cups |
| Phone verified | Phone verified | Can create paid cups (with limits) |
| Government ID verified | Verified host | Can also promise a guaranteed prize floor |

ID ranks above phone. Badge text comes from the database, not invented app copy.

Players see badges on cup cards, hoster pages, profiles, dashboards, player inspect, leaderboard / players lists when stamped, Watch seats and spectators, and admin user / events views.

Important: joining a cup does **not** require the host badge. The badge is information. Paying to join still requires the **player's** own cash checks.

---

## 3. Player path: "Can I play for money?"

Who: Signed-in player.
What: Pass cash checks before paid join, enroll, checkout, receipt, or payout.
When: Any paid money action.
Why: Store / RMG rules and anti-abuse.
Where: Wallet, Settings compliance, Enroll / Join paid flows (web + Flutter).
How:
1. Confirm age when policy requires.
2. Verify phone when phone KYC is required.
   - Cash phone OTP off (default): saving the phone verifies it.
   - Cash phone OTP on: save phone, then enter the code.
3. Country must be allowed and cash must be turned on for that market.
4. Fresh location check when policy asks.
5. Government ID when required for cash-out.

Free cups, free tournament seats, and casual non-cash play skip these money checks.

---

## 4. Host: creating a cup

Who: Community organizer.
Where: Hosting create / reopen (web + Flutter).
When: Creating or reopening a cup.

### Free cup
Anyone can create it.
No phone check, no ID check, no "how many paid cups are you already running" check for money risk.
It is community / practice style hosting, not cash entry.
Hosts may still add a description and reward images (prize thumbnail + gallery, mig **533**; admin list thumb heal **534**) so players see what winners are promised. That is presentation only: the app does not lock or pay those pictured rewards from the wallet.

### Paid cup (players pay to join)
Before the cup is created, the host must:

1. **Be allowed to use cash** (same rules as a player: age, country, phone when required).
2. **Verify their phone** (so we know who is collecting entry money). Default policy requires this.
3. **Not already run too many open paid cups at once**
   - Brand new host: only **1** paid cup open until they have **finished 3** paid cups cleanly.
   - After that (phone only): up to **3** open paid cups.
   - If they verified government ID: up to **25** open paid cups.
4. **Not look abusive**
   - Too many open player reports against them, or
   - They cancel paid cups too often
   → they cannot create another paid cup until that cools down.

In one line: paid hosting = phone verified + not overloaded + not flagged as a flaky or scammy host.

These paid checks also apply when reopening a paid cup.

---

## 5. Document KYC (government ID)

Who: Anyone who needs cash-out and/or guaranteed prize hosting.
What: Photo ID (front, selfie; back unless passport) plus legal name and document type.
When: Settings / wallet gate; then auto or admin review.
Why: Stronger identity than phone alone.
Where: Document KYC panels (web + Flutter); Admin → Payments → KYC.
How:
1. Upload allowed ID photos.
2. Save draft, then submit.
3. If KYC auto-approve is on (default): approved right away → Verified host.
4. If auto-approve is off: stays pending until an admin approves or rejects.
5. Approve = document verified. Reject = stamp cleared.

Admins toggle auto-approve on Feature Flags and Events admin.

---

## 6. Guaranteed prize cup (extra protection)

This is a paid cup where the host promises: "Even if few people join, the prize pot will be at least X."

That promise is only allowed if:

1. **Their government ID is verified** (stronger than phone).
2. **They already have enough money in their wallet** to cover that promise (plus the normal host fee).

### What happens to the money (timeline)

1. **When they create the cup**  
   The system locks the promised prize amount in their wallet and takes the host fee together.  
   If locking fails, the cup is not created. No half-done state.

2. **If they cancel before the cup starts**  
   The locked money is unlocked and returned to the host.  
   Players who paid entry are refunded under normal cancel rules.

3. **When the cup starts**  
   That locked money becomes the minimum prize pot.  
   It is no longer the host's free cash; it is committed to the competition.

4. **When the cup finishes**  
   Winners are paid from the pot through the normal path: results held → short dispute window → pay out.

5. **If payout math is broken**  
   The system refuses to pretend everything is fine.  
   It errors instead of paying wrong or saying "success" with no payouts.

In one line: guaranteed cup = ID verified + money locked up front so the prize floor is real, not a promise.

Display pot uses the larger of (entry fees collected, guaranteed floor). That number freezes when the cup starts.

---

## 7. Tiny comparison

| Cup type | What host needs | What protects players |
|----------|-----------------|------------------------|
| Free | Almost nothing | No entry money at risk |
| Paid | Phone + open-cup limits + reputation | Identity + fewer open scams at once |
| Paid + guaranteed prize | ID + wallet lock at create | Promised floor is real money held by the system |

### Join / enroll (player side)

| Action | What is checked |
|--------|-----------------|
| Join free Community cup | Signed in, cup open, seats left |
| Join paid Community cup | Above + player cash checks + wallet entry |
| Enroll free tournament | Seat / window rules |
| Enroll paid tournament | Cash checks + wallet |
| Casual matchmaking (non-cash) | No cash checks |

---

## 8. Admin surfaces

| Surface | What to do |
|---------|------------|
| Payments → KYC | Approve / reject ID when auto-approve is off |
| Feature Flags / Events | Turn KYC auto-approve on or off |
| Sales → Host trust policy | Edit phone/ID gates, open-cup caps, and reputation thresholds |
| Cash allowlist | Edit allowed countries |
| Users / Events | See phone / ID status and host badges |
| Progression | Match clocks (separate topic; default time for AI / Challenge / queue) |

The numeric caps live in database policy. Admins edit them on Sales → Host trust policy.

---

## 9. End-to-end stories

### A) First paid cup (no guarantee)
1. Organizer confirms age and phone.
2. Creates a paid cup.
3. System checks cash rules, phone, open-cup limit (1 if new), and reputation.
4. Host fee is taken; cup goes live.
5. Badge shows Phone verified.

### B) Guaranteed prize cup
1. Organizer verifies government ID (auto or admin).
2. Creates a cup with a guaranteed floor and enough wallet balance.
3. System locks the floor money and creates the cup together (or does neither).
4. Cancel before start: money unlocked. Start: money becomes the pot floor. Finish: winners paid after dispute window.

### C) Player joins paid cup
1. Player passes their own cash checks.
2. Pays entry from wallet.
3. Sees the host badge (information only).

### D) Manual KYC mode
1. Admin turns KYC auto-approve off.
2. Player submits ID; it stays pending.
3. Admin approves; host becomes Verified host; higher open-cup limit; can offer guarantees.

---

## 10. What is not blocked on purpose

- Free Community cups and free enroll
- Casual non-cash matchmaking
- Guest practice vs AI
- Phone save without OTP when Cash phone OTP is off
- ID auto-approve when KYC auto-approve is on (default)

Paid create, paid join, paid enroll, payout, and guaranteed pots always run the real checks.

---

## 11. Desk card (ops)

- Lock prize money for guarantees; do not trust empty promises
- Phone for paid create (default)
- Government ID for guarantees and often for cash-out
- Open paid cups: new host 1 / phone 3 / ID 25
- Too many reports or cancel-heavy hosts: block paid create
- KYC auto-approve on = instant ID; off = Payments → KYC
- Badges: Unverified host / Phone verified / Verified host

---

## 12. Document control

Update this bible when host trust policy, KYC flags, money lock / unlock / start / finish, or badge surfaces change.
Keep Markdown sources and `docs/guides/downloads/` mirrors in sync.
Regenerate DOCX with `python scripts/build-dama-guide-docx.py` when the download pack should refresh.
