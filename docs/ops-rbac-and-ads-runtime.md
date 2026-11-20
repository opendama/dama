# Ops: Console RBAC + in-match ads runtime

All values are database-backed (`platform_settings`, `rbac_*`, `ad_campaigns`, `ad_impression_events`). API `ReloadAdRuntimeChrome` / `ReloadRBACChrome` / `ReloadAdPlayerChrome` reject incomplete JSON (no partial chrome with `Source=database`). Clients fail closed when chrome or policy is missing. No client invents timings, placements, labels, creative types, or manage-campaigns href.

## Admin RBAC (`/rbac`)

Requires JWT console role **and** permission `rbac.manage` (seeded to `superadmin` only). Nav: console module `href=/rbac`. Split `rbac/page.tsx` + `rbac-client.tsx`. UI is Trim-style **tabs** (default catalog / permissions / grants) with OpsDataTable selection, view/edit dialogs, confirm delete, bulk delete, and grants matrix with title+description + search (chrome mig **328**).

| CRUD | Admin UI | API |
| --- | --- | --- |
| **R** roles + permissions + grants | Page loads snapshot | `GET /api/v1/console/rbac` |
| **C/U/D** roles catalog | Catalog tab → Save | `PUT /api/v1/console/rbac/catalog` (refuse delete if any user still has that role) |
| **C/U** permission | Permissions tab create/edit modal → Upsert | `PUT /api/v1/console/rbac/permissions` |
| **R** permission detail | View modal | same snapshot row |
| **D** permission | Row confirm / bulk confirm (cascades grants) | `DELETE /api/v1/console/rbac/permissions/{key}` (blocked for `rbac_chrome.protected_permission_keys`) |
| **U** role grants | Grants tab checkboxes → Save | `PUT /api/v1/console/rbac/roles/{role}/permissions` (refuse stripping a protected key from the last role that holds it) |
| Self permissions + chrome | Gate UI | `GET /api/v1/console/me/permissions` (`chrome` + `ads_chrome`) |

## Admin users (`/users`)

Requires `users.read` (role/active writes: `users.write_role` / `users.write_active`; UI gated via `useMyPermissionsQuery` + chrome keys mig **329**). List enrich: email, `avatar_thumb_url`, `primary_phone`; search `q` matches username/email/phone/id. Detail: `GET /console/users/{id}` returns `User.Self()` (incl. DOB/KYC) plus `payout_methods` as `[]` on success (key omitted on payout list error - UI shows load-failed, not empty). Admin UI: split `users-client` + `/users/[id]`; OpsDataTable selection; bulk/role/status ConfirmDialogs; smart-menu-style copy controls on id/email/phone (chrome mig **330**); detail modal uses identity-body skeleton + responsive footer actions. Selection-aware `showSelection` shimmers also aligned on tournaments/ads/events/telemetry/media-pool/progression (plus banks/payments/avatars/users). No invite/GDPR erase/credits without Dama APIs.

Activity analytics (`/activity`) requires `activity.read` (seeded to `admin` + `superadmin` in mig **171**). Endpoint: `GET /api/v1/console/activity?period=` (periods / windows / `series_max_buckets` from `platform_settings.activity_analytics` only; chrome mig **171–180**). **Apply migrations 171–180 in order** - LoadConfig fails closed if `series_max_buckets` &lt; max `period_window_days` (older installs need mig **175**); Usage chrome mig **178**; heatmap/cumulative/breakdown chrome mig **179**; UTF-8 outcomes meta mig **180**. Public Status: `GET /api/v1/public/platform-stats` (no auth; community KPIs + full Trim-parity dashboard sections; no `new_users` series).

## Admin runs in-match ads (`/ads`)

Meta/YouTube-style: **frequency caps** (impressions per calendar day/week/month/year) + **pacing** (first show delay + repeat interval on active games) + **non-skippable window**.

### Operator flow

1. Publisher creates campaign + creative (`POST /ads/campaigns`).
2. Status → servable (`client_enums.servable_campaign_status`).
3. Admin (or publisher) enables schedule and sets:
   - **First show** after game start (seed platform default **60s**; campaign override or empty = platform).
   - **Repeat interval** on active games (seed platform default **300s** = every 5 minutes).
   - **Daily / weekly / monthly / yearly impression caps** (empty = unlimited for that period).
   - Optional **per-campaign non-skippable** override (empty = platform).
