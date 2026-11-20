# Dama - Competition Formats Guide (Plain Language Bible)

This guide explains every competition format in everyday words. It is for players, organizers, support staff, and admins who are not software engineers.

We avoid short abbreviations like QF or SF. When a sports word is needed, we spell it out and explain it.

Companion: Complete App Guide (roles, wallet, apps). This file is only about cups and formats.

---

# Part A - Words you will see (explained fully)

These words appear everywhere in cups. Read this part first.

## What is a cup?
A cup is one competition event with a start, a set of matches, and a champion or final ranking. Official cups are created by platform admins. Community cups are created by a player organizer (Hosting).

## What is a format?
The format is the rule for how matches are arranged and how a winner is decided.
Examples: knockout, round robin, Swiss, groups then knockout, arena.

## What is the lobby?
The lobby is the cup home screen after you open a cup.
Who uses it: every enrolled player, the organizer, and admins watching that cup.
What you do there: check in, see the bracket or standings, tap Ready, join the arena waiting line, share the invite, see results.
When you open it: after you join, or from a notification, or from `/?view=tournaments` with the cup id.
Why it exists: one place for the whole competition, not only the chess board.
Simple picture: the lobby is the tournament hall; the board is one table inside the hall.

## What is a seat?
A seat is one of the two player slots in a match (player A and player B).
Who sits: the two people assigned to that match.
Why the word seat: the product thinks of a match as two chairs at one board.
Related: Ready means both seats confirmed they are present and ready to play.

## What is check-in?
Check-in means: I am here and available for this cup before the bracket is built.
Who: enrolled players, during the check-in window.
When: after join/enroll, before or when the admin/organizer starts a classic cup.
Why: so empty no-shows are not placed into first-round matches.
Important: classic formats (knockout, round robin, Swiss, groups then knockout) usually seed from checked-in players. Arena is different: it uses enrolled players and a waiting line, not check-in seeding.

## What is enroll / join?
Enroll or join means you register into the cup roster.
Free join: usually one tap, no payment.
Paid enroll/join: you pay an entry fee from your wallet.
Who: players.
When: while the cup is open for registration.
Why: the cup needs a list of participants before Start.

## What does paid mean here?
Paid means money leaves your wallet for that cup action.
Examples:
- Paid entry: player pays to join.
- Host fee: organizer pays to create a Community cup (this fee is not the prize pot).
Unpaid / free: no wallet debit for that join.

## Host trust / scammer protection (all organizers)

Plain goal: stop unpaid ghost hosts from taking entry fees or promising prizes they cannot cover.

Community cups (migrations 522 to 529, prize media **533**, admin list thumb heal **534**):
1. Free cups: anyone can create; no paid-host gates.
1b. Reward presentation (free and paid): hosts set optional `description` plus prize thumbnail + gallery (same pattern as Official tournaments). Branding logo/sponsor stay separate. Players see reward media on cards, detail, join-by-code, and cup lobby (prize→gallery, then branding if prize empty). Result cards stay logo/sponsor. Admin hosted list thumb is prize→first gallery (not branding logo). Images do not pay wallet prizes; paid pots still use escrow when configured.
2. Paid create: phone verified + open-cup limits + reputation checks (not overloaded, not flagged).
3. Guaranteed prize: government ID verified + wallet money locked at create (with host fee). Cancel before start unlocks it. Start commits it to the pot. Finish pays winners after the dispute window.
4. Players see Unverified host / Phone verified / Verified host badges on cup cards, hoster pages, profiles, dashboards, player inspect, and Watch seats/spectators.
5. KYC auto-approve (default ON) approves government ID right away; when OFF, admins review at Payments → KYC.

Open paid cups (defaults): new host 1 until 3 finished paid; then phone 3; ID verified 25. Join does not require the host badge; paid join still needs the player's own cash checks.

Full human steps: `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`.

## What is a bracket?
A bracket is a chart of matches where winners move forward.
Who sees it: players and organizers in the lobby for knockout-style cups.
Why: so everyone can see who plays whom next, and who is eliminated.
Used in: knockout, and the second phase of groups then knockout.

## What is shuffle?
Shuffle means the system randomly mixes the player list before placing them into first matches or groups.
Who does it: the server, automatically, when the cup Starts.
Why: fairness. No human picks favorites into easy paths.
When: at Start for knockout and groups (and related seeding).
You do not press a Shuffle button.

