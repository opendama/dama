# Dama documentation bibles

These guides are the product bibles for Dama (web, Flutter, Admin Console, Telegram ops). Written for non-technical readers with Who / What / When / Why / Where / How, step-by-step flows, and a glossary of terms.

## Word downloads
Folder: `docs/guides/downloads/`
- Dama_Complete_App_Guide.docx - master bible for all roles
- Dama_Play_And_Matchmaking_Guide.docx - play, queue, invites, timer, pause/resume, stop game
- Dama_Competition_Formats_Guide.docx - knockout, RR, Swiss, groups+KO, arena (if this file is locked open in Word, use `Dama_Competition_Formats_Guide_refresh.docx`)
- Dama_Wallet_Payments_And_Compliance_Guide.docx - wallet, KYC, payouts, Telegram ops
- Dama_Host_Trust_And_Scammer_Protection_Guide.docx - host trust, phone/ID tiers, open-cup limits, locked guaranteed prizes (human step by step)
- Dama_Ads_And_Admin_Ops_Guide.docx - publishers + admin console

Markdown mirrors of the same names also live under `downloads/`.

## Markdown sources
Same names as `.md` in this folder.

Host trust and scammer protection (plain language): `Dama_Host_Trust_And_Scammer_Protection_Guide.md`. Architecture detail: `docs/architecture.md`.

## How to regenerate DOCX
From repo root: `python scripts/build-dama-guide-docx.py`
If a primary `.docx` is locked by another app, the script writes `*_refresh.docx` instead.

## Note on Smart Menu sample docs
`smart-menu-sample-referance-only-frontend/` holds hospitality reference manuals. Those are not Dama. These Dama bibles are the game-platform equivalents.