4. Active games poll `POST /ads/in-match/eligibility`; server returns `show` + effective timings only when schedule, interval, first-show, geo, spend, and period caps allow it.
5. When a period cap is exhausted, reason is `period_cap_reached` and `next_check_after_seconds` is the soonest UTC day/week/month/year boundary that clears that cap (not the repeat interval).
6. Player skip stays locked until returned `non_skippable_seconds` elapses.
7. Each play records an impression with a **DB placement key** (`ad_player_chrome.placement_lobby` / `placement_in_match`); caps count `ad_impression_events` by UTC calendar period. In-match impressions require servable status + `schedule_enabled`; period caps always apply when set.

### Flexible non-skippable seconds (not static)

| Concern | Where |
| --- | --- |
| Live value (seed default **10**) | `platform_settings.ad_playback.non_skippable_seconds` |
| Admin increase/decrease | Admin `/ads` global form → `PUT /console/ads/playback` |
| Allowed range | Same row: `non_skippable_min` / `non_skippable_max` |
| Per-campaign override | Campaign schedule field (null = inherit platform; invalid = fail closed) |
| Players | Only eligibility/playback `non_skippable_seconds` |

### APIs

| Action | API |
| --- | --- |
| Public playback + bounds + player chrome (incl. placements) | `GET /api/v1/ads/playback` |
| In-match decision | `POST /api/v1/ads/in-match/eligibility` |
| Console global policy | `GET/PUT /api/v1/console/ads/playback` (`ads.manage_runtime`) |
| Console campaigns + schedule + status | `GET/PATCH .../console/ads/campaigns...` (`ads.manage_campaigns`) |
| Publisher schedule | `PATCH /api/v1/ads/campaigns/{id}/schedule` |
| Impression (placement required, must match DB keys) | `POST /api/v1/ads/campaigns/{id}/impression` |

## Chrome / settings keys

| Key | Consumers |
| --- | --- |
| `ad_playback` | Live timings + bounds + `impression_cap_min` + `console_campaigns_limit` |
| `ad_runtime_chrome` | Admin `/ads` + publisher campaigns/dashboard/analytics chrome + viewport device-creative copy + `viewport_breakpoint_*` (also on `GET /ads/playback` `schedule_chrome`) + `runtime_permission_key` / `campaigns_permission_key` |
| `admin_console_chrome.media_pool` | Admin `/media-pool` labels, quota hint (~10 uploads/day/channel), `sort_order` failover copy, upload errors |
| `client_enums` | Includes `creative_types`, `default_creative_type`, `video_creative_type` (served on `GET /platform/enums`) |
| `ad_player_chrome` | Overlay copy + `placement_lobby` / `placement_in_match` |
| `rbac_chrome` | Admin `/rbac` labels + toasts + `manage_permission_key` + `protected_permission_keys` + lockout error strings |

### Viewport device creatives (desktop / tablet / mobile)

Campaigns store per-slot image URLs and YouTube video IDs (`creative_*_url`, `video_id_*`). Player-facing aspect targets come from `ad_runtime_chrome` ratio labels (`viewport_desktop_ratio_label`, `viewport_tablet_ratio_label`, `viewport_mobile_ratio_label`; seed defaults are typically 16:9 / 4:3 / 9:16). Upload validation and web/Flutter display parse those labels and **fail closed** when a label is missing or invalid. Publishers may fill all three slots or only some. Serve is **exact slot only**: desktop creative on desktop, tablet on tablet, mobile on mobile. Empty matching slots do **not** borrow another device slot. Lobby and in-match UIs skip campaigns with no creative for the current screen (no title-only ad, no impression). Legacy `creative_url` / `video_id` is used only when **no** viewport slot is filled (older campaigns). Frame aspect uses the requested slot ratio label. `stub_*` video IDs are stripped on serve.

Width breakpoints (`viewport_breakpoint_mobile_max`, `viewport_breakpoint_tablet_max` in `ad_runtime_chrome`, echoed on public `schedule_chrome`) must be valid integers with `mobile_max >= 1` and `tablet_max > mobile_max`. Web and Flutter players call `parseViewportBreakpoints`; **null fails closed** (no lobby slot, no in-match overlay media, no client defaults).

### Publisher media routes (auth)

Web portal campaign detail (`/ads/campaigns`) and Flutter Publisher campaigns use `ad_runtime_chrome` viewport keys before showing the device-creatives editor (`viewportCreativesChromeReady` / `viewport_creatives_*` non-empty).

