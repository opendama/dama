# -*- coding: utf-8 -*-
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / "Dama_Competition_Formats_Guide.md"
P=[]
def add(s): P.append(s.rstrip()+"\n\n")

add("""# Dama - Competition Formats Guide
Official Cups, Community Hosting, Knockout, Round Robin, Swiss, Groups+KO, Arena Bible

This companion bible explains every competition format and the Official vs Community vs Arena ownership model for non-technical readers. Regular hyphens only. Deep enough for organizers, Official cup players, Community participants, and admins.

Pair with the Complete App Guide for wallet/KYC gates on paid enroll and host fees.

## What is included
1. Who this guide is for
2. Competition glossary
3. Official vs Community vs Arena
4. Shared lifecycle (enroll -> check-in -> Start -> Ready/arena -> finish -> settle)
5. Knockout deep dive + numeric examples
6. Round robin deep dive + examples
7. Swiss deep dive + who sets rounds
8. Groups + knockout deep dive + who sets group size
9. Arena deep dive + scoring examples
10. Money: host fee, entry, commission, prize pool, payout modes
11. Visibility, invite codes, QR, privacy
12. Rated career rules for cup boards
13. Organizer create -> configure -> manage -> measure
14. Player steps
15. Admin console competition steps
16. Reports and settlement blockers
17. URLs
18. Troubleshooting
""")

add("""# 1. Who This Guide Is For

| Audience | Needs |
|----------|-------|
| Official cup player | Enroll, check-in, Ready, arena queue, prizes |
| Community participant | Join public/private, play, report |
| Hosting organizer | Create/start/close, roster, analytics |
| Platform admin | Catalog, Official cups, arena/standings/payout defaults, reports |
| Support | Explain byes, Swiss rounds, auto promotion, arena end |

# 2. Competition Glossary

| Term | Meaning |
|------|---------|
| Official | Admin-created platform tournament |
| Community / Hosting | Player-created cup under `/events/*` |
| Tournament hub | `/?view=tournaments` Official \| Community \| All |
| Catalog | Admin sizes/formats/fees organizers pick from |
| Host fee | Organizer create fee (not in prize pot) |
| Entry fee | Player join fee; commission split |
| Check-in | Confirm presence before classic seeding |
| Ready | Both seats confirm before board starts |
| Bracket | KO / groups KO structure |
| Standings | RR/Swiss/groups points table |
| Arena points | Continuous arena score with streaks |
| Bye | Automatic advance / counted win when odd |
| Rematch | Classic draw handling (replay match) |
| Payout mode | places_percent / score_share / dual_purse |
| Prize freeze | Lock pot calculation timing by format |
| Dispute window | Wait before settle |
| Escrow | Held prizes until settle credits wallet |
| MarkLive | Hosted cup goes live after Start path |
| Force finish | Admin/organizer end arena early |
| Late join | Arena-only optional join while live |
""")

add("""# 3. Official vs Community vs Arena

Arena is a **format**, not a third product. It can run as Official or Community.

| Dimension | Official | Community | Arena format |
|-----------|----------|-----------|--------------|
| Creator | Admin Console | Hosting organizer | Either when format=arena |
| Discovery | Official tab | Community if public; else code/QR | Same cup lobby |
| Start | Admin start | Organizer start (OTP possible) | Opens arena_ends_at window |
| Catalog edit | Admin | Read-only pick | Admin global arena settings |
| Career rated | Flag public_event_matches_rated | Flag AND public visibility; private never | Same parent rules |
| Pot freeze | Classic at Start; platform arena at finish | Classic at Start+MarkLive; hosted arena capture at finish | See left |

Platform tournaments are not registration-only - they run the same engines as hosted events.
""")

add("""# 4. Shared Lifecycle

## Who
Players, organizers, admins depending on cup kind.

## What / How (classic formats)
1. Create cup (admin or organizer).
2. Players enroll/join (free Join silent enroll, or paid Enroll with wallet).
3. Optional check-in window - classic Start seeds **checked-in** seats only.
4. Start builds bracket / RR slate / Swiss R1 / groups.
5. Both seats Ready -> server starts PvP game + arms clocks.
6. Results advance structure; classic draws rematch.
7. Ready-timeout can auto-forfeit no-shows when configured.
8. Cup completes -> dispute window -> prize escrow settle to wallet.

## Arena difference
- Start opens timed window; seeds from **enrolled** (not check-in bracket seed).
- Players join cup arena queue; worker pairs; optional auto-start.
- Re-queue until clock ends or force finish.
- Draws award arena points (not rematch).
""")

