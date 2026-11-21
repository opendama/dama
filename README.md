# dama

Professional International Draughts (`10×10`, FMJD) tournament and gaming platform monorepo.

## Architecture

Hybrid client API model:

- **GraphQL** for dashboards, profiles, ads (and some tournament ops)
- **REST** for player Tournament discovery chrome/lists (Official \| Community), Hosting, payments, media
- **Go WebSockets** for live match moves and matchmaking

Host trust / scammer protection (Community cups, mig 522 to 529): phone for paid create; government ID + wallet lock for guaranteed prizes; open-cup limits (new 1 / phone 3 / ID 25) and reputation gates; badges Unverified host / Phone verified / Verified host. KYC auto-approve defaults ON. Human step-by-step: `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`. Technical: `docs/architecture.md`. Also Wallet / Competition / Complete guides.

## Workspace

```
apps/api       Go backend (engine, GraphQL, REST, WSS)
apps/web       Next.js player + ads portal
apps/admin     Next.js console (separate deployable app)
apps/mobile    Flutter player app (com.opendama.mobile)
packages/ui    Shared UI primitives
packages/*     Shared configs
```

## Quick start

```bash
docker compose up -d postgres redis
cd apps/api && go run ./cmd/server
pnpm install
pnpm --filter @dama/web dev
```

Console and API origins come from env (see `.env.example`). Do not put console URLs in player `NEXT_PUBLIC_*`.

## Quality

```bash
pnpm lint
pnpm format
```

## Self-hosting (cloud stack)

Dama’s production shape matches the Trim-style single-region cloud stack:

| Piece | Typical host | Hostname |
| --- | --- | --- |
| Web | Vercel / Cloudflare Pages | `opendama.com`, `www…` |
| API | Render / Fly / Docker (`apps/api/Dockerfile`) | `api.opendama.com` |
| Admin | Vercel (second project) | `admin.opendama.com` |
| Database + Auth | Supabase | - |
| Redis | Upstash | - |
| Media | Cloudinary (or CNAME) | - |

### Operator checklist (summary)

1. **DNS** - apex/www, `api`, and `admin`.
2. **Supabase** - apply `apps/api/migrations/` in filename order; enable Google Auth; redirect URLs for web, admin, localhost; set API `SUPABASE_JWT_SECRET` to the Supabase JWT secret.
3. **Redis** - `REDIS_URL` / `DAMA_REDIS_URL` (`rediss://…` for Upstash).
4. **Env packs** (gitignored) from local `.env`:
   ```powershell
   .\scripts\prepare-prod-env.ps1 -Domain "opendama.com"
   ```
   Or fill by hand: `.env.production.example`, `apps/api/.env.render.example`, `apps/web/.env.vercel.example`, `apps/admin/.env.vercel.example`.
5. **CORS** - `DAMA_CORS_ORIGINS` = real web + admin HTTPS origins only.
6. **Deploy** - Render API (`apps/api`) → Vercel web (`apps/web`) → Vercel admin (`apps/admin`).
7. **Smoke** - `GET /healthz` (liveness) → `GET /readyz` (Postgres+Redis) → OAuth → wallet / play.

Compose helpers:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --profile local-data --env-file .env.prod up -d --build
```

Full operator guide (Render + Vercel click paths): [docs/ops-deploy.md](./docs/ops-deploy.md).

## Maps (Leaflet / OSM)

Campaign geo targeting and admin telemetry pins follow the smart-menu `BranchLocationPinField` pattern:

- Web publisher create: CDN Leaflet (`apps/web/src/components/map/`), click-to-pin, device location, `POST /geo/locate`, then fee currency via `GET /ads/pricing?lat=&lng=`
- Admin: same Leaflet stack; telemetry uses `GeoBrowseMap` (browse pins). Campaign create lives on web/Flutter, not admin
- Flutter: `flutter_map` + `geolocator` (`LocationPinField`, `device_locate.dart`)
- Chrome keys live in `ad_runtime_chrome` / admin `telemetry` (migrations `287`, `288`, `289`)
- Campaign create requires a finite non-null-island map pin server-side (`err_map_pin_required`); reverse-geocode country required (`err_map_locate_failed`)
- Legacy `ph_lat` / `ph_lng` chrome is unused after the pin UI (mig `289` clears placeholders; not fail-closed)

No mock pins and no manual lat/lng text entry on create.

## Shared Telegram ops bot (manual receipt + payout)

Dama product lane in the shared `telegram_bot` (migs **415–425**): server-side fail-open notify on receipt/payout create → bot DMs → `X-Bot-Key` review on `/api/v1/telegram-bot/admin/dama/...`. Never reuse `BACKEND_API_URL` / `manual_payment_claim` for Dama. Review taxonomy: missing id → **404**, dual-actuator / invalid transition → **409**, unexpected → **500**. Admin config: `/payments/telegram-ops`. Details: `docs/architecture.md`, `docs/prd-compliance.md`, `telegram_bot/readme/readme.md`. Static locks: `node scripts/e2e-dama-telegram-ops-bot-check.mjs`. Web/Flutter unchanged (API notify).

## Samples

Folders `smart-menu-sample-referance-only-frontend` and `python-sample-referance-backend` are read-only references. Do not edit them. They will be removed once the dama product is complete.