## What is a pair / pairing?
A pair (or pairing) is two players assigned to play each other in one match.
Who creates pairs: the format engine (bracket slot, round-robin list, Swiss score pairing, or arena waiting-line pairing).
Why: every game needs exactly two seats.

## What is a queue? (especially arena queue)
A queue is a waiting line of players who want the next available opponent.
Who joins: players who tap Join queue in an arena cup lobby.
When: after the arena has Started and while the arena clock is still running.
Why: arena is continuous play, not one fixed bracket.
How it works: a background job looks at the line every few seconds and pairs people.
Different from the global Find-match queue on Play home: the arena queue is only inside that cup.

## What is a draw?
A draw means the game ended without a single winner (tied result on the board rules).
What happens next depends on format:
- Classic formats (knockout, round robin, Swiss, groups): a draw usually rematches that same pairing (play again) instead of both advancing.
- Arena: a draw usually gives arena points to both players (no rematch reset).

## What is Ready?
Ready is a confirmation button on a match in the lobby.
Who: both seated players.
When: after the match exists and both seats are filled.
Why: so the live board does not start while one person is away.
What happens: when both have tapped Ready, the server creates the live game board and starts the match clocks.

## What is a bye?
A bye is an automatic pass to the next round without playing, because there was no opponent for that slot.
Why it exists: knockout needs even bracket sizes (2, 4, 8, 16...). If you have 6 players, the system pads to 8 and some players get byes.
In Swiss: if the player count is odd, one player may get a bye that counts as a win for standings points.

## What is pad / power of two?
Power of two means sizes like 2, 4, 8, 16, 32.
Pad means: if you have fewer players than the next power of two, empty slots are added so the bracket shape is clean.
Example: 6 real players -> pad to 8 -> two byes.

## What is standings?
Standings are a ranked table of players by points (and tie-breakers).
Used in: round robin, Swiss, group stage, and sometimes payouts.
Not the same as career rating on your profile.

## What is arena points?
Arena points are the score used only inside Arena cups.
Winning can give more points if you are on a winning streak.
Draws usually give some points.
Losses usually give zero and break the streak.
Champion = highest arena points when the arena time ends.

## Quarterfinals, semifinals, final (spelled out - no QF / SF)
In an 8-player knockout:
- Round of 8 (sometimes called quarterfinals): 4 matches, 8 players.
- Semifinals: 2 matches, 4 remaining players.
- Final: 1 match, 2 remaining players.
We will write Round of 8, Semifinals, Final in examples. We will not write QF or SF.

## Classic formats vs Arena
Classic formats: knockout, round robin, Swiss, groups then knockout. Fixed structure after Start. Check-in matters. Draws usually rematch.
Arena: timed open play with a waiting line. Draws score points. Late join may be allowed.

## What is a payout mode?
A payout mode is the rule that splits the prize pool after a paid cup ends.
There are three modes (full chapter in Part K2):
- Place percent: money by finish place only (1st / 2nd / 3rd envelopes).
- Share-score: money by points on the scoreboard.
- Dual purse: pot split into a place purse and a performance (points) purse.

## What is place percent?
Place percent (place %) means the pot is poured into place envelopes. Example 50/30/20: 1st gets half, 2nd gets 30%, 3rd gets 20%. Points during the cup do not change those envelopes.

## What is share-score?
Share-score means the pot is sliced by points. More points, bigger slice. Place medals alone do not fix a percent unless they also mean more points.

## What is dual purse?
Dual purse means two cash boxes: podium money (place percent) and score money (share-score). An admin dual place percent decides how much of the pot goes into each box first.

---

# Part B - Who this guide is for

| Audience | What you need from this guide |
|----------|-------------------------------|
| Official cup player | How to join, check in, Ready, play, understand brackets |
| Community participant | Same as above for someone else cup |
| Hosting organizer | How to create/start, what each format does, what you cannot configure |
| Platform admin | Catalog rules (Swiss rounds, group size), Official cups, arena settings |
| Support | How to explain lobby, seats, check-in, shuffle, draws, queue, paid |

---

# Part C - Official vs Community (ownership)

| Topic | Official | Community (Hosting) |
|-------|----------|---------------------|
| Who creates the cup | Platform admin | Player organizer |
| Who starts the cup | Admin | Organizer |
| Where players find it | Tournaments hub -> Official | Tournaments hub -> Community, or private invite code / QR |
| Who edits catalog (sizes, formats, fees, Swiss rounds, group size) | Admin only | Organizer only picks from the catalog |
| Same five formats? | Yes | Yes |

