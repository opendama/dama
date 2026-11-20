# Dama production deploy (operator guide)

Single-region production stack, aligned with the Trim cloud pattern: **stateless API**, **managed Postgres**, **managed Redis**, **separate web + admin frontends**.

| Piece | Typical host | Notes |
| --- | --- | --- |
| Web | Vercel / Cloudflare Pages | Root directory `apps/web`; `vercel.json` install/build |
| Admin | Vercel (second project) | Root directory `apps/admin`; never embed service_role |
| API | Render / Fly / Docker | `apps/api/Dockerfile`; probe `GET /readyz` |
| Database + Auth | Supabase | Apply `apps/api/migrations/*.sql` in filename order |
| Redis | Upstash | Prefer `rediss://…` in `REDIS_URL` / `DAMA_REDIS_URL` |
| Media | Cloudinary (or CNAME) | `DAMA_MEDIA_PUBLIC_BASE` + `NEXT_PUBLIC_MEDIA_CDN_HOST` |
| Payments | Chapa + Paddle | Webhooks on public API HTTPS |

`GET /healthz` = process liveness. `GET /readyz` = Postgres + Redis **Ping** (also `CMD ["/app/server","-readyz"]` for Docker HEALTHCHECK).

## One-shot env pack (from local `.env`)

```powershell
# From repo root - Domain is required (no invent hostnames)
.\scripts\prepare-prod-env.ps1 -Domain "opendama.com"
# Optional: also replace weak change-me JWT / SECRETS_KEY in root .env
.\scripts\prepare-prod-env.ps1 -Domain "opendama.com" -SyncSecretsToRoot
```

Writes gitignored files (never commit):

| File | Use |
| --- | --- |
| `.env.prod` | Compose / generic secrets pack |
| `apps/api/.env.render` | Paste into Render Environment (skip `#` comment lines) |
| `apps/web/.env.vercel` | Paste into Vercel web project (`apps/web`) |
| `apps/admin/.env.vercel` | Paste into Vercel admin project (`apps/admin`) |

Pack rules: `rediss://` Redis, Supabase transaction pooler when present, production hosts `opendama.com` / `api` / `admin`, no `DAMA_ALLOW_*` stubs, no `service_role` in Vercel.

Templates (safe to commit): `.env.production.example`, `apps/api/.env.render.example`, `apps/web/.env.vercel.example`, `apps/admin/.env.vercel.example`.

If local `DAMA_JWT_SECRET` / `DAMA_SECRETS_KEY` still contain `change-me`, the script generates strong values into the prod packs only - copy them back into your secret store and rotate any already-deployed tokens.

## Operator checklist

1. **DNS** - point apex/www, `api`, and `admin` at your hosts (Cloudflare DNS is fine on Free).
2. **Supabase** - enable Google Auth; redirect URLs for:
   - `https://opendama.com/auth/callback`
   - `https://admin.opendama.com/auth/callback`
   - localhost callbacks for dev  
   Set API `SUPABASE_JWT_SECRET` to the Supabase JWT secret. First API boot applies migrations unless `DAMA_SKIP_MIGRATE=1`.
3. **Redis** - Upstash `rediss://…` (TLS). Avoid plain `redis://` on the public internet.
4. **Env packs** - run `prepare-prod-env.ps1` or fill the `*.example` files by hand.
5. **CORS** - `DAMA_CORS_ORIGINS` = real web + admin HTTPS origins only.
6. **Payments** - Chapa/Paddle webhook URLs → `https://api…/api/v1/payments/…/webhook`.
7. **Deploy** - API → web → admin (same git commit when possible).
8. **Smoke** - `GET /healthz` → `GET /readyz` → Google OAuth on web → console login on admin → wallet / play.

## You-do sequence (browser-first; Trim-shaped)

Do these yourself. Do not commit secrets (`.env`, `.env.render`, `.env.vercel`, `.env.prod`).

1. **GitHub (browser)** - create empty private repo `dama` (no README/license if local already has commits).
2. **Push local `dama/`**
   ```powershell
   cd C:\Users\berek\Downloads\C-Projects\addismender-project\dama
   git remote add origin https://github.com/back-y/dama.git
   git push -u origin main
   ```
   (Adjust the URL if your repo name/owner differs.)
3. **Supabase Auth** - add redirect URLs for web + admin `/auth/callback` (and localhost for dev).
4. **Render** - Blueprint or Docker service from this repo → paste `apps/api/.env.render` → `/readyz`.
5. **Vercel web** - root `apps/web` → paste `apps/web/.env.vercel`.
6. **Vercel admin** - root `apps/admin` → paste `apps/admin/.env.vercel`.
7. **Smoke** - `/healthz` → `/readyz` → Google OAuth → admin login.

