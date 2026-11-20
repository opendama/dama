# dama API (`apps/api`)

Go microservice for the dama platform.

Host trust / scammer protection (Community cups, mig 522 to 529): KYC auto-approve (default ON); phone for paid create; government ID + wallet lock for guaranteed prizes; open-cup limits (new 1 / phone 3 / ID 25) + reputation; DB badges Unverified host / Phone verified / Verified host. Human guide: `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md`. Technical: `docs/architecture.md`.

## Endpoints

- `GET /healthz`
- `GET /api/v1/feature-flags`
- `POST /api/v1/games/start`
- `GET /api/v1/games/{id}/state`
- `POST /api/v1/games/{id}/move`
- Payment webhooks under `/api/v1/webhooks/local` and `/api/v1/webhooks/international` (configure in your gateway dashboard; legacy aliases retained)
- `POST /graphql` (HTML playground opt-in via `DAMA_GRAPHQL_PLAYGROUND=1`)
- `GET /ws/game`

### In-app notifications (Trim-parity)

Player (auth):

- `GET /api/v1/me/notifications?skip=&limit=`
- `GET /api/v1/me/notifications/unread-count` (includes `notification_chrome` + badge)
- `POST /api/v1/me/notifications/{id}/read`
- `POST /api/v1/me/notifications/read-all`

Console (auth + console role):

- `GET /api/v1/console/notifications?skip=&limit=`
- `GET /api/v1/console/notifications/unread-count`
- `POST /api/v1/console/notifications/{id}/read`
- `POST /api/v1/console/notifications/read-all`

Kinds and emit inventory: `docs/architecture.md` (Shell notifications). Live checks: `node scripts/e2e-notifications-check.mjs`, `go run ./cmd/notifkindcheck`.

### Telegram ops bot bridge (mig 415–425)

Bot-authenticated adapter (header `X-Bot-Key` = `platform_settings.telegram_ops_bot.bot_api_key`):

- `GET /api/v1/telegram-bot/admin/dama/chrome`
- `GET|POST /api/v1/telegram-bot/admin/dama/receipts/...` (pending, detail, approve, reject+reason)
- `GET|POST /api/v1/telegram-bot/admin/dama/payouts/...` (pending+approved hub, detail, approve, reject+reason, paid)

Console SoT: `GET|PUT /api/v1/console/telegram-ops-bot`. Notify on create is fail-open and **not** gated on `EmitAdmins`. Shared bot env: `DAMA_API_BASE_URL` + `DAMA_BOT_API_KEY` (never `BACKEND_API_URL`). Review taxonomy: missing receipt/payout → **404**; dual-actuator / invalid transition → **409**; unexpected DB/review failures → **500** (never fake 404). E2E: `node scripts/e2e-dama-telegram-ops-bot-check.mjs`.

## Run

```bash
go mod tidy
go run ./cmd/server
```