add("""# 5. Knockout

## Who / What / When / Why / Where
Who: Players in KO Official or Community cups; organizers/admins who create size.
What: Single elimination. Shuffle at start; pad to next power of 2; byes auto-advance.
When: After Start and Ready.
Why: Fast champion path.
Where: Cup lobby bracket view; live boards via Ready.

## How - player
1. Enroll/join; check in.
2. Find your bracket match after Start.
3. Both Ready -> play.
4. Win advances; loss eliminates.
5. Draw -> rematch per classic rules.

## How - organizer/admin
1. Pick KO from enabled catalog formats and a size.
2. Start when min_players_to_start met and check-ins ready.
3. Use force-start / forfeit / rematch tools when product allows.
4. Finish -> payout mode settlement.

## Numeric examples
- 8 players: QF (4) -> SF (2) -> Final (1). Seven decisive bracket games if no rematch extras.
- 5 players: pad to 8 with 3 byes.
- 6 players: pad to 8 with 2 byes.
- Paid example places_percent 50/30/20 on frozen pot after dispute.

## Who configures
Admin catalog: size, min players, payout defaults. Organizer picks size/format at create; does not invent bracket math.
""")

add("""# 6. Round Robin

## Who / What
Everyone plays everyone once. Champion = top standings points when every match finishes. No byes for structure completion - odd cases still play the full pairing slate the engine builds. Cup ends only when slate complete.

## Standings points
Admin Standings settings: win points and draw points in client_enums. Classic rematch means draw points apply when a match finishes as draw with null winner.

## Numeric examples
- 4 players: matches AB AC AD BC BD CD = 6 games.
- 6 players: 15 games.
- 8 players: 28 games.

## How - player
1. Join/check-in/Start.
2. Play each assigned pairing via Ready.
3. Watch standings table.
4. Wait until all games done for champion.

## Who configures
Catalog size caps. Admin standings win/draw points. Organizer does not set points math.
""")

add("""# 7. Swiss

## Who / What
Fixed number of rounds from admin catalog map `swiss_rounds_by_max_players`. Pair by points each round; avoid rematches when possible; odd player gets a bye (counts as win). Next round generates when current round fully finishes.

## Who sets round count
**Admin only** in Events catalog. Organizer does not type round count.

## Default map examples (seed; live DB may differ)
| Max players | Rounds |
|-------------|--------|
| 8 | 3 |
| 16 | 4 |
| 32 | 5 |
| 64 | 6 |

## Numeric example
16-player Swiss -> 4 rounds. Roughly 8 games per round if everyone plays (bye if odd).

## How - player
1. Check in; Start; play round pairings via Ready.
2. After round completes, new pairings appear.
3. Final standings decide champion (plus payout mode).

## How - admin
1. Edit Swiss rounds map carefully before go-live.
2. Create Official Swiss cup or ensure Community catalog enables Swiss for sizes.
""")

add("""# 8. Groups + Knockout

## Who sets group size
**Admin catalog only**:
- `groups_knockout_target_group_size` (default seed **4**)
- `groups_knockout_advance_per_group` (default seed **2**)

Organizers **cannot** change group size or advance count at create. They only pick the format if enabled.

## What happens
1. Start shuffles players into groups targeting catalog group size.
2. Each group plays round robin.
3. When **all** group matches finish, server **auto-promotes** top N per group into knockout.
4. No manual "start knockout" button.
5. If fewer than 2 advancers overall, cup may finish on overall group standings (degenerate path).

## Numeric example
8 players, group size 4, advance 2:
- Group A four players RR (6 games)
- Group B four players RR (6 games)
- Top 2 each -> 4-player knockout (semis + final)

## How - organizer day-of
1. Start when check-ins ready.
2. Tell players to finish all group games.
3. Watch for automatic KO bracket appearance.
4. Do not wait for an admin to press promote.
""")

add("""# 9. Arena

## Who / What
Timed continuous matchmaking inside the cup until `arena_ends_at` (or force finish). Champion = top arena points.

## Admin global settings (Tournaments page Arena settings)
Examples of seeded defaults (live DB authoritative):
- Default duration 60 minutes
- Pair interval 5 seconds
- Pairing modes: rating | score
- Auto-start option
- Allow join while live option
- Points: win 2, draw 1, loss 0
- Streak: 2nd consecutive win 3; 3rd+ win 4

## Organizer/admin per cup
May set `arena_duration_minutes` (clients compose Minutes/Hours/Days/Weeks/Months or Ends-at calendar into minutes; omit → platform default).

## How - player
1. Enroll/join (check-in not the arena seed path).
2. After Start, open arena lobby; Join queue.
3. Get paired; play; points update; re-queue.
4. Stop when arena ends; view standings.

## How - organizer
1. Create format arena; set duration if offered.
2. Start; announce end time.
3. Optional force finish endpoint.
4. Late join only if admin allow-join-while-live is true (classic formats still block post-start join).

## Numeric example
60-minute arena, 4 enrolled, pair every 5s, rating mode, auto-start on. Players loop games; ranking by arena points with streak bonuses; pot freeze at finish for platform arena rules.
""")