## Git repo (required before cloud attach)

Dama must be its **own** git repository (Trim pattern), not only a folder inside `addismender-project`. Local `git init` + commits may already exist; create the empty GitHub repo in the **browser**, then push as in step 2 above.

## Render (API) - click path

**Option A - Blueprint (preferred)**  
1. Push this repo to GitHub.  
2. Render → **New** → **Blueprint** → select repo (reads root `render.yaml`).  
3. Fill every `sync: false` env from `apps/api/.env.render`.  
4. Deploy → open `https://dama-api.onrender.com/readyz`.

**Option B - Manual Web Service**  
1. New **Web Service** → connect the dama repo.  
2. **Runtime:** Docker  
   - Root directory: `apps/api`  
   - Dockerfile path: `./Dockerfile`  
   - Docker build context: `.` (under `apps/api`)  
3. **Health check path:** `/readyz`  
4. **Environment:** import keys from `apps/api/.env.render`.  
   Do **not** set `DAMA_ALLOW_MEMORY`, `DAMA_ALLOW_DEV_SECRETS`, `DAMA_ALLOW_E2E_AUTH`, `DAMA_ALLOW_PAYMENT_STUB`.  
5. Deploy → wait until `/readyz` returns `{"status":"ok",…}`.  
6. Custom domain: `api.opendama.com` → TLS.  
7. After a green migrate, optionally set `DAMA_SKIP_MIGRATE=1` and run migrate-only jobs via `go run ./cmd/migrateonly` when you ship SQL.

First boot without a custom domain: re-run env prep with the Render hostname, then update CORS + public API base:

```powershell
.\scripts\prepare-prod-env.ps1 -Domain "onrender.com" -ApiHost "dama-api.onrender.com" -WebHost "dama-web.vercel.app" -AdminHost "dama-admin.vercel.app"
```

Then paste the refreshed packs into Render/Vercel and redeploy. Swap to your real domain when DNS is ready.

## Vercel (web + admin) - click path

| Setting | Web | Admin |
| --- | --- | --- |
| New project | Root Directory `apps/web` | Root Directory `apps/admin` |
| Include files outside root | **On** (pnpm workspace) | **On** |
| Install / build | from `vercel.json` | from `vercel.json` |
| Env | import `apps/web/.env.vercel` | import `apps/admin/.env.vercel` |
| Domain | `opendama.com` / `www` | `admin.opendama.com` |

Never put `SUPABASE_SERVICE_ROLE_KEY`, DB passwords, `DAMA_JWT_SECRET`, or `DAMA_SECRETS_KEY` in any `NEXT_PUBLIC_*` var.

Put **Cloudflare Access** (or SSO) in front of production admin.

## Self-host API with Compose

```bash
cp .env.production.example .env.prod   # or use prepare-prod-env.ps1
# fill secrets; DATABASE_URL + REDIS_URL = Supabase + Upstash

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Optional local Postgres/Redis sidecars (staging only):
docker compose -f docker-compose.prod.yml --profile local-data --env-file .env.prod up -d --build

# Windows Hyper-V host port 8080 blocked:
docker compose -f docker-compose.prod.yml -f docker-compose.port.override.yml --env-file .env.prod up -d --build
```

Local full stack (dev) remains `docker compose up` via `docker-compose.yml`.

## Flutter

Ship via Play Store / App Store with the same public API/WS/Supabase URLs as web. No Docker image for mobile.

## Day-2 HA (supported sketch)

| Layer | Free / low-cost path | Notes |
| --- | --- | --- |
| API | Render / Fly Docker | Probe `/readyz`; scale replicas only when Redis+Postgres are shared managed |
| DB | Supabase Postgres | Pooler URL for API; direct URL for heavy migrate jobs if needed |
| Cache | Upstash Redis | TLS; presence / rate limit / matchmaking state |
| Web | Vercel | `apps/web` + `apps/admin` |
| Edge | Cloudflare DNS + WAF | Access policy on admin |

Two API replicas on one host (demo only):

```bash
docker compose -f docker-compose.multi-region.example.yml --profile demo up -d --build
```

Multi-region anycast / read replicas are ops Day-2 - keep payment webhooks on a **single** primary API URL.

## Fail-closed production rules

- No `DAMA_ALLOW_MEMORY`, `DAMA_ALLOW_DEV_SECRETS`, `DAMA_ALLOW_E2E_AUTH`, `DAMA_ALLOW_PAYMENT_STUB`
- No console origins inside player `NEXT_PUBLIC_*`
- Weak `change-me-*` JWT/secrets keys are rejected for real traffic - rotate before first public users
