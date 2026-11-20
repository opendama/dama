# -*- coding: utf-8 -*-
"""Rewrite competition formats docs in plain non-technical language (no QF/SF/KO/RR abbreviations)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMP = ROOT / "Dama_Competition_Formats_Guide.md"
COMPLETE = ROOT / "Dama_Complete_App_Guide.md"


def no_em(s: str) -> str:
    return s.replace("\u2014", "-").replace("\u2013", "-")


COMP_BODY = r'''# Dama - Competition Formats Guide (Plain Language Bible)

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

## What you see
Arena countdown clock, Join queue button, arena standings with streaks.

---

# Part J - Ready, rematch, forfeit (all classic seats)

1. A match exists with two seats filled.
2. Each player taps Ready in the lobby.
3. When both Ready, the live board opens with dual clocks.
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
Cups where effort and score matter more than a single Final result. Arena cups often fit this mode. Swiss and round robin can also fit when you want “more points, more money.”

### What it ignores
It does **not** pay a fixed “1st place envelope.” Finishing first only helps if that also means you hold more points than others.

### Knockout note (important)
In knockout, players who win early rounds can still hold phase win points even if they later lose and leave the bracket. Share-score can still give them a slice based on those points. That is intentional: early winners contributed and are not always left with zero when the mode is score-based.

### Plain picture
Think of the pot as a pie. Each player’s points are slices of crust. Bigger score, bigger slice. Place medals are nice, but the pie knife follows the scoreboard.

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
- Box A: “Podium money” (place percent).
- Box B: “Score money” (share-score).
The dual place percent decides how much cash goes into Box A vs Box B before anyone is paid.

### Good to know
- Dual purse is not “place percent twice.” It is place percent on one slice of the pot, plus score share on the other slice.
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
- Play and Matchmaking Guide: board, clocks, Ready on the live board
- Wallet Guide: entry fees, host fees, payouts
'''


def patch_complete() -> None:
    text = COMPLETE.read_text(encoding="utf-8")
    # Replace section 8 with plain expanded formats overview if present
    start = text.find("## 8. Official vs Community cups")
    if start < 0:
        start = text.find("## 8. Official vs Community cups and the five formats")
    if start < 0:
        raise SystemExit("complete section 8 not found")
    end = text.find("\n## 9.", start)
    if end < 0:
        raise SystemExit("complete section 9 not found")
    new8 = r'''## 8. Official vs Community cups and the five formats (plain overview)

Deep detail lives in the Competition Formats Guide. This section uses everyday words only.

### 8.1 Two kinds of cups
| Kind | Who creates and starts | Where players find it |
|------|------------------------|------------------------|
| Official | Platform admin | Tournaments hub -> Official |
| Community (Hosting) | A player organizer | Tournaments hub -> Community, or a private invite code / QR code |

Both kinds can use the same five formats. Once a match exists, Ready, the live board, and clocks work the same way.

### 8.2 Words you must know before formats
- Lobby: the cup home page (the tournament hall), where you check in, Ready, and see bracket or standings. Not the same as the chess board.
- Seat: one of the two player slots in a match.
- Check-in: confirm you are present before classic cups place you into first matches.
- Paid: wallet money is charged (paid entry or host fee). Free join does not charge.
- Bracket: the knockout chart of who plays whom.
- Shuffle: the server randomly mixes players at Start (nobody hand-picks favorites).
- Pair / pairing: two players assigned to one match.
- Queue (arena): waiting line inside an Arena cup for the next opponent.
- Draw: tied game. Classic cups usually rematch. Arena usually gives points.
- Bye: automatic advance when there is no opponent for a slot.
- Payout mode: rule for splitting the prize pool after a paid cup (place percent, share-score, or dual purse).
- Place percent: money by finish place envelopes only (example 50/30/20).
- Share-score: money by points on the scoreboard.
- Dual purse: pot split into podium money and score money.

We do not use short forms like QF or SF. For an 8-player knockout we say Round of 8, then Semifinals, then Final.

### 8.3 Shared player loop (classic formats)
1. Enroll or Join (free or paid).
2. Check in when asked.
3. Admin or organizer Starts the cup.
4. Your match appears in the lobby.
5. Both seats tap Ready -> live board + clocks.
6. Results move the cup forward until standings or a Final decide the champion.
7. After any dispute waiting period, prizes can settle to wallets.

Arena loop: Start opens a timed window -> join the arena waiting line -> get paired -> play -> re-join until time ends -> highest arena points wins.

### 8.4 The five formats in plain sentences
| Format | What it is | Who usually becomes champion |
|--------|------------|------------------------------|
| Knockout | Lose once and you are out | Winner of the Final |
| Round robin | Everyone plays everyone once | Top of the standings table when all games finish |
| Swiss | Fixed number of rounds; pair by similar score | Top standings after the last round |
| Groups then knockout | Small group round robins, then knockout of advancers | Winner of the knockout Final |
| Arena | Play many games until the cup clock ends | Highest arena points at the end |

### 8.5 Who configures the hard rules
| Rule | Who sets it |
|------|-------------|
| Which formats exist | Admin catalog |
| Swiss round counts | Admin catalog |
| Group size and how many advance | Admin catalog (organizer cannot choose group size) |
| Arena default duration and streak points | Admin arena settings |
| Match clocks on every board | Admin Progression |

### 8.6 Critical groups fact
Organizers do not pick groups by hand. At Start the server shuffles players into groups. When every group game is finished, knockout starts automatically. Nobody presses a second Start for knockout.

### 8.7 How prize money is split (payout modes)
Paid cups need a payout mode. Organizer or admin chooses it at create (or the format default applies).

| Mode | Plain meaning | Tiny example (pot 1000) |
|------|---------------|-------------------------|
| Place percent | Pay by finish place only | 50/30/20 -> 500 / 300 / 200 |
| Share-score | Pay by points | Points 10, 6, 4 -> 500 / 300 / 200 |
| Dual purse | Split pot into place purse + points purse | 60% place / 40% points, then each purse pays its own way |

Prizes still wait for dispute window and settle. Full Who / What / When / Why / examples: Competition Formats Guide Part K2.

### 8.8 Community host fee (Ethiopia vs global)
Creating a Community cup charges a host fee from the organizer wallet. Admin sets two fees per host size on Events Host sizes (DataTable CRUD, same pattern as ads Campaign create fees). Currencies come from payment_currency. Geo blurb uses {ethiopia} / {global} placeholders.

| Organizer location | What they pay |
|--------------------|---------------|
| Ethiopia | Ethiopia host fee amount in payment_currency.ethiopia |
| Anywhere else | Global host fee amount in payment_currency.global |

The public create screen shows only the resolved fee for the organizer country. Official cups do not charge a host fee.

Full examples and every term spelled out: see Dama_Competition_Formats_Guide.
'''
    COMPLETE.write_text(no_em(text[:start] + new8 + text[end:]), encoding="utf-8")
    print("complete", COMPLETE.stat().st_size)


def main() -> None:
    COMP.write_text(no_em(COMP_BODY).strip() + "\n", encoding="utf-8")
    print("competition", COMP.stat().st_size)
    patch_complete()
    # Sanity: no banned abbreviations in competition guide body examples
    t = COMP.read_text(encoding="utf-8")
    for bad in ("QF (", "SF (", "Groups+KO"):
        if bad in t:
            raise SystemExit(f"banned token still present: {bad}")
    assert "\u2014" not in t
    print("ok")


if __name__ == "__main__":
    main()