Arena is a format choice, not a third product. An Official cup or a Community cup can both use Arena.

---

# Part D - Shared lifecycle (classic formats)

1. Create the cup (admin or organizer).
2. Players enroll or join (free or paid).
3. Check-in window opens when the product requires it. Players who check in are the ones classic Start will place into matches.
4. Admin or organizer presses Start.
5. The system builds the structure (bracket, full pairing list, Swiss first round, or groups).
6. For each match: both seats tap Ready -> live board and clocks start.
7. Results move the structure forward. Classic draws usually rematch.
8. If someone never Ready in time, ready-timeout can forfeit them.
9. Cup finishes -> dispute waiting period if configured -> prizes settle to wallets.

Arena difference:
1. Start opens the arena clock end time.
2. Players join the arena waiting line in the lobby.
3. The system pairs from the line; games can auto-start.
4. Players can re-join the line after each game until time ends (or force finish).
5. Draws give arena points (not rematch).

---

# Part E - Format 1: Knockout

## What it is
Single elimination. Lose one match and you are out of the cup. Keep winning until the Final.

## What it is for
Fast, clear champion. Good for small or medium fields when you want drama and a short schedule.

## Why use it
Simple to understand. TV-style bracket. One final match decides the champion.

## When it is used
When the cup format is set to knockout at create time, then Start runs.

## Who does what
- Admin/organizer: create size, Start when enough checked-in players.
- Server: shuffle players, build bracket, insert byes if needed.
- Players: check in, open lobby, Ready, play, advance or eliminate.

## How it creates the bracket
1. Collect checked-in players (classic).
2. Shuffle the list randomly.
3. Pad to the next power of two (2, 4, 8, 16...).
4. Place pairs into Round of N matches.
5. Empty slots become byes (automatic advance).

## Example with 8 players (no abbreviations)
- Round of 8: 4 matches (8 players).
- Semifinals: 2 matches (4 winners).
- Final: 1 match (2 winners).
- Champion: Final winner.
If nobody rematches, that is 7 decisive games in the tree.

## Example with 6 players
Pad to 8. Two players receive byes into the Round of 8 / toward Semifinals path. Four players play first. Then Semifinals and Final as usual.

## Example with 5 players
Pad to 8. Three byes. Only two real first-round games before later rounds.

## Draws in knockout
A draw usually rematches the same two seats until there is a winner (classic rule).

## What you see
Lobby shows the bracket chart. Your next opponent appears when both sides of a match are known.

---

# Part F - Format 2: Round robin

## What it is
Everyone plays everyone else once. No elimination after one loss.

## What it is for
Fairest full comparison in a small group (club night style).

## Why use it
Skill over a full slate. One bad game does not eliminate you.

## When / How it creates
At Start, the system builds the full list of unique pairs. Example with 4 players A B C D: A-B, A-C, A-D, B-C, B-D, C-D = 6 matches.

## Who wins
When every match on the list is finished, the standings table decides place 1 (champion).

## Draws
Classic rematch is typical before a draw permanently sits on the slate.

## What you see
Lobby shows many pairings plus a standings table that updates after results.

## Caution
Match count grows quickly (8 players = 28 games). Keep size small unless you have time.

---

# Part G - Format 3: Swiss

## What it is
A fixed number of rounds. Each round, players are paired with others who have a similar score. You do not play everyone.

## What it is for
Larger fields when a full round robin would take too long.

## Why use it
Balanced schedule. Strong players meet strong players as points separate.

## Who sets how many rounds
Admin only, in the Events catalog map by maximum players.
Example seed map (live database may differ):
- Max 8 players -> 3 rounds
- Max 16 -> 4 rounds
- Max 32 -> 5 rounds
- Max 64 -> 6 rounds
Organizers do not type the round count.

## How pairing works
1. Start builds round 1 (often from enrollment order before points exist).
2. Players Ready and play.
3. When the whole round is finished, sort by points and pair again, avoiding rematches when possible.
4. If odd number of players, one gets a bye (counts as a win for points).
5. After the last round, standings decide the champion.

## What you see
Standings table + current round pairs. Next round appears only after the current round is complete.

---

# Part H - Format 4: Groups then knockout

