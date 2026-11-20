# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(__file__).resolve().parents[1] / "Dama_Complete_App_Guide.md"
extra = r'''

# 29. Support Macros (Copyable Replies)

## Macro - Guest cannot join queue
Dama guest practice is VS-AI only. To use Find Match, challenges, friends, wallet, or cups, sign in with Google. After sign-in, open Find Match from the New Game rail or Matchmaking view.

## Macro - Clock hit zero
Your device showing 0:00 starts a flag claim. The server must confirm remaining time. If the game continues, wait a moment for the server sweeper/claim. Refresh should show the same remaining time, not a full reset. If time rewinds to full after refresh, report it as a clock bug.

## Macro - Manual receipt pending
Manual bank top-up waits for a human reviewer in Admin Console or Telegram ops. You will get a notification when it is approved or rejected. Keep your transfer reference handy.

## Macro - Cannot payout
Check: payout phone saved (8 characters), document KYC approved if required, cash/RMG enabled for your country, age gate completed, location/eligibility fresh, and OTP verified if the platform requires it.

## Macro - Private cup not in list
Private Community cups do not appear in public Community browse. Open the organizer invite link, QR, or join code. After you join, the lobby becomes available to you.

## Macro - Ads not showing in my game
Campaigns show only when status is servable, schedule is enabled, geo matches, first-show/interval timing allows it, and impression/spend caps are not exhausted. Admins set global timing defaults; publishers cannot force a show.

# 30. Safety and Fair Play Notes (Non-Technical)

- The server validates every move and every clock debit.
- Spectators cannot burn player clocks or claim flag-fall.
- Seated players cannot cast spectator win votes for their own game.
- Clients do not invent button labels; missing chrome fails closed.
- Payment country is decided server-side; changing profile country does not spoof checkout.
- Dual-actuator money review prevents double credit: first successful review wins.
- Open cup reports can block prize settlement until resolved.
- Auto-closed ad campaigns cannot be reopened after the end time worker archives them.

# 31. Related Docs Inside the Repo

| Doc | Audience |
|-----|----------|
| `docs/guides/Dama_Complete_App_Guide.md` | Everyone - this bible |
| `docs/guides/Dama_Play_And_Matchmaking_Guide.md` | Play/support |
| `docs/guides/Dama_Competition_Formats_Guide.md` | Players/organizers/admins for cups |
| `docs/guides/Dama_Wallet_Payments_And_Compliance_Guide.md` | Money/compliance/ops |
| `docs/guides/Dama_Ads_And_Admin_Ops_Guide.md` | Publishers + console ops |
| `docs/architecture.md` | Engineers / advanced ops contracts |
| `docs/ops-rbac-and-ads-runtime.md` | RBAC + in-match ads runtime |
| `docs/prd-compliance.md` | Compliance checklist against PRD |

End of Complete App Guide.
'''
assert "\u2014" not in extra
t = p.read_text(encoding="utf-8")
if "# 29. Support Macros" not in t:
    p.write_text(t + extra, encoding="utf-8")
print(p.stat().st_size)
