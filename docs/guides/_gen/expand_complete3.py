# -*- coding: utf-8 -*-
from pathlib import Path
p = Path(__file__).resolve().parents[1] / "Dama_Complete_App_Guide.md"
e = """

# 32. Document Control

Version: product bible aligned to current Dama web, Flutter, Admin Console, API, and Telegram ops.
Maintainers: update this file whenever Play, cups, wallet, ads, or admin IA changes.
Style: Who / What / When / Why / Where / How; numbered steps; plain language; regular hyphens only; no invented features.
Companion bibles carry deep procedures; this file remains the master map.

If a live screen label disagrees with this guide, trust the database chrome for that environment, then patch this guide.

Additional onboarding note for support leads: keep a staging checklist with two signed-in accounts, one guest session, one manual receipt, one Community invite code, and one servable test campaign. Re-run that checklist after every major release that touches Play, payments, competition, or ads.
"""
assert "\u2014" not in e
t = p.read_text(encoding="utf-8")
if "# 32. Document Control" not in t:
    p.write_text(t + e, encoding="utf-8")
print(p.stat().st_size)