## What it is
Two phases:
1. Group stage: several small round robins.
2. Knockout: advancers play single elimination.

## What it is for
World-cup style: group games first, then a knockout final path.

## Why use it
Everyone plays several games in groups; still ends with an exciting knockout.

## Who sets group rules (critical)
Admin Events catalog only:
- Target group size (how many players each group aims for; often 4)
- How many advance from each group (often 2)
Organizers cannot pick group size or advance count. They only choose this format if the catalog enables it.

## How groups are created
1. On Start, server shuffles all checked-in players.
2. Deals them into groups using the target size.
3. Builds round-robin matches inside each group.
Nobody hand-picks Group A vs Group B.

## When knockout starts
Automatically when every group-stage match is finished.
There is no second Start knockout button.
Top N from each group (by standings points) enter a knockout bracket (with byes if needed).

## Example
8 players, target group size 4, advance 2:
- Group A: 4 players, 6 group games
- Group B: 4 players, 6 group games
- Top 2 from each -> 4 players into knockout
- Semifinals then Final -> champion

## What you see
First: group standings.
Later: a knockout bracket appears by itself.

---

# Part I - Format 5: Arena

## What it is
A timed open competition. Players repeatedly join a waiting line, get paired, play, then can join again until the arena clock ends.

## What it is for
Busy evenings, casual continuous play, streak scoring.

## Why use it
Maximum games in a time window. Not a single elimination tree.

## Who / When / How
1. Create cup with format arena; duration may be set (often default 60 minutes from admin settings).
2. Start opens the end time.
3. Players open the lobby and tap Join queue (waiting line).
4. Background pairing creates matches (by rating or by score mode, from admin settings).
5. Boards often auto-start.
6. Results add arena points (streaks can raise win value; draws score; losses reset streak).
7. Re-join the waiting line.
8. When time ends (or force finish), ranking by arena points decides the champion.

## Check-in note
Arena does not use classic check-in seeding. Enrolled players who join the waiting line play.

## Late join
If admin allows join while live, new players may still enroll while the arena clock runs. Classic formats do not allow that after Start.