| Action | API |
| --- | --- |
| Upload slot image (`desktop` / `tablet` / `mobile`) | `POST /api/v1/ads/campaigns/{id}/creatives/{slot}` |
| Clear slot image | `DELETE /api/v1/ads/campaigns/{id}/creatives/{slot}` |
| Queue slot video (YouTube worker) | `POST /api/v1/ads/campaigns/{id}/creatives/{slot}/video` |
| Clear slot video | `DELETE /api/v1/ads/campaigns/{id}/creatives/{slot}/video` |
| Legacy single video upload | `POST /api/v1/ads/campaigns/{id}/upload-job` |
| Clear legacy `video_id` | `DELETE /api/v1/ads/campaigns/{id}/video` |
| Public creative files | `GET /api/v1/media/*` |

Auto-closed campaigns (`auto_closed=true` after `ends_at`) reject **all** publisher and console media mutations: viewport slot image/video, legacy video upload/clear, thumbnail, gallery add/remove, and legacy creative replace. HTTP handlers return `err_campaign_auto_closed` (409). The YouTube worker skips attach when the campaign is auto-closed or ownership does not match.

### Console campaign media routes (`ads.manage_campaigns`)

Same semantics as publisher routes; admin acts on any campaign by id (no publisher ownership check).

| Action | API |
| --- | --- |
| Upload slot image (`desktop` / `tablet` / `mobile`) | `POST /api/v1/console/ads/campaigns/{id}/creatives/{slot}` |
| Clear slot image | `DELETE /api/v1/console/ads/campaigns/{id}/creatives/{slot}` |
| Queue slot video (YouTube worker) | `POST /api/v1/console/ads/campaigns/{id}/creatives/{slot}/video` |
| Clear slot video | `DELETE /api/v1/console/ads/campaigns/{id}/creatives/{slot}/video` |
| Campaign thumbnail | `POST /api/v1/console/ads/campaigns/{id}/thumbnail` |
| Clear thumbnail | `DELETE /api/v1/console/ads/campaigns/{id}/thumbnail` |
| Append gallery image | `POST /api/v1/console/ads/campaigns/{id}/gallery` |
| Remove gallery slot (0-based index) | `DELETE /api/v1/console/ads/campaigns/{id}/gallery/{index}` |
| Clear legacy `video_id` | `DELETE /api/v1/console/ads/campaigns/{id}/video` |

### Console media pool (`/media-pool`)

Requires console role **and** `media_pool.write`. Nav href `/media-pool` (Product and growth). Copy in `admin_console_chrome.media_pool`.

| CRUD | Admin UI | API |
| --- | --- | --- |
| **R** channels | Channels tab (OpsDataTable) | `GET /api/v1/media/pool/channels` |
| **C** register | Register form | `POST /api/v1/media/pool/channels` |
| **U** creds / quota / **sort_order** / active | Edit channel | `PUT /api/v1/media/pool/channels/{id}`; `PATCH .../channels/{id}` for active toggle |
| **D** channel | Confirm delete (existing campaign video IDs unchanged) | `DELETE /api/v1/media/pool/channels/{id}` |
| Test OAuth | Test action | `POST /api/v1/media/pool/channels/{id}/test` |
| Ops test upload | Test upload tab | `POST /api/v1/media/pool/upload` or `/upload-file` (console or publisher media-upload role) |

**Failover:** uploads iterate channels ordered by `sort_order ASC`, then `created_at ASC`. Each channel has `daily_quota_limit` (seed hint **10** videos/day practical cap). On quota or auth failure the pool tries the next healthy active channel. Publisher viewport/legacy video jobs use the same pool via the YouTube worker.

## Smoke

API with `DAMA_ALLOW_E2E_AUTH=1`:

```powershell
powershell -File scripts/e2e-rbac-ads.ps1
```

Proves: start normalized to non-skippable **10**; DB permission keys on me/permissions; admin without manage forbidden on `/console/rbac`; publisher form/dashboard/analytics chrome; creative enums; RBAC catalog C/U/D; refuse in-use role delete; refuse delete/orphan of protected permissions; grants CRUD; in-match impression requires schedule; first-show + interval gates; non-skippable **10 → 15 → 12 → 10**; DB placements; daily/weekly/monthly/yearly `period_cap_reached`; `ads_chrome` on me/permissions.
