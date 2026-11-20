# Dama admin console

Next.js console app (`@dama/admin`). Separate deployable surface from the player web app.

## Local

```bash
# From monorepo root
pnpm --filter @dama/admin dev
```

Copy `apps/admin/.env.example` → `apps/admin/.env.local`. Match API publish port (`DAMA_API_PUBLISH_PORT`, often `18080` on Windows when `8080` is reserved). Prefer console bind `3201` when Hyper-V excludes `3001`.

Never put console origins into the player web `NEXT_PUBLIC_*` set.

## Deploy

Host on `admin.opendama.com` (or your subdomain) as a **second** Vercel/Pages project with root `apps/admin`. Put Cloudflare Access or SSO in front for production.

- Dockerfile (optional self-host): build from monorepo root  
  `docker build -f apps/admin/Dockerfile -t dama-admin .`
- Env: browser-safe `NEXT_PUBLIC_*` only (see `.env.example`). Never embed Supabase `service_role`, DB passwords, or API signing keys.

Operator checklist: [docs/ops-deploy.md](../../docs/ops-deploy.md).

## Security

- Console RBAC and permissions are API-enforced.
- Suspended / disabled accounts are rejected by API auth middleware.
- Do not enable `DAMA_ALLOW_E2E_AUTH` or other local-only API escapes against a production API.