add("""# 10. Money: Fees, Pot, Payout Modes

## Host fee
Organizer wallet debit at Community create. Not in prize pot. Public cups may multiply host fee by public_host_fee_multiplier.

## Entry fee
Player debit on paid join/enroll. SplitEntryFeeCommission -> organizer net + platform commission ledger. Dashboard shows gross/commission/net.

## Prize pool display
Paid cups only; killed if platform flags off. prize_pool_now = max(sum(entry organizer nets), held guarantee floor). prize_pool_if_full = max(seats x per-seat net, held guarantee) for classic fixed caps. Free forced off.

## Guarantee
Organizer toggle when prize_pool_guarantee_enabled. Create is one DB transaction (event insert + wallet hold + host fee); fail rolls back with no orphan cup. Capture on classic Start (Arena at finish) stamps captured; release on cancel before start; reopen is one DB transaction (cycle bump + re-hold + status). Insufficient wallet -> 402 on create/reopen. Official tournament Guaranteed display is declared pot, not this hold.

## Freeze timing
Classic: freeze at Start (hosted also MarkLive / capture rules). Platform arena: freeze at finish. Hosted arena: capture guarantee into freeze at finish before escrow.

## Payout modes (plain language bible)

A payout mode answers: after this paid cup ends, how do we divide the prize pool?

Who chooses: organizer (Community) or admin (Official) at create. If omitted, the platform uses the per-format default.
When money moves: after finish, dispute window, and settle (open reports block settle). Console settle is also available.
Where players see it: cup create/edit, lobby prize text, wallet after settle.

### Place percent (places_percent / place %)
What: pot is split only by finish place. Percents must sum to 100.
Example pot 1000 with 50/30/20: 1st 500, 2nd 300, 3rd 200.
Ignores: mid-cup points that do not change your final place label.
Picture: three envelopes labeled 1st, 2nd, 3rd.
Best for: simple podium story (many knockout cups).

### Share-score (score_share)
What: pot is split by standings/arena points. Slice = your points / total points of sharers.
Example pot 1000 with points 10, 6, 4 (total 20): 500, 300, 200.
Knockout note: phase win points can still give eliminated early winners a share.
Ignores: fixed place envelopes.
Picture: a pie cut by the scoreboard.
Best for: arena and score-first cups.

### Dual purse (dual_purse)
What: pot is cut into two purses first.
1. Place purse - paid by finish place percents.
2. Performance purse - paid by points (share-score style).
Admin dual place percent decides how much of the pot goes to the place purse; the rest is performance.
Example: dual place percent 60 on pot 1000 -> place purse 600, performance purse 400. A player can earn from both.
If total performance points are 0, product fails closed toward full-pot place behavior.
Picture: two cash boxes - podium money and score money.
Best for: reward both podium and hard scorers.

| If you want… | Choose |
|--------------|--------|
| Simple 1st/2nd/3rd envelopes | Place percent |
| Money follows the scoreboard | Share-score |
| Both podium and scoreboard | Dual purse |

## How - player paid Official enroll
1. Tap Enroll; payment modal; top up if short.
2. Pass cash/OTP gates.
3. Land in cup lobby `/?view=tournaments&id=`.
""")

add("""# 11. Visibility, Codes, QR, Privacy

| Visibility | Behavior |
|------------|----------|
| public | Community tab when public_events_enabled |
| private | Hidden; join code / share URL / QR only |

Invite template: `/?view=tournaments&source=community&code={code}`
QR download filename from Content-Disposition (dama-tournament-...).
Join always auto-approved.
Private: detail/entries/bracket/share/QR require organizer or approved entry; private games excluded from Watch; spectate/state/votes/chat gated.
""")

add("""# 12. Rated Career on Cup Boards

| Cup | Rated when |
|-----|------------|
| Community private | Never |
| Community public | public_event_matches_rated flag on |
| Official | Same flag (no visibility gate on official games) |

Cup standings/arena points/prizes are independent of career Elo/XP. HoF uses rated match_history wins.
""")