## Unlimited seats (Arena open enroll)
Industry practice: classic brackets stay on fixed sizes (seeded 8 / 16 / 32 / 64 / 128 / 256; mig **492**/**493**). Company sizes 128/256 allow knockout, swiss, and groups→knockout (not round robin). Mass open play uses Arena with either:

- a **high max** (safety ceiling), or
- **null max** (true Unlimited open enroll; no seat full-stop).

On Dama:

- Community hosts pick a catalog size. Admin can create an Unlimited size (`max_players` null, Arena only) or a high-max Arena size. The Host Sizes Unlimited toggle accepts empty max or a high ceiling only (classic-range max with the toggle on is rejected; mig **490** chrome `err_unlimited_max_high_or_empty`; EventsAdminChrome API requires that key fail-closed with the admin SPA).
- Official Arena cups may leave max players empty (Unlimited) or set a high ceiling. Classic Official formats require a fixed max at or below the DB classic seat ceiling (server rejects null and high ceilings).
- A typed max under 2 is rejected (`err_max_players_required` / catalog invalid). It is never coerced into Unlimited.
- UI labels come from database chrome (`unlimited_players_label`). Prize "if full" only appears when a real seat cap exists.
- Null Unlimited sizes and high safety ceilings above the DB classic seat ceiling require Arena only (server rejects classic formats on those sizes).
- Catalog seed `size_unlimited` and heal mig **491** bind `allowed_format_ids` to `client_enums.hosted_event_arena_format` (not a hardcoded format id).

## What you see
Arena countdown clock, Join queue button, arena standings with streaks. Seat line shows DB Unlimited label when the cup has null max or a high safety ceiling (`seat_cap_unlimited` from API).

---

# Part J - Ready, rematch, forfeit (all classic seats)

1. A match exists with two seats filled.
2. Each player taps Ready in the lobby.
3. When both Ready, the live board opens with dual clocks (same pause/resume rules as casual play - see Play guide).
4. Admin/organizer may force-start or rematch when the product allows.
5. Ready-timeout can auto-forfeit a no-show so the cup continues.

---

# Part K - Money words in cups (plain)

| Word | Meaning |
|------|---------|
| Host fee | What the organizer pays to create a Community cup. Not added as player prize by itself. Admin sets an Ethiopia fee and a global fee per host size (currencies from payment_currency), same idea as ads campaign create fees. Ethiopia organizers pay the Ethiopia pair; everyone else pays the global pair. |
| Entry fee | What a player pays to join a paid cup. |
| Prize pool | Money available to winners (from entries and optional guarantee). |
| Payout mode | The rule that decides how the prize pool is split among finishers. There are three modes (explained below). |
| Dispute window | Waiting time after finish before prizes lock. |
| Escrow | Holding prizes safely until settle credits wallets. |

Paid enroll example: player taps Enroll -> pays from wallet -> lands in the cup lobby.

---

# Part K2 - The three payout modes (full plain explanation)

A payout mode answers one simple question after a paid cup ends:

**How do we divide the prize pool among the players?**

Who chooses the mode: the organizer (Community) or the admin (Official) when the cup is created. If nobody picks one, the platform uses the default for that format.

When money actually moves: after the cup finishes, after the dispute waiting time, and after settle. Open reports can block settle.

Where you see it: cup create / edit screens, cup lobby prize text, and wallet history after settle.

Why three modes exist: different cups want different fairness stories. Some care only about final place. Some care about how many points you earned. Some want both.

Below, assume a frozen prize pool of **1000** for every example.

---

## 1) Place percent (also called places percent, place %)

### What it does
The prize pool is split **only by finish place** (1st, 2nd, 3rd, and so on). The organizer (or admin defaults) sets percentages that must add up to 100.

Example with 50 / 30 / 20:
- 1st place receives 500
- 2nd place receives 300
- 3rd place receives 200
- Everyone else receives 0 from the pot

### Who it is for
Cups where the story is simple: champion gets the biggest share, runner-up next, and so on. Classic knockout cups often feel natural with this mode.

### What it ignores
It does **not** look at how many points you scored during the cup, how many games you won earlier, or how long you survived if those things do not change your final place label. Place is everything.

### When money is decided
After final standings / final places are frozen for settlement. Your place label (1st, 2nd, 3rd…) maps to the matching percent.

### Plain picture
Think of three envelopes labeled 1st, 2nd, and 3rd. The pot is poured into those envelopes by percent. Whoever ends in that place opens that envelope.

### Good to know
- Percents must sum to 100.
- If only one player is paid (for example 100 / 0 / 0), the whole pot goes to 1st.
- Easy for players to understand at the door.

---

## 2) Share-score (also called score share)

### What it does
The prize pool is split **by points** (standings points or arena points), not by place envelopes.

Everyone who has points in the share set gets a slice of the pot equal to:

their points / total points of all sharing players.

Example: three players have 10, 6, and 4 points (total 20).
- Player with 10 receives 10/20 of 1000 = 500
- Player with 6 receives 6/20 of 1000 = 300
- Player with 4 receives 4/20 of 1000 = 200

### Who it is for
Cups where effort and score matter more than a single Final result. Arena cups often fit this mode. Swiss and round robin can also fit when you want "more points, more money."

### What it ignores
It does **not** pay a fixed "1st place envelope." Finishing first only helps if that also means you hold more points than others.

### Knockout note (important)
In knockout, players who win early rounds can still hold phase win points even if they later lose and leave the bracket. Share-score can still give them a slice based on those points. That is intentional: early winners contributed and are not always left with zero when the mode is score-based.

### Plain picture
Think of the pot as a pie. Each player's points are slices of crust. Bigger score, bigger slice. Place medals are nice, but the pie knife follows the scoreboard.

### Good to know
- If total points are zero, the product cannot fairly share by score (settlement rules fail closed / fall back as designed).
- Rankings can change until the cup fully freezes for settle.
- Harder to explain at the door than place percent, but fairer when many games matter.

---

## 3) Dual purse

### What it does
The prize pool is cut into **two purses** first:

1. **Place purse** - paid by finish place percentages (like place percent).
2. **Performance purse** - paid by points (like share-score).

An admin setting (dual place percent) decides how much of the total pot goes into the place purse. The rest goes into the performance purse.

Example: dual place percent = 60, pot = 1000.
- Place purse = 600 (split by 1st / 2nd / 3rd percents)
- Performance purse = 400 (split by points among scorers)

If place percents are 50 / 30 / 20 inside the place purse:
- 1st gets 50% of 600 = 300 from place
- 2nd gets 180 from place
- 3rd gets 120 from place

Then the 400 performance purse is shared by points the same way share-score works.

A player can receive money from **both** purses (for example: finished 2nd and also earned many points).

### Who it is for
Cups that want both stories at once: reward the podium **and** reward strong overall scoring. Useful when organizers want drama for places without ignoring hard workers who scored a lot.

### What happens if nobody has points
If total performance points are 0, the product fails closed toward full-pot place behavior (place rules take the money path so settlement does not invent a score share from nothing).

### Plain picture
Think of two cash boxes on the table.
- Box A: "Podium money" (place percent).
- Box B: "Score money" (share-score).
The dual place percent decides how much cash goes into Box A vs Box B before anyone is paid.

### Good to know
- Dual purse is not "place percent twice." It is place percent on one slice of the pot, plus score share on the other slice.
- Players should read both the place percents and the dual split when they join a paid cup.
- Settlement still waits for dispute window and clear reports, same as the other modes.

---

## Side-by-side chooser (organizer / admin)

| If you want… | Choose |
|--------------|--------|
| Simple podium story (1st / 2nd / 3rd envelopes) | Place percent |
| Money follows the scoreboard | Share-score |
| Both podium and scoreboard get paid | Dual purse |

| Mode | Pays by place? | Pays by points? |
|------|----------------|-----------------|
| Place percent | Yes (only) | No |
| Share-score | No (only if place equals more points) | Yes (only) |
| Dual purse | Yes (on the place purse) | Yes (on the performance purse) |

### Player tip
Before you pay an entry fee, open the cup lobby and read the prize / payout text. Ask: am I playing for place envelopes, for points, or for both?

### Settlement tip (support)
Prizes do not appear the second the Final ends. Dispute window and settle still apply for every payout mode.

---

# Part L - Format chooser (organizer)

| Your goal | Choose |
|-----------|--------|
| Fast single winner, easy to explain | Knockout |
| Everyone plays everyone | Round robin (keep the field small) |
| Many players, limited time | Swiss (admin sets round count) |
| Groups then finals drama | Groups then knockout (admin sets group size) |
| Continuous play for one timed evening | Arena |

---

# Part M - Who presses which button

| Action | Official | Community |
|--------|----------|-----------|
| Create cup | Admin | Organizer |
| Change Swiss rounds or group size | Admin catalog | Admin catalog |
| Start cup | Admin | Organizer |
| Check-in | Player | Player |
| Ready | Both seated players | Both seated players |
| Join arena waiting line | Player | Player |
| Force finish arena | Admin | Organizer when allowed |

---

# Part N - Troubleshooting in plain words

| What you feel | What it usually means |
|---------------|----------------------|
| I joined but I am not in the bracket | You may have missed check-in, or Start has not happened, or you are looking at the wrong cup |
| Groups finished for me but no knockout yet | Other groups still have unfinished games; knockout waits for all group games |
| I cannot join after Start | Classic formats block that; only Arena may allow late join if enabled |
| What is the lobby? | The cup page (hall), not the chess board itself |
| Why did I get a free win without playing? | That is a bye from padding or odd Swiss count |
| Draw but we play again | Classic rematch rule |
| Draw gave us points | Arena scoring |
| I finished 2nd but got little money | Cup may be share-score or dual purse; points matter, not only place |
| I scored a lot but got nothing | Cup may be place percent only; only place envelopes are paid |
| What is dual purse? | Pot is split into podium money and score money first |

---

# Part O - Classroom memory examples

1. Knockout: 8 names in a hat, random pairs, winners play winners, one Final champion.
2. Round robin: 4 friends, each plays each other once, most points wins the night.
3. Swiss: 16 players, only 4 rounds, similar scores meet, odd person may sit out with a bye win.
4. Groups then knockout: two tables of 4, each table plays round robin, top 2 from each table play Semifinals and Final.
5. Arena: one hour open play, keep joining the waiting line, streak bonuses, highest arena points when the hour ends.
6. Place percent: pot 1000 with 50/30/20 -> three envelopes 500, 300, 200 for 1st, 2nd, 3rd.
7. Share-score: pot 1000; points 10, 6, 4 -> slices 500, 300, 200 by scoreboard.
8. Dual purse: pot 1000 with 60% place purse -> 600 for podium envelopes and 400 for score slices.

---

# Related guides
- Complete App Guide: roles, apps, wallet overview
- Play and Matchmaking Guide: board, clocks, pause/resume, Ready on the live board
- Wallet Guide: entry fees, host fees, payouts


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