add("""# 13. Organizer: Create -> Configure -> Manage -> Measure

## Who
Signed-in player when hosted_events_enabled.

## Where
`/events/events?create=1`, `/events/dashboard`, `/events/analytics`, nested `/events/wallet` etc. Flutter events_shell.

## How - Create
1. Fund wallet for host fee (+ guarantee if used).
2. Choose enabled size+format; visibility; entry; payout mode; branding; optional guarantee.
3. Pay host fee; OTP if required.
4. Receive share path / QR.

## How - Configure
PATCH title/visibility/entry/payout before live; logos/sponsor; entry-fee-quote for commission preview.

## How - Manage
Share link/QR; kick before live (refund); Start; bracket force tools; arena finish; close/cancel before start (refunds+release guarantee); reopen if never started/finished.

## How - Measure
Dashboard KPIs; analytics table; nested wallet/transactions/receipts.

## Cannot
Edit global catalog; run Official cups; bypass cash/OTP; set Swiss rounds or groups size.
""")

add("""# 14. Player Steps (Official & Community)

1. Open hub Official or Community (or invite).
2. Join/enroll (pay if needed).
3. Open lobby `/?view=tournaments&id=`.
4. Check in when classic window open.
5. Classic: Ready on match -> board. Arena: join arena queue.
6. Spectate allowed games via spectate URL.
7. Finished: standings/winners; report if needed; await settle.
""")

add("""# 15. Admin Competition Steps

## Catalog (Events page, events.manage_catalog)
Sizes, enabled formats, host fees, commission %, public host fee multiplier, Swiss map, groups size/advance, min players, report reasons, public/rated related flags as designed.

## Official Tournaments (tournaments.write)
CRUD cups; Start; bracket force tools; arena finish; settle prizes; tournament reports.

## Cards on Tournaments page
Arena settings; Standings settings; Payout defaults (modes + place % + dual_purse place percent); Points toast settings.

## Hosted reports (events.manage_reports)
Dismiss or deactivate (deactivate refunds+vacates+cancels).

## Feature flags affecting cups
hosted_events_enabled, public_events_enabled, public_event_matches_rated, prize_pool_display_enabled, prize_pool_guarantee_enabled, cash/OTP gates.
""")

add("""# 16. Reports & Settlement Blockers

Player: report from cup lobby (Official or Community).
Admin: dismiss/resolve; deactivate hosted if needed.
Effect: open reports block prize settle until cleared.
""")

add("""# 17. URL Reference

| Intent | Path |
|--------|------|
| Hub | `/?view=tournaments` |
| Community invite | `/?view=tournaments&source=community&code=` |
| Lobby | `/?view=tournaments&id=` |
| Host create | `/events/events?create=1` |
| Hosting home | `/events/dashboard` |
| Join UI | `/events/join` |
| Live board | `/?gameId=` |
| Spectate | `/?view=spectate&gameId=` |
| Admin Official | Admin `/tournaments` |
| Admin catalog | Admin `/events` |

Legacy view=events /events/public remap to Community.
""")

add("""# 18. Format Decision Guide (Organizer)

| Goal | Pick |
|------|------|
| Fast single winner, small field | Knockout |
| Everyone plays everyone | Round robin (keep size small) |
| Large field, limited rounds | Swiss (admin rounds map) |
| Group stage then finals | Groups+KO (admin group size) |
| Continuous play for a time window | Arena |

# 19. Numeric Walkthrough Pack

1. KO 8 places% 50/30/20 - freeze at start; settle after dispute.
2. KO 5 - pad to 8 with 3 byes.
3. RR 6 - 15 matches; standings champion.
4. Swiss 16 - 4 rounds from default map.
5. Groups+KO 8 / size4 / adv2 - two RR groups then 4-player KO auto.
6. Arena 60m / 4 players - queue loop; finish freeze; score_share or dual_purse common.

# 20. Troubleshooting

| Symptom | Check |
|---------|-------|
| Cannot Start | min players, check-ins, permissions, OTP |
| No KO after groups | Unfinished group games; wait auto promote |
| Swiss wrong rounds | Admin catalog map |
| Cannot late join | Not arena or flag off |
| Private cup invisible | Need code; not in public list |
| Not rated | Private or flag off |
| No prize | Dispute window; open reports; settle worker; payout mode |
| Host create 402 | Host fee or guarantee wallet short |
| Watch missing cup game | Private bracket exclusion |

## Related
Complete App Guide; Play guide for board/Ready clocks; Wallet guide for fees/payouts.
""")

t="".join(P)
assert "\u2014" not in t
OUT.write_text(t, encoding="utf-8")
print(OUT.stat().st_size)
