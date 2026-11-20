# dama PRD / SAD compliance matrix



Product name: **dama** only.



**Status:** Hybrid GraphQL + REST + raw Go WebSockets is implemented. Currency and domestic country routing are DB-driven (`currency` + `geo_payment`; global USD, Ethiopia ETB). Tournament `is_free` is paid-default with explicit free override; paid rows cannot use fee<=0 as silent free. Casual board `StartGame` / matchmaking seats are non-monetary practice (paid entry is tournament enroll). Play, matchmaking, tournament, admin console, profile inspect, wallet (incl. manual receipt + payment route labels + paren wrappers), avatar, spectate, leaderboard (W/L/D abbrs), player tournaments, OTP gate, client_nav brand/dashboard/marketing/site meta, theme toggle, console brand/meta, mobile live status templates, admin users/media/tournament display, ads invoice filename/playback unavailable, avatar crop errors, list-surface `meta_separator`, stats separators, draw/enroll suffixes, client_enums.unavailable, board-size separators, and label/amount/glyph joiners hydrate from DB chrome (migrations 037-054). **App shell packaging (mig 461–463):** `platform_settings.app_shell_chrome` + `GET /public/app-shell-chrome` drives dark/light brand marks in shells, splash (Flutter/Android/iOS), first-run onboarding, branded 404s, favicons/OG/Twitter, DB-driven `manifest.ts`, and robots/viewport from chrome (global international copy only; no Ethiopia marketing). Flutter and web surfaces for those chrome keys are fail-closed. Literal production **100%** still requires OPS_EXTERNAL (live gateway webhooks on a public URL, YouTube OAuth refresh tokens, OTP carrier, edge WAF, mTLS, Cloudinary Rekognition add-on).



Print-ready companion: [`docs/dama_prd_sad.html`](./dama_prd_sad.html).



## Separation and currency



| Fact | Result |

|---|---|

| Nested console inside `@dama/web` | Absent |

| Packages | web ? admin ? mobile ? api |

| Client data hooks | web/admin: every query/mutation in `hooks/query` + `hooks/mutation` (pages do not call GraphQL/REST directly) |

| GraphQL contract | `src/graphql/*.graphql` ? codegen TypedDocumentNodes in `src/gql/`; hooks use `*Document` (no inline operation strings) |

| Domain types | web `src/types/`, admin `src/types/`, Flutter `lib/core/types/`; GraphQL aliases derive from codegen selections; REST/WSS hand-typed |

| Cache / stale / invalidate | TanStack QueryClient tiers + default `keepPreviousData` (`useGameStateQuery` = **session** stale + cache `initialData`, `placeholderData: undefined`; `usePublicPlayerQuery` / `useLeaderboardQuery` set `placeholderData: () => undefined`; HoF page also gates `data.period === period`) + mutation/`WS` via `invalidate.ts`; leave-pause/`pause`/`resume` `setQueryData` on `game-state`; login removes account keys; sign-out clears client; Flutter `QueryCache` (incl. `gameState` / play+spectate chrome) + Cubits (`WalletCubit`, `TournamentsCubit`, `LeaderboardCubit`) + `allowStale` remount paint; web board hubs keep-alive (hide not unmount) + Flutter `IndexedStack` shell tabs; page + query `useAuthHydrated` gates; auth CTAs use Next `Link` (soft nav) |

| Loading UX | Home=Chess.com Play: **3D board** (or Tournaments center) \| AI\|Match\|Tournaments rail. Free guest VS-AI via `POST /auth/guest`. Match soft-gate. Dashboard=ops only. **Portal page shimmer layout parity** (player Overview/Profile/Wallet/Tx/Receipts/Settings; ads Dashboard/Campaigns/Analytics/Wallet/Receipts/Tx; events Dashboard/Hosting / My hosted tournaments / Join/Analytics/Wallet/Receipts/Tx): skeletons mirror live headers, KPI grids (`gap-4` / dense ads analytics `sm:3 lg:6`), `Field` label+control toolbars, entry filter `h-9` pills, SkipPagination-shaped table footers (`border-t p-3`), embedded `OpsDataTableSkeleton` inside cards (no double border), portal money `showBlurb=false`, receipts chrome without manual form until route known, ads/events `PortalDashboardSkeleton` portal variants, Settings waits `providersQuery` (Document `space-y-3 p-4`; Cash soft/skeleton `space-y-4 p-5`; Account `space-y-6 p-5`; no panel shadow except session), header blurb gaps `mt-1`/`mt-2` matching live shells, KpiCard label `h-4`, searchable lists `sm:max-w-md`, create CTA `w-40`, Join CTA `w-24`, wallet balance `mt-1 h-8` + payout action `w-40`, wallet methods Add CTA `h-9`, Join = full-width Field + CTA + Community tournaments link panel (no second public browse grid / no speculative cup card), Campaigns toolbar `sm:justify-between` + status `sm:min-w-[12rem]` (My hosted tournaments unconstrained search/status), events portal money pills `h-9`, embedded Document KYC soft-load skips card chrome, Analytics tables `showPagination={false}` (live has no `onPage`), ads dashboard campaigns soft heading `h-5 w-40` + `ListRowsSkeleton showPagination`, Profile matches = bordered `li` rows + pager, shared `SkipPaginationSkeleton`, `RequireAuth` uses `portalRouteSkeleton(pathname)` (no generic flash), ads KPI `showBody` source-note line, ops table cell density `px-2/p-2` - via `PlayerDashboardSkeleton` / `ProfilePageSkeleton` / `SettingsPageSkeleton` / `WalletPanelSkeleton` / `SearchableListPageSkeleton` / `ReceiptsPageSkeleton` / `PortalDashboardSkeleton` / `CampaignListSkeleton` / `EventsListSkeleton` / `EventsJoinSkeleton` / `AnalyticsPageSkeleton` in `apps/web/src/components/ui/shimmer-skeletons.tsx` (Ad publisher / Hosting are portal nav links, not separate player pages). Audits: `home-play-parity-audit.mjs`, `shimmer-token-parity-audit.mjs`, `portal-shimmer-layout-audit.mjs`, `e2e-ux-parity.ps1`. Remaining: Playwright visual; OPS_EXTERNAL |

| Theme | System default + cycle toggle (system/light/dark) on web, admin, Flutter (Google sign-in + OTP + app bars); CSS/`DamaColors` tokens (surfaces, overlay, board squares/pieces, onGold, danger, toasts) |

| Auth | Google social only (Supabase OAuth PKCE ? `POST /auth/oauth/supabase` ? dama JWT). No email/password. Auth chrome DB-only via `auth_providers` (SignInLink/sign-out labels). Edge middleware + parallel PKCE. `GET /public/email-policy` + `email_domain_denylist` for new OAuth users. E2E mint: `DAMA_ALLOW_E2E_AUTH=1` + `POST /auth/e2e/session` |

| Payouts | `user_payout_methods.phone` required before `POST /payouts/request`; government-ID document KYC required when `require_document_kyc_for_payout` (migrations `067`–`072` + `293`: ID front/back + selfie + legal name + document type only; photos prove the ID; printed number/dates/country fields removed); wallet debit + pending request; wallet UI chrome DB-only via `wallet_chrome` / `GET /public/wallet-chrome` (fail closed). Console review: `GET/POST /payouts/console` (+ `{id}/review`) with DB `cash_rmg_policy` statuses; reject refunds wallet debit |

| Cash / RMG compliance | Migrations `062`–`072` + `293` + `300` + `cash_rmg_policy` / `cash_rmg_chrome` + flags `cash_rmg_enabled` (payload `disabled_countries`) + `cash_phone_kyc_required` + optional `cash_phone_otp_required` (admin Feature Flags “Cash phone OTP”; default OFF; mig `300`+`301`). `EvaluateCash` fail-closed on paid enroll, checkout, manual receipt, payout. Age gate `PUT /me/age-gate` (min age from policy). Jurisdiction allowlist. Fresh `geo_ip_records` locate. Phone KYC: when OTP flag ON → save phone then phone-channel OTP start/verify; when OFF → `PUT /me/phone-kyc` marks verified immediately and OTP start/verify reject (web + Flutter + admin catalog; server-authoritative `status=verified`). Phase C document KYC (`kyc_document_submissions`: ID front/back + selfie + legal name + document type; `/kyc/documents/*` + admin Payments image review/history; MediaDropzone chrome; trusted KYC media URLs only). Cash/wallet/locate/enroll/payout API errors from `wallet_chrome` / `payment_modal_chrome` (no invent). Legal sections for cash 18+ (COPPA under-13 retained). Native packaging notes: `apps/mobile/STORE_PACKAGING.md` |

| Console nav | `platform_settings.console_nav` via `GET /platform/console-nav` (header + dashboard; no client route arrays) |

| Client nav | `platform_settings.client_nav` via `GET /platform/client-nav` (player/ads/marketing/mobile/dashboard; Flutter `route_key`) |

| Client enums | `platform_settings.client_enums` via `GET /platform/enums` (roles, console/publisher roles, statuses, Ethiopia payment modes) |

| Feature flag catalog | `platform_settings.feature_flag_catalog` via `GET /platform/feature-flag-catalog` (toggle keys/labels/kinds) |

| Compose | postgres 16, redis 7, pgbouncer, backend-api, nextjs-web, nextjs-console, optional pgadmin |

| Currency | `platform_settings.currency` (global USD, Ethiopia ETB) + `geo_payment` domestic ISO/city (admin `GET/PUT /console/geo-payment`, mig **285**). Pay routes resolve country server-side (localhost invent via DB city; ETB in domestic, USD elsewhere). No client country invent on pay/ads/events. Fail closed when settings incomplete |



## Protocol matrix



| Feature | Protocol | Status |

|---|---|---|

| Profiles, leaderboard, publisher dashboard, console tournaments | GraphQL | Pass |

| Player tournaments list, ads CRUD, wallet, many admin forms | REST | Pass (GraphQL not volume-primary for these) |

| Board moves / matchmaking / invites / spectate / flags | Raw Go WSS | Pass |

| Webhooks, uploads, invoices, enroll (+ OTP gate), currency | REST | Pass |

| In-app notifications (bell, list, scroll load-more, mark read) | REST + Postgres | Pass (Trim-parity; mig 116-120; web + Flutter + admin; see architecture Shell notifications) |



## Security (in-repo)



Redis leaky-bucket, Redis auth (requirepass / URL password; TLS when `rediss://`), JWT + revocation, GraphQL depth/complexity, RLS, AES-256-GCM vault, Chapa + Paddle HMAC, OTP gate on enroll/checkout/matchmaking/invites (REST+WSS create/accept/decline): Pass. Edge WAF / live mTLS: OPS_EXTERNAL.



## Feature completeness



| Area | Status |

|---|---|

| FMJD board rules + VS-AI allow-listed depths (no AI remap invent) | Pass |

| Ad geo Redis country/region/district SET (pin lat/lng for create pricing only; no radius fence) | Pass |

| Player ad serve + impression/click; video-complete only on real media ended (not on impression) | Pass |

| Tournament enroll: Exists check before debit; CreditWallet refund if Register fails (hard fail if refund fails) | Pass |

| Receipt review: pending-only atomic UPDATE (no double-credit on re-approve) | Pass |

| Webhook MarkPaidByTxRef: FOR UPDATE + RowsAffected + credit in same DB tx | Pass |

| Local webhook: only explicit success/successful status credits (empty status ignored) | Pass |

| Games start/move REST + WSS ApplyMoveCore OTP gate when flag enabled | Pass |

| OTP gate reset on token change (web SessionSecurity + Flutter OtpGate) | Pass |

| Mobile player Google sign-in: console roles from `GET /platform/enums` (fail closed) | Pass |

| Google social sign-in only (web + admin + mobile; Supabase OAuth PKCE + dama JWT; no password) | Pass |

| Email-policy (`email_domain_denylist` seed + public check + Trim-style all-identity allow + OAuth exchange gate) | Pass |

| Primary phone on payout method required before payout request (web + mobile wallet) | Pass |

| Cash RMG: 18+ age gate blocks enroll/checkout/receipt/payout until `age_verified_at` | Pass (`062` + live E2E) |

| Cash RMG: jurisdiction allowlist (`allowed_country_codes`) blocks non-allowlisted countries; admin CRUD via `/console/cash-rmg/allowed-countries` (Feature Flags) | Pass |

| Cash RMG: locate gate (`geo_ip_records` freshness) fail-closed when unknown/stale; persist geoip / gps / DB `dev_default` (Bearer on web/Flutter; no client country hint on locate) | Pass |

| Cash RMG: kill switch `cash_rmg_enabled` + per-country `disabled_countries` (server + web/Flutter enroll + wallet top-up/payout UI) | Pass |

| Cash RMG: phone KYC required when `cash_phone_kyc_required`; phone OTP challenge gated by optional `cash_phone_otp_required` (mig `300`+`301`; admin toggle; default OFF; ON → OTP after save; OFF → save phone verifies; OTP endpoints reject; web/Flutter/admin) | Pass |

| Cash RMG: admin payout approve/reject/mark-paid (policy statuses; reject credits wallet) | Pass |

| Cash RMG: Phase C document KYC required for payout (gov ID front/back + selfie + legal name + document type; upload magic-byte + KYC-only media URLs; reject→resubmit; admin image review + status history; web + Flutter proactive payout gate; MediaDropzone; mig `293` dropped printed ID metadata columns) | Pass (`067`–`072` + `293` + live E2E) |

| Host trust / scammer protection (mig **522** to **532**): paid create needs phone + open-cup limits (new 1 / phone 3 / ID 25) + reputation; guaranteed prize needs government ID + wallet lock at create (unlock on cancel, commit at start, settle after dispute); admin Sales → Host trust policy edits gates/caps/reputation (`PUT /console/cash-rmg/host-trust-policy`, OpsDataTable tabs); `kyc_auto_approve` default ON (Events + Feature Flags; OFF = Payments → KYC); DB badges Unverified host / Phone verified / Verified host on cups / hoster / profiles / dashboards / leaderboard / inspect / Watch / admin; web + Flutter + admin; GraphQL `kycAutoApprove` + host trust fields; human bible `docs/guides/Dama_Host_Trust_And_Scammer_Protection_Guide.md` + architecture/guides/READMEs aligned | Pass |

| Cash RMG: legal 18+ cash sections + under-13 COPPA retained | Pass |

| Cash RMG: native android/ios scaffolds + store packaging notes | Pass (ops questionnaires at submit) |

| Wallet/payout chrome DB-only (`wallet_chrome` + `GET /public/wallet-chrome`; web + mobile fail closed) | Pass |

| Play chrome DB-only (`play_chrome` + `GET /public/play-chrome`; web + mobile lobby fail closed) | Pass |

| Matchmaking chrome DB-only (`matchmaking_chrome` + `GET /public/matchmaking-chrome`; web + mobile fail closed) | Pass |

| Play rail C/D (mig 098-109): Create Game/matchmaking TC/rated/color swatches; invite create requires rated+color+preset TC; per-game `time_control_seconds` drives live clock; unrated skips Elo/XP; invite accept SETNX claim (keep on save-fail; Decline/Cancel honor claim) + `CreateDirectMatch` no `match_found` + inviter-only `invite_accepted`; WSS+REST invite accept/decline OTP via `EnsureOTPVerified`/`otpGate`; hover W/L+history mode from `play_rail_chrome` (mig 107-108); accept/decline/cancel dialogs wait ack/error (web+Flutter); Flutter Create Game outgoing wait/cancel; per-game TC not clobbered by progression load; challenge link+TTL+OTP-safe (`done` durable web+Flutter); Watch/History DB mode; Online/Playing seats/rail/leaderboard; hover+modal Challenge+Watch; live share?spectate; `web_app_origin` optional for rail; flip; web last-move fail-closed; `id_truncate_chars` game-id (mig 109); Flutter invite dialogs chrome-gated; TC shimmer; send icons; web + Flutter | Pass |
| Server-authoritative pause/resume (mig **471–474**, **496–507**): player `POST /games/{id}/pause|/resume` + official `POST /games/{id}/official-pause|/official-resume|/official-pause-meta` + audit `match_official_pause_events` + RBAC `games.official_pause`; `pause_kind` player vs official; clock freeze + move/flag/resign block while official (`AbandonGameCore` → `err_officially_paused`; Stop hidden on web+Flutter); official has no auto-resume; audit-fail compensates Redis pause fields; MatchIntro-style blur board cover on web+Flutter play and spectate (official: blurb banner/who/reason/note/since/until-resume; player: game_paused_blurb banner/who/countdown (no wall-clock since); spectate rail banner/blurb fallback); dismissible resume banner; play+spectate+finished-match activity strip (pause/resume/meta); in-app notify; organizer live filter/activity/since/duration/frozen + meta + KPI; admin control room officially-paused filter + pause/resume/meta; post-finish history for seats+operators (match_history authz); dedicated official-pause rate limit (`official_pause_chrome.rate_limit_per_minute`, mig **506**); WS actor envelope on pause/resume/meta; leave/FAB official rules; bulk round pause (`POST /games/official-pause/bulk`); admin live boards table (`GET /console/official-pause/live` + filter/KPI/copy id/pagination); seat in-app notify (device push not in repo; no FCM/APNs stack) | Pass |

| Authoritative dual match clock + flag-fall (mig **427–431**, **438–440**): shared `ArmMatchClockFromDB` on StartGame + queue/invite/`CreateDirectMatch` + tournament/hosted/arena; `GetGameState` sync+persist + auto-flag; rotating 2s sweeper over `dama:games:clock_active` (PvP+AI); `end_reason=clock_flag` (decisive win + points); bare K vs K → `clock_draw` + `draw_reason=insufficient_material` (E2E asserts); finalize single-flight (mutex+Redis SETNX + `Record` created + arena/bracket CAS); seated DB `you_*_on_time_message` (438) incl. web `statusText`/seat hints during land-animation grace (turn hints off while clock-owned; never generic White/Red wins) + merge preserves `end_reason` + wipe skips clock-owned + spectate `status_*_on_time` fail-closed if outcome delayed (439) + notif `notif_result_*_on_time` (440); already-zero debit; **seat-before-debit** on moves; web merge + Flutter match clear on `clock_active:false`; WS move+clock_flag joined `game_id` match; `initial_seconds` ∈ presets; WS+REST claim + lab expire/peek/bare-kings; admin presets + default TC select; E2E includes **clock_draw** + on-time chrome keys | Pass |

| Play rail UX (mig 129-138, **142**): `search_debounce_ms` + chrome name truncate (`...` only, mig 142); **server `q` on players/friends/requests/DMs/live/spectators/history** (relevance on `/players`; no client-only page filter on infinite lists; Watch/History search UI); **debounce typeahead drains all `/players?q=` pages** (web infinite + Flutter page loop; Friends/Requests/DMs rank full unpaged membership incl. Flutter `_dmMembership`; viewers auto-drain server-`q` roster pages while search active; no pageSize slice); board match seats restored above/below board column (not page-header portal); QR center mark ~18% edge cache `v23`; DM image upload uses multipart fetch + absolute local media URLs (not axios JSON); play-rail infinite scroll via `list_page_size`/`loading_more` (mig 153) including friends/requests/DMs/viewers/messages; `friend_requests` pending?accept/deny/cancel dual-side lists + toasts (130-131); live viewers Games-tab roster by game id + shimmer (132); CTA/vote/export/stop `pendingLabel` (133); friend_request* notif unread/mark-read + `/?rail=players&sub=requests` deeplink (incl. during AI) (134); `download_qr_pending` + `already_friends` API code (135); left seats avatar?timer + 2D/3D center; rail `minmax(380px,440px)`; home shell `h-dvh` + single rail scroll (not page); Flutter `ChromeSelectField` sheets + voteCastingPending; `PlayHubSkeleton` overflow/fill parity; web+Flutter+admin debounce where lists filter; mig 137 View profile + request tab count pill (NotificationBell parity) + rounded-square QR logo (cache rev `v21`, transparent burgundy `dama-mark.png` on white plate ~46% edge; pair `dama-mark-white.png`) + algebraic move log + `/players/{id}`; mig 138 profile history cols + friends grid + joined + enriched match `player1`/`player2` + `move_count`; mig 139 `no_friends` + `empty_value` | Pass |

| Game chat + DMs (mig **143-162**, **169**): per-game chat text/emoji/image-only Cloudinary `dama/chat` + same-game `reply_to_id` + chrome reply preview (mig **149**); newest-100 message pages; GET chat requires auth+join (seat/WS); `can_post` in payload; seated enable/disable (default on; history when off); REST + WS `game_chat_*` / `dm_*` incl. `*_reaction` + `*_read` (web+Flutter live invalidate; chrome poll backup mig **150**); join/load/DM-open error chrome (mig **151**); DM load-failed chrome (mig **152**). Telegram-style reactions (mig **158**); DM ✓/✓✓ read receipts (sent single ✓ until peer watermark → read ✓✓ brand; no premature delivered double-check) + game ✓✓ seen counts (mig **159**); delivered chrome retained fail-closed (mig **170** `chat_receipt_delivered_*`); DB emoji catalog `platform_settings.chat_emoji_catalog` + `GET /public/chat-emoji-catalog` fail-closed (mig **160**, ~1.4k glyphs, search/categories/quick_reactions; no client hardcoded catalog); receipt/seen glyphs from chrome (mig **161**). **Outbox / idempotency (mig **169**):** `client_id` columns + unique indexes; POST returns same row on retry (accepted-thread + compose-new request seed); DM create `receipt=sent`; durable ordered client outbox (web localStorage + Flutter SharedPreferences); serial drain; optimistic paint; tap-to-retry; pending/failed/retry chrome fail-closed (`chat_receipt_pending_*` / `chat_receipt_failed_*` / `chat_receipt_retry_action`); compose clears+closes immediately, durable `toUserId` outbox + pending bubble shell (fail?tap-retry, resume when players rail active; secondary Message CTAs route to DMs on compose-start), then opens resolved thread; e2e asserts newer outbound stays `receipt=sent` until peer mark-read → `receipt=read` + game-chat `client_id` idempotency. Shared ChatThreadUI: mine-left/peer-right, sticky disable+composer, patterned wallpaper, media lightbox (chrome title/close aria mig **162**). Friend-challenge + tournament matches reuse per-game chat (?? counts; no separate tournament chat room). DMs same-thread reply + `CountPendingIncoming`; Players **DMs** tab; Message under `?` (hover incl. friend-request, profile modal, `/players/[id]`, StackPlayerHover) + live-games seat faces Message via PlayerHoverCard (LiveGameWatchPopover is QR/join only) + Flutter DM-row/seat ? inspect + vote Message via `followComposeMessageResult`; compose Words; private thread post-accept; pending Accept/Deny/Cancel in-thread (web+Flutter) + `GET /dms/requests/{id}` / thread membership probe deep-link + one-shot open-fail toast; match-start VS intro only when `move_count===0` present (web typeof number; Flutter `hasMoveCount`) + seat bios + rail chrome; `player.dm_*` deep-links await mark-read then navigate; observing strip names/ratings/flags + DB preset `timeLabel` (web+Flutter); API E2E seated post/reply/react/read/disable/enable + PNG upload + video reject + mig 149-162 chrome/catalog/lightbox keys + mig **169** pending/failed/retry chrome + idempotent `client_id` double POST; unit tests `chat-outbox.test.ts` (incl. compose `toUserId` durable + duplicate-merge) + `chat-dm-merge.test.ts` (DM + game-chat refetch race preserve pending / drop acked) + `test/chat_outbox_test.dart` (incl. compose scope); compose-from-open-thread fail keeps shell for tap-retry; Flutter `followComposeMessageResult` unifies play-rail/inspect/vote compose follow-through + next-draft drain | Pass |

| Admin tournament chrome DB-only (`tournament_chrome` + `GET /public/tournament-chrome`; Make free / fee labels fail closed) | Pass |

| Admin console chrome DB-only (`admin_console_chrome` + `GET /public/admin-console-chrome`; banks/payments/media/flags/avatars/telemetry/users/dashboard/**activity**/progression form body + mutation toasts) | Pass |

| Activity analytics (mig **171-180**): admin `/activity` + public Status Trim dashboard parity (stacked Usage + heatmap/streaks + cumulative games + mode/outcome/entry breakdowns); Status `/?view=status` (mig **177**); play hub restored; Flutter `PlatformStatsPage`; E2E `e2e-activity-analytics-check.mjs` | Pass |

| Public player inspect modal chrome DB-only (`profile_inspect_chrome` + `GET /public/profile-inspect-chrome`; web modal + seat inspect labels + `label_draws`) | Pass |

| Avatar / profile upload chrome DB-only (`avatar_chrome` + `GET /public/avatar-chrome`; Flutter + web profile) | Pass |

| Spectate chrome DB-only (`spectate_chrome` + `GET /public/spectate-chrome`; Flutter + web) | Pass |

| Leaderboard chrome DB-only (`leaderboard_chrome` + `GET /public/leaderboard-chrome`; Flutter + web) | Pass |

| Hall of Fame periods (mig 123-125 + 128): week/month/year wins from `match_history` + all-time rating; podium (DB crowns web+Flutter) + two-column gold ranks from #4 + Your Rank always (empty ok; Bearer `me` rank 0 = unranked) + View Full; period score from API `points` only; **`default_period` + `list_page_size` DB chrome only** (no invent week/20); web+Flutter cache keys auth-scoped; web `placeholderData: () => undefined` + skeleton until `data.period === period`; Flutter clears rows/me on period switch + rejects period echo mismatch (no prior-period pts under new tab); `LeaderboardPageSkeleton` | Pass |

| Spectator win votes (mig 122 + 124 + 126): live tallies/% public to all viewers; cast gated to signed-in; seated players rejected (`vote_players_cannot` chrome hides cast); WS `vote_update` public tallies only; auth-scoped vote cache; `useMatchVotesQuery`/`useCorrectVotersQuery` `placeholderData: () => undefined` (no cross-gameId bleed); random top-10 correct; DB-only VoteStore; seat bios fail-closed (no invent 0 W/L/D) | Pass |

| Live games redesign + QR (mig 121 + 124 + 127): ~half-overlap seats/viewers + bio outside Watch; order players ? viewers ? game id; move count only when API sends it (no invent 0); empty seat/initial marks fail-closed (no invent `?`); Watch Join + download High-ECC QR (`dama-mark`) via DB `qr_download_filename_prefix` + `Content-Disposition` (CORS `ExposedHeaders`) + lightbox; `LiveGameWatchSkeleton` while QR warms; `qr_unavailable` on fail; QR warmed at create; known-game only | Pass |

| Match vote cast UI: hide for seated players (`vote_players_cannot` mig 126); vote seat labels from public-player API only (skeleton until hydrate; no White/Black invent); `MatchVoteSkeleton.showCastButtons` mirrors cast visibility (incl. seat-hydrate); spectate vote panel gated on connected + disconnect clears game; Flutter Watch shimmer stacked Join/Download | Pass |

| Player tournaments chrome DB-only (`tournaments_player_chrome` + `GET /public/tournaments-player-chrome`; Flutter + web enroll toasts) | Pass |

| Free cup Join (not Enroll): silent enroll → cup lobby (`/?view=tournaments&id=`); paid opens payment modal then same lobby; 409/`already_enrolled` uses `payment_modal_chrome.already_enrolled` never raw JSON (mig **294**+**350**; web `tournamentLobbyHref` / `freeJoinPlayHref` alias, Flutter cup lobby sheet) | Pass |

| Tournament + event lists: real skip/limit meta + server filters `is_free` / `is_free_entry` / `q` (+ organizer/admin `status`); home/player/public/admin/organizer/Flutter (mig **294**-**295**) | Pass |

| OTP gate chrome DB-only (`otp_chrome` + `GET /public/otp-chrome`; Flutter OtpGate + web SessionSecurity) | Pass |

| Client nav brand + dashboard page chrome DB-only (`client_nav` + `GET /platform/client-nav`; migration 046) | Pass |

| Player portal ops rail + Overview chrome + Receipts/Transactions/Settings in `client_nav` player+dashboard; casual OAuth `login_default_next=/` (mig 110-113) | Pass |

| Portal pages wide Trim shell (`max-w-[1400px]`); overview KPI metrics (no public Play menus on portal) | Pass |

| Theme toggle chrome DB-only (`theme_chrome` + `GET /public/theme-chrome`; web + admin + Flutter) | Pass |

| Console nav `brand_title` DB-only (`console_nav` + `GET /platform/console-nav`; migration 047) | Pass |

| Sales **Financial overview** + Live boards ops (mig **509**–**521**: `/payments/overview` + `GET /console/financial-overview?days=7\|30\|90`; queues + volume + net profit + platform revenue + net cashflow + Sales links; period-neutral volume labels; DB chrome period tabs; fail-closed SQL; no em dash; admin players roster `GET /console/events\|tournaments/{id}/entries?skip&limit` + `meta` + status/check-in/placement + Open user (mig **516** tournament status col); organizer manage Open player → `/players/{id}` web + Flutter inspect; organizer Manage Players/Payments share one paged `GET /events/{id}/entries?skip&limit` + `meta` + full-roster `entry_fees_*` totals (Results stays unpaged); Manage Live boards `GET /events/{id}/live-boards?skip&limit&official_only` + `officially_paused_count` (All live / Officially + empty chrome); page size from DB `events_organizer_chrome.list_page_size` / console chrome only; Live boards required top tab (page-tab panel) + All live / Officially inner tabs + ASCII KPI sep; mig **518**–**521** OpsDataTable row-actions + checkbox selection bulk pause/resume (`game_ids` + `/official-resume/bulk`) + ASCII chrome heal; menu trigger fail-closed on `actions_menu_label` only (no `col_actions` invent); **518** selection/menu/resume-toast keys required for official-pause chrome-ready on admin/web/Flutter and API `OfficialPauseChrome`; mig **520** heals string-shaped `reasons` to JSON array; mig **521** `live_boards_empty` empty Live boards copy on admin OpsDataTable + host live tabs; empty-cup start E2E asserts checked-in `not_enough_players` (toast prefers server DB body); MatchPauseOverlay blur/VS/who/since/countdown official+PvP; E2E `e2e-admin-finance-players-start-check.mjs` + chrome smoke; Manage skip/go E2E `e2e-manage-skip-go-check.mjs` for paged entries+fees+live-boards+console live meta) | Pass |

| Wallet payment-route labels + payout required marker DB-only (expanded `wallet_chrome` 047) | Pass |

| Leaderboard W/L/D / rank / XP suffixes DB-only (expanded `leaderboard_chrome` 047) | Pass |

| Wallet manual receipt / bank labels DB-only (expanded `wallet_chrome`) | Pass |

| Shared Telegram ops bot for manual receipt + payout review (mig **415**–**425** `telegram_ops_bot` + `payment_receipts.review_note`; mig **423** injects `pay-telegram-ops` into the live payment `console_nav` section by existing pay-* items - not only `sections.id=payments`; mig **424** fail-closed empty/failed Telegram admin DMs (`err_no_telegram_admins`); reject reason required (mig **422**); DB notify types + `dama_notify_kind`; bot chrome incl. review-fail/reject lang + chrome freshness 418–424; call_dama_backend surfaces API `error` chrome (review-fail/transition/refund) not only err_fetch_failed; mig **425** full refund-failure chrome (legacy key `err_refund_failed_prefix`); mig **421** DB hub/detail/notify/action templates - no emoji hardcodes in `dama_ops`; reject keyboard fail-closed; SetTelegramOpsBot reloads before merge + preserve-on-empty URL/key/reviewer + reviewer UUID must exist in users; HardDelete/Reload heal dead reviewer so Ready cannot lie; bot+notify reload settings; `TelegramOpsBotReady` requires `notify_timeout_ms > 0` (notify fails closed without it); Dama notify requires X-Bot-Key; `call_dama_backend`/`dama_configured` fail closed without `DAMA_API_BASE_URL`+`DAMA_BOT_API_KEY` (always send X-Bot-Key); no err.Error()/exception English to operators; writeBotErr never empty; ListPendingReceiptsPaged surfaces DB errors; AdminConsoleChrome payments REQUIRED includes telegram_ops_*; no inventing timeout/10000/0.0; payout Mark paid only on approved; atomic payout `ReviewRequest` fromStatus + `RejectPayoutAndRefund` single-TX reject+credit (no concurrent double-apply / no orphan rejected-without-refund); GetChrome fails closed when Cash not Ready (never 200 without payout status gates) + `ensure_chrome` refuses partial cache + `_chrome_fresh` requires full set; notify independent of EmitAdmins; `send_admin_menu` awaits `ensure_chrome`; admin enable Save requires form key when `!has_bot_api_key`; Reload heal surfaces UPDATE errors; root + `apps/api` README document the bridge; bot root `README.md` points at `readme/readme.md` (not GitLab stub); receipt dual-actuator uses `ErrReceiptAlreadyReviewed` → console/bot **409** + `ErrReceiptNotFound` → **404** (`loadReceipt` only `pgx.ErrNoRows`; ReviewReceipt `RowsAffected=0` → EXISTS; unexpected review → **500**); payout `ErrPayoutNotFound` → **404** + transition conflict → **409** + unexpected → **500** (`ReviewRequest`/`RejectPayoutAndRefund` `RowsAffected=0` → EXISTS so missing id is not a false 409); parallel race harness; auth-negatives live missing receipt/payout GET/approve/reject/paid 404 + invalid UUID → not-found (handlers never fake 404 via `|| nil` on unexpected DB errors); `/telegram-bot/admin/dama/...` + `X-Bot-Key`; admin `/payments/telegram-ops`; console SoT; web/Flutter unchanged (server-side notify on submit); reject reason query→`review_note` + payout reject refund; E2E `e2e-dama-telegram-ops-bot-check.mjs` + live `tmp/live-telegram-ops-notify-e2e.mjs`) | Pass |

| Payment receipt Trim-parity view / Download / Print (web+admin full-page `/…/receipts/{id}`; `?download=1` → Go first-party PDF; `?print=1` + Print → `printReceiptArticle` light-force + `[data-receipt-print]` CSS; DamaWordmark dark/light/`ink=print`; Flutter sheet hydrates `GET /payments/receipts/{id}` bill-to + Go PDF share/`autoDownload`; CORS exposes `X-Dama-Download-Filename`; mig **310**/**325**/**326**; E2E `e2e-receipt-pdf-check.ps1`) | Pass |

| Public player + game-state queries: `placeholderData: undefined` (no cross-id bleed) | Pass |

| Mobile geo ads: stable SharedPreferences viewer_key | Pass |

| Ad unique reach (viewer_key / device id, DB-backed) | Pass |

| Publisher campaign geo UI (Smart Menu BranchLocationPinField → Leaflet OSM fitBounds maxZoom 10 + district; `/geo/locate` then Nominatim enrich; English labels; no radius; no manual lat/lng; mig **287**/**288**/**289**/**303**) | Pass |

| Maps: pin pick = Leaflet OSM (Smart Menu `map.tsx` force path, fitBounds maxZoom 10) web/admin; Flutter `flutter_map` zoom 10; create requires pin + server country stamp; fee at pin via `/ads/pricing?lat=&lng=`; reverse `/geo/locate` first + Nominatim enrich; no radius_km | Pass |

| Player inspect tournament placements | Pass |

| Tournament soft lifecycle + `is_free` + `prize_pool` | Pass |

| Casual board game paid-default + console `is_free` override | Partial (tournaments only; StartGame practice seats unpaid) |

| Manual transfer: DB banks UI + receipt file upload + route gate | Pass |
| Wallet top-up E2E: `POST /payments/checkout` → `manual_transfer`/`awaiting_receipt` + `banks` opens banks/receipt UI (web `topupStep=manual_instructions` / standalone receipt, Flutter `_openReceiptSheet`); gateway channels redirect via `checkout_url` (same-tab assign / external launch); bank secrets sealed with `DAMA_SECRETS_KEY` (re-save after key rotate; no ciphertext to players); scripts `e2e-wallet-checkout-check.ps1` | Pass |
| Manual receipt modal sticky Cancel/Submit + bank copy icons + gold branding (Smart Menu parity; web `ManualBankAccounts` + pinned `DialogFooter`, admin banks `CopyableDetailRow`, Flutter sticky sheet + `Clipboard`; mig **337**/**338** chrome; API fail-closed copy/cancel keys) | Pass |

| Domestic country from `platform_settings.geo_payment` (not hardcoded ET) | Pass |

| Avatar moderation from `platform_settings.avatar_moderation` | Pass |

| User soft activate/deactivate (console PATCH + login block + JWT disable gate) | Pass |

| YouTube channel Test readiness (admin console) | Pass |

| GraphQL publisher uniqueReach / videoCompletions | Pass |

| Regional colored flags from DB `users.country_code` (GeoIP / gps / `dev_default` at OAuth + `/geo/locate` + home locate; mig 284 private-default city) + DB `country_flag_chrome.image_url_template` (mig 141; no client-invented CDN); GraphQL `me.countryCode` + REST `/auth/me`; Chess.com order username `(rating)` flag; live+spectate seats; Flutter profile/dashboard/challenge/inspect/rail sheet; admin users+avatars; invite `from_country_code`; E2E `e2e-country-flags-check.mjs` | Pass |

| Campaign lifecycle active/paused/archived + geo de-index | Pass |

| VS-AI bitboard material eval + Depth-10 Grandmaster | Pass |

| PvP career rewards from `match_rewards` DB (incl. admin `rating_floor` + `starting_rating` for new accounts); VS-AI zero XP/rating; admin Progression CRUD (mig **475–477** chrome + `PUT /console/progression` `match_rewards` / `SetMatchRewards`) | Pass |

| WS welcome feature_flags snapshot + YouTube daily quota reset | Pass |

| Publisher GraphQL `cpc` + dashboard CTR/CPC | Pass |

| Match invitations + Cloudinary avatar E2E | Pass |

| YouTube multipart upload + fail-closed preflight | Pass |

| YouTube pool soft remove (deactivate) + Test readiness | Pass |

| Web/Admin codegen + mobile schema mirror | Pass |

| Hard DELETE every console entity | Partial (soft deactivate / archive by design) |

| Cloudinary Rekognition add-on | OPS_EXTERNAL |

| Redis auth | Pass (compose requirepass; managed Redis may use TLS URL) |

| Player Tournament discovery UX (mig **376–414**, **441–443**): one player list Official\|Community\|All (All-tab free/paid/search apply to Community too; join-by-code strip stays on All embed; invite `?code=` with omitted source → Community); mig **441–443** status-honest CTAs + Open·Live·Finished (+ My cups) + profile/dashboard My tournaments (place/points/streak/prize) + settle-prizes finished gate/DB-chrome toasts; E2E `e2e-tournament-discovery-lifecycle-check.mjs`; Host CTA ("Host a tournament") opens create dialog (`?create=1` web+Flutter; guests sign in then resume create) and prefers Public when public cups enabled (lists under Community; public create toast may link Community via catalog visibility code); badges + format when labeled; legacy Events browse redirects (preserve code/id; client remap for /?view=events (next.config cannot rewrite query view); Next path redirects; `resolvePlayerNavHref` keeps code/id; Edge middleware requires OAuth `state` so invite `?code=` is not stolen); legacy `/tournaments` → `/?view=tournaments` (preserve id/source/q; nav remap keeps query); Flutter guest tournament/community invite deep links (home `launchUri` init+update); marketing footer Tournaments guest browse (not auth-gated); Flutter deep links/notifs select shell Tournaments tab (bottom-nav active); guest-safe Tournament discovery hrefs in navigateNotificationHref (incl. legacy `/events/join` → Community; signed-in Hosting Join tab unchanged); Community paid join signs in before payment sheet; discovery chrome fail-closes Official\|Community\|All + Host CTA (web+Flutter); Host Public create → Community feed E2E; web + Flutter notif href remap legacy Events browse + `/events/public` → Community (preserve code/id); `sanitizeLoginNext` remaps Events browse for OAuth return; Community empty uses `empty_community`; Flutter Play-home Official teaser shows Official badge; share path Community (copy remaps legacy Events browse URLs); organizer host/nav/create/manage/toast/error + Community lobby/search chrome Tournament wording; wallet hosted-cup ledger kinds + host brand Hosting (mig **387** commission/refund/clawback); portal ops Hosting card (mig **388**, not Host events); host QR filename `dama-tournament-` (mig **389**; player kick/cancel/reopen notifs → Community mig **390**; competition points awarded notif → /?view=tournaments&id= (parity tournament_*) mig **391**; player report/match/QR `events_player_chrome` err keys soft-filled Tournament wording (mig **392**); player start/join err keys (mig **393**); spectate Match log / No activity yet (mig **394**); player arena queue err chrome (mig **395**); Official arena queue toast + writeTournamentsPlayerErr error_key (mig **396**); arena notif tournaments&id (mig **397**); Flutter cup lobby check-in maps `error_key` (Official+Community web parity); Flutter All-tab classifies focus id Official vs Community so hosted points deep-links open Community lobby (both probes use injected restUrl); web Community detail/lobby only when GET /events/{id} ok; hosted catalog+enums reload on request like client-nav); feature_flags WS refreshes Community catalog gate (web+Flutter; web catalog also refetchOnWindowFocus for guests; Host create/manage mid-dialog Public gate (web+Flutter feature_flags/resume); Host CTA prefer-Public survives stale catalog gate-off snapshots); admin points-toast helper blurb tournament title; player/host unavailable + host nav unavailable chrome Tournament/Hosting wording; host dashboard tab Hosting; guest `/events/join` → Community; signed-in Hosting Join → Community link (no second public browse grid); leftover Overview Tournaments dashboard card Event-sport soft-fill (mig **398**); Hosting nav drops public browse leftovers + Community lobby Event soft-fill (mig **399**); Flutter deep links/nav → Tournaments Community; player event notif titles/hrefs Tournament/Community; private = join-code only; admin ops Events catalog + admin.event_* notifs kept; points-toast admin settings shared; live `e2e-tournament-community-ux-check.mjs` (auto PG check mig 390–391 notif hrefs; player chrome mig **392–393** err keys; Host Public create asserts `share_url` Community+code on create+feed + `format_label` + `empty_community`); `e2e-hosted-events-check.mjs` player lifecycle hrefs assert Community (not legacy `view=events`); Flutter Hosting empty-nav fail-closed (DB events_nav_unavailable or nav skeleton; no blank body); Refund Policy tournament entry soft-fill (mig **400**: the tournament has started). E2E locks player.event_* notif titles (no Event sport) + report_title Tournament. Official+Community share standings_points_label/toast fmt (E2E locked; ClassicCupEngagementAwards). Player bottom/rail drops legacy Events browse even on primary-tab fallback (web filterPlayerNavLinks/pickBottomNavLinks; Flutter player_shell). Ops Hosting rail soft-replaces Event-sport title with events_brand_name; E2E locks portal_public_list_label Community (post-create toast). Flutter Hosting shell soft-replaces events_dashboard Event-sport tab title with events_brand_name (web ops parity); E2E locks bottom_nav+events Hosting title. Web Hosting rail/bottom pickHostingNavLinks soft-replaces Event-sport tab titles (events_dashboard brand + mig 378 list/join); Flutter Hosting shell same for list/join. Hosting page headings soft-fill (mig **401** list/dashboard/create/analytics) + web/Flutter display soft-remap if Event-sport regresses. Player Community headings soft-fill (mig **402** page/public/join/lobby/empty) + web/Flutter community-player-chrome-soft display remap. Residual action chrome soft-fill (mig **403** search/report/start/close/feature_disabled/public_*/empty_official) + soft-remap fail-open on web/Flutter player+Hosting paint. Reopen/unavailable soft-fill (mig **404**). Hosting list/dashboard blurb + empty_list + toast_created soft-fill (mig **405**) + web/Flutter soft-remap; PublicEventsBrowse early pageSize path soft title/blurb. Portal Community label + analytics/visibility_public blurbs soft-fill (mig **406**) + soft-remap. Hosting search_label + create_blurb + analytics_empty soft-fill (mig **407**) + soft-remap + JoinPanel/Flutter join soft unavailable + Hosting portal_create_label soft-remap. Hosting/player nav list icons Trophy/`emoji_events` (not calendar Event sport; client-only). Marketing footer guest Tournaments `/?view=tournaments` (mig **408**). Mig **182**/**187**/**189**/**298** player-facing seeds Tournament-safe + Go shareURL Community normalize; Hosting softHostingUploadSponsorFailed + upload_sponsor_failed mig **414** (legacy view=events catalog template) (share_path/Hosting brand/nav/notif ON CONFLICT; no Event browse insert); Mig **187**/**409** seed+force player/Hosting list chrome Tournament-safe (no mid-migrate Event-sport flash). Mig **201**/**410** player API err `err_event_not_found`/`err_forbidden` Tournament-safe (writeEventsPlayerErr). Mig **201**/**411** Hosting organizer create/list/start/close/update errs Tournament-safe (writeEventsOrgErr). Mig **189**/**412** close/reopen chrome + `player.event_auto_closed` Community href (parity finished). Mig **184**/**413** Hosting `patch_title_locked` / `upload_logo_failed` Tournament-safe. Wallet ledger seeds **188**/**190**/**192**–**194**/**236** Tournament-safe (387 force). Spectate seed **045** Match log / No activity yet (394 force). Community public-gate-off paints public_disabled soft (web+Flutter; EventsPlayerChrome fail-closed). Join-error mappers scrub unmapped API Event-sport via softCommunityJoinStatusMessage (web+Flutter). Cup-lobby err softs (web+Flutter) + Spectate softSpectateEventLogTitle/NoEvents. Cup-lobby roster/success/check-in + arena standings/streak softs. Flutter bracket SpectatePage parity; est-prize-share/softCommunityEstPrizeShareBlurb + ready/prize settled softs. Ancillary fail-open softCommunityCarouselAria / code label+placeholder / roster; Flutter-only errCodeRequired (web disables empty join submit); Flutter tournaments chrome catch softCommunityChromeUnavailable. Catalog `hosted_events_enabled` gates Host CTA + Community feature_disabled soft (web+Flutter); Hosting list/dashboard/analytics/Join softHostingFeatureDisabled/softCommunityFeatureDisabled when false (web+Flutter). Web Tournament hub region softTournamentsPageTitle (Flutter AppBar parity). Organizer invite copy resolveEventInviteShareUrl (list/dashboard/manage web+Flutter). Join-code strip softCommunityJoinCodeSection*. Hosting nav events_analytics softHostingAnalyticsTitle. Flutter dashboard last-share + create toast Community action soft (resolveEventInviteShareUrl / softHostingPortalPublicListLabel). Hosting nav events_join softCommunityJoinTitle (Join event parity web+Flutter). Marketing footer client remaps resolvePlayerNavHref + softTournamentsPageTitle (web+Flutter). Host lifecycle toasts softHostingToastStarted/Closed/Cancelled/Reopened; patch_title_locked + upload_logo_failed soft (web+Flutter). Host create pay dismiss dialog_close_label (soft cancel fallback). softHostingToastSaved/SaveFailed. softHostingBrandName on SurfaceHomeLink/rail/bottom/Flutter shell. Lifecycle failure toasts softHostingToastStart/Close/ReopenFailed. softHostingCancelAction on report/payment-join/manage close. pickOpsPlayerNavLinks softHostingBrandName. Flutter nav-unavailable softHostingChromeUnavailable. Official enroll/report cancel softHostingCancelAction (web+Flutter). Cup lobby softCommunityBracketTitle/PrizePendingBlurb. Join kicked/load_failed soft. cancel mutation softHostingToastSaveFailed. softCommunityLoadFailed painted on hub/detail/lobbies/join-error (web+Flutter). Flutter cup lobbies softCommunityPrizePendingBlurb (web parity). Flutter cup lobby softCommunityLoadFailed syntax fixed (no widget.softCommunityLoadFailed). softHostingToastCreateFailed on create (web+Flutter). softCommunityJoinBlurb + Flutter Join bracketTitle soft. Manage/Host bracket_title softCommunityBracketTitle (web+Flutter). softHostingTitleLabel on create/manage (web+Flutter). softTournamentsHostAction/HostBlurb on Tournaments Host CTA (web+Flutter). softTournamentsBadgeOfficial/Community on hub badges (web+Flutter; home Official badge soft). softTournamentsFilterSource All/Official/Community chips (web+Flutter). softTournamentsFilterSourceLabel + entry All/Free/Paid + softTournamentsJoinAction (web+Flutter hub/detail). softTournamentsFilterEntryLabel/FreeLabel/EnrollAction on hub cards (web+Flutter). softTournamentsFiltersToggleLabel/PlayersLabel/HostedByLabel (web+Flutter). softHostingPublicListEmpty on PublicEventsBrowse. Flutter Community filterEntryLabel soft. softTournamentsFiltersToggleShowAria/softTournamentsFiltersToggleHideAria. softCommunityReportSubmitAction + softHostingReportTitle/Action paint (web+Flutter report/lobby) + softCommunityReportReasonLabel/NoteLabel (web+Flutter report dialogs) + PublicEventsBrowse softTournamentsFilterEntry* + Flutter Official lobby softHostingReportAction. mapPlayerNavDisplayTitles + Join/detail/lobby/join-error + join-status toasts + lobby_unavailable + enroll/pay-join modal title/status + winners/share/spectate + result-card image/download + softCompetitionPointsLabel on toasts AND standings/arena tables (web+Flutter) + Official hub seated join_cta soft. catalogHostedFeatureOff (200 false + catalog 503) paints softCommunityFeatureDisabled (web hub/join/Host CTA + Flutter hub/join). Guest /events/join hides Hosting chrome until Community redirect (signed-in Hosting join unchanged). Flutter home Official carousel softTournamentsJoin/Enroll/Players/Entry/Free. softCommunityChromeUnavailable on Official hub home_chrome_unavailable + Flutter tournaments_page/home strip. Web tournaments/home/player chrome queries soft throw; Official hub paints tournaments chrome unavailable (no infinite skeleton). Hosting wallet/transactions/receipts paint softHostingChromeUnavailable. Flutter Hosting list softHostingChromeUnavailable. Flutter Community detail softCommunityLoadFailed(detailUnavailable||loadFailed) web EventDetailModal parity. Flutter Official TournamentsCubit soft enrollFailed/loadFailed; alreadyEnrolled snack soft; enrollMessage/joinedFree soft; Flutter Hosting Join join_event_page softCommunityJoinStatusMessage (alreadyJoined/approved/pending/rejected); Hosting manage results softCommunityWinnersTitle/ShareResult/ResultCardShareImage/Download (web ManageEventDialog + Flutter events_page; Join panel parity); Community detail/legacy Public browse softTournamentsFree/Entry/Players/HostedBy/Join (Flutter player_events_hub detail + web/Flutter PublicEventsBrowse card labels; hub/EventDetailModal parity); Flutter Host create dialog shell-fail softHostingChromeUnavailable(chrome.unavailable) (list/dashboard parity); Public browse filter toggle/entry chips soft (web+Flutter PublicEventsBrowse hub parity); Join/hub/detail insufficient_entry_fee softCommunityJoinStatusMessage paint (web JoinPanel/hub/detail + Flutter join_event_page); visibility_private softCommunity/softHostingVisibilityPrivateBlurb (Join/manage web+Flutter; public soft parity); web Host create page softHostingVisibilityPrivateBlurb (manage/Flutter create parity); public_rated + entry_fee_pay + force_auto_approve softCommunityJoinStatusMessage fail-open (Join/detail/hub/Host create/manage web+Flutter);   Community detail softCommunityShareAction.      softHostingToastCancelled web-mutation-only (docs accurate). tables unmerged. migrateonly KYC ADD/DROP tombstone caution documented. | Pass |

| Player rail Ad publisher + Dashboard label (mig **460**): public `client_nav.player` adds `ads_publisher` → `/ads/dashboard` (Host/My cups parity; not ops-filtered); `dashboard_page_title` + player/admin Overview titles → **Dashboard**; Hosting/Ads portal overview CTAs → Dashboard. Web rail/menu icons + Flutter `ads_publisher` open PublisherShell. | Pass |
| Tournament admin status after start (mig **459**): started/finished cups soft-archive only (no seat refund); Draft/Open blocked with `err_cup_already_started`; admin UI disables locked statuses + `status_after_start_blurb`; REST PATCH `/console/tournaments/{id}/status` (+ GraphQL parity). | Pass |

| Competition prize settle ops (mig **350–357**, **441**, **455–458**): shared escrow+dispute+settle (+ idempotent missing-escrow repair on each settle pass) for Official tournaments **and** organizer hosted events; auto-settle worker (`competition_prize_auto_settle` / interval / dispute hours in `client_enums`, required fail-closed) + console settle; admin Prize settle settings tab `GET/PUT /console/competition/prize-settle-settings` + detail dispute/settled timestamps + `settle_prizes_already_settled` chrome; Arena finish always visible (mig **455**). Player lobbies (web+Flutter Official+Community) show settled/pending blurbs only when escrow opened (`dispute_window_ends_at`) or settled - free/no-pot finishes never invent pending. Mig **458**: Prize paid notif → `/transactions?id=<ledger>` (web+Flutter seek/open row; bare `/wallet` fixed). E2E `e2e-platform-tournament-play-settle-check.mjs` + `e2e-hosted-event-play-settle-check.mjs` (both support `DAMA_E2E_WAIT_AUTO_SETTLE=1`); discovery chrome locks settle + prize-settle settings keys. | Pass |

| Classic host sizes 128 / 256 (mig **492**/**493**): seeds `size_128` / `size_256` (knockout + swiss) and swiss keys `128`→7 / `256`→8 when missing so company-scale classic brackets are catalog-ready; classic seat ceiling becomes largest swiss key (256 after seed). Mig **493** adds `groups_knockout` on those sizes only (no round_robin). |

| Competition Arena Unlimited open enroll (mig **488**/**489**/**490**/**491**): Community catalog sizes may set `max_players` null (Unlimited, Arena-only) or a high safety ceiling above the DB classic seat ceiling; Official cups omit `maxPlayers` or set a high ceiling for Arena only (`ValidateOfficialMaxPlayers` rejects classic null and classic high ceiling; present max under 2 is `err_max_players_required` and never coerced to Unlimited; chrome `err_unlimited_arena_only` / `err_max_players_required`). Admin Host Sizes Unlimited toggle rejects classic-range max (mig **490** `err_unlimited_max_high_or_empty`; EventsAdminChrome API requires that key fail-closed with the admin SPA). Admin size CRUD returns `error_key` for chrome-mapped toasts; hosted create rejects non-Arena when size is Unlimited/high (size max from DB only). Free Official cups no longer force-clear max. Hosted `max_players` nullable; join/approve/`RefreshOpenOrFull` skip full when uncapped (`PlayerCapOrZero`: null Unlimited uncapped; lt2 orphan fail-closed hard cap); Official enroll `RegisterWithCapacity` locks the cup row so classic/high ceilings cannot race over-cap; serialize emits present max even when under 2 so clients never treat omit as Unlimited; prize `if_full` only for classic fixed caps; API `seat_cap_unlimited` / GraphQL `seatCapUnlimited` drives player Unlimited fill labels for null and high; DB chrome `unlimited_players_label` on admin/organizer/player/tournament chromes; seeded `size_unlimited`; public catalog exposes `swiss_rounds_by_max_players` for organizer labeling. Classic formats stay fixed sizes at or below the DB ceiling. Guides: Formats + Complete App §8.9. E2E `e2e-host-sizes-check.mjs` + `e2e-arena-unlimited-enroll-check.mjs`. | Pass |

| Competition Arena duration UX (mig **444–445**): Arena create/settings use Length (Minutes/Hours/Days/Weeks/Months) or Ends-at calendar; still persist `arena_duration_minutes` only; classic formats have no timed duration. E2E `e2e-arena-duration-units-check.mjs`. |
| Competition Arena + payout + standings (mig **366–375** rollup; payout core **368** + freeze blurb **370** + points-toast admin **371** + toast fmt on `notification_chrome` **372** + KO score_share allowed **373** + dual_purse **374** + dual chrome blurbs force **375**): places_percent \| score_share \| dual_purse must be in `competition_payout_modes`; score-share / dual performance purse use **same phase filter as standings** (groups = group stage only; KO = knockout phase) for **all** formats including KO; dual_purse splits frozen pot by `competition_dual_purse_place_percent` (place purse finish % + performance purse Pts; end-of-cup only; total Pts=0 → full-pot places%); places% remains KO default/alternate (places 1/2/3+); empty mode never invents whole-pot→1st on displayed pots; classic Start freeze fail-closed; platform payout mode/% locked after start/freeze; paid create omit-mode → DB default; admin standings/arena/payout (+ dual place-purse %; PayoutDefaultsCard Save disabled when dual place-% invalid) + **points-toast settings CRUD** (labels + `toast_points_awarded_fmt` with `{points}`/`{label}` on player+play+`notification_chrome` + `player.competition_points_awarded` templates); web/Flutter toast from fmt + `body_args` (not invent English); admin projected places/score/dual fail-closed (admin scoreboard fetch for KO score_share/dual); finish escrow/freeze errors logged; est. share + points toast (KO/Arena/RR/Swiss/Groups; win Pts feed score-share + dual performance purse; KO lobbies fetch `/standings` for est. share Pts even when table UI hidden; client dual `totalPts=0` → full-pot places% parity). Classic post-start enroll blocked (Arena late-join via DB flag). Classic cups rematch draws (standings draw pts when terminal draw exists). Mig **370** place-% blurb: cups freeze at start; Arena at finish. | Pass (money harden + dual_purse mig **374** + KO score_share mig **373** + toast-fmt client wiring mig **372** + points-toast admin CRUD + hosted Groups + Arena/RR/Swiss/KO + create-defaults + auto-settle + toast E2Es) |

| Hosted events (mig **182-281**): prize pool now/if-full + optional guarantee hold (mig **267**; escrow harden mig **508**: floor pot max(entry nets, guarantee), UNIQUE ledger `(reference,kind)`, captured flag + reopen cycle re-hold, create hold+fee in one TX; web+Flutter create 402 uses `insufficient_prize_guarantee`); home `prize_pool_entry_fees_note` (mig **268**); admin tournament frozen blurb + entry-fees note (mig **269**); GraphQL FeatureFlags + schema.graphql/mobile/web/admin contracts include prize pool flags; Start = freeze ? MarkLive ? capture (capture fail reverts live + clears freeze; MarkLive fail clears freeze); kick/vacate refund fail-closed if payments missing; guaranteed UI requires held; tournament pot omitted on enroll-count error; admin list no declared-prize invent when pot omitted;  pay-to-create (host fee) ? live open; catalog sizes/formats/fees + display `label` DB-only (mig **211**; admin editable; event JSON `format_label`/`size_label`; public catalog omits unlabeled; web/Flutter create pickers fail-closed on empty label); player overview `dashboard_matches_joiner` (mig **212**; no invent space/`-`); visibility private\|public + always auto-approve; join code/link/QR; knockout bracket + start-game; entry fee + `entry_fee_commission_percent` split (player gross / organizer net / commission ledger); refund requires paid ledger; clawback takes available organizer balance (player always refunded); fee columns cleared after refund so KPIs ignore vacated seats; kick/close refundAndVacate; kicked seat may rejoin; reopen notifies vacated players (join-code href); career XP/rating only when public + `public_event_matches_rated`; period HoF uses `match_history.rated` (mig **222**); privacy gates; organizer dashboard/analytics + money portal under events shell; chrome fail-closed incl. DB `list_page_size` (organizer/player/admin/wallet) + organizer `top_up_href` (web+Flutter+admin skip/limit, public browse, receipts/transactions); OpsDataTable close/reopen/manage + ManageEventDialog pinned footer (organizer web); admin `/console/events` hosted cups Ops list + catalog commission % + reports queue; Flutter events REST parsers snake_case only (no camel invent); mig **230** report reason labels + payments real fee sums; mig **231** organizer share_result_action + results logo/sponsor share (web+Flutter); public report dialog reasonLabels; mig **232** entry status_label on roster (no UUID invent); mig **233** admin report reason label catalog UI; live check `scripts/e2e-hosted-events-check.mjs` | Pass |

| Community hosted prize media (mig **533**/**534**): additive Official-parity `description` + `prize_image_url` + `gallery` on `hosted_events` (keep logo/sponsor branding; do not convert branding into prize media). Organizer routes `POST/DELETE /events/{id}/prize-image` and `POST/DELETE /events/{id}/gallery/{index}`; `publicEvent` always emits the fields (free and paid). Host create accepts optional `description`; Manage branding uses EntityMediaEditor for prize thumb + gallery beside logo/sponsor (web+Flutter). Player cards/detail/join/lobby prefer prize→gallery then logo→sponsor when prize empty; result cards stay logo/sponsor. Admin hosted list thumb prize→first gallery (mig **534** heals list caption away from branding logo); detail keeps logo/sponsor labeled separately. Chrome fail-closed on organizer/player/admin `detail_description_label` (+ prize/gallery labels). Escrow, free pot-off, host trust, Official tournament media unchanged. E2E `scripts/e2e-hosted-event-prize-media-check.mjs` (free + paid create/upload, gallery-only after prize clear, gallery max 9, host-only 403, description clear, logo stays separate, admin list thumb chrome heal). Guides: architecture + Competition + Complete + Host Trust. | Pass |

| Ads publisher portal: create/geo/schedule/creative; **pay-to-create** via dual DB fees `ad_pricing.campaign_create_fee_ethiopia_*` (ETB) + `campaign_create_fee_global_*` (USD outside Ethiopia; mig **323-324**; admin Progression clear labels; currencies locked to `payment_currency`); publisher resolve still returns geo `campaign_create_fee_amount`/`currency` (wallet debit + ledger `campaign_create_fee`, unpaid create rolled back + DeleteOwned fail-closed); close/reopen + `ends_at` auto_closed worker (raw status PATCH blocked when auto_closed); admin notifs on manual close/reopen + auto_close; daily spend cap uses **today's** impressions; dashboard KPIs (GraphQL create-fee sum filtered to display currency) + campaign list REST skip/limit + money portal (wallet/receipts/transactions/payout) under ads shell (web + Flutter); campaigns/dashboard/analytics/admin console from DB `list_page_size` + dialog/list labels (`cancel_action`, `dialog_close_label`, search/filter/view) served on `schedule_chrome` (mig **205**); analytics campaign column uses `publisher_campaigns_heading` only (no page_title invent); playback chrome DB-only. Live check `scripts/e2e-ads-create-fee-check.mjs` | Pass |



## Live E2E



Latest re-run (local docker Postgres/Redis + API with `DAMA_ALLOW_E2E_AUTH=1`):



| Suite | Result |

|---|---|

| Play-rail C/D + mig107-108 chrome + Flutter Friends/All gen-guard | **E2E_PASS** (rail/lb playing labels, TC, accept, decline, friends, live, web 200) |

| `scripts/e2e-ux-parity.ps1` | **ALL CHECKS PASSED** |

| `scripts/e2e-live-smoke.ps1` | Invite block extended (rated+color+preset TC, double-accept, challenge link, rail chrome, friends/live/players/history); full suite may still fail later on unrelated ads campaign path if campaign seed missing |

| `scripts/e2e-rbac-ads.ps1` | **E2E OK** (RBAC CRUD, protected perms, in-match schedule, first-show/interval, period caps, non-skippable 10-15-12-10) |

| `scripts/e2e-activity-analytics-check.mjs` | Public/admin chrome (Usage + heatmap/cumulative/breakdown keys) + visit? + series + heatmap_stats + breakdowns; console year 365-366 + `today_day`; invalid period 400; heartbeat; player `activity.read` deny |

| `scripts/e2e-hof-votes-qr-check.mjs` | HoF periods + Bearer `me`, warm QR + CORS `Content-Disposition` expose, cast vote, seated cast reject, correct voters after finish, `vote_players_cannot` chrome |

| `scripts/e2e-chat-dm-check.mjs` | Chrome keys (149-162 poll/loading/reply + join/load/DM-open/DM-load-fail + reaction/receipt/emoji-search + receipt glyphs + lightbox chrome + **169** pending/failed/retry + **170** delivered aria/glyph on play_rail + spectate), `GET /public/chat-emoji-catalog` (=500 glyphs + quick_reactions), DM request+preview, `player.dm_request` deep-link+mark-read, `player.dm_message` `thread=` deep-link after accept, pre-accept 403, accept+reply+invalid `reply_to_id`, create `receipt=sent` + `client_id` echo, compose-new seed `receipt=sent` + `client_id` + idempotent same-request retry, accepted-thread idempotent double POST same `client_id` -> same message id, DM mark-read -> `receipt=read`, newer outbound stays `receipt=sent` until peer mark-read -> `receipt=read`, DM react, auth+join-gated chat list/post, `image_url` 400, non-seated toggle 403, pending uniqueness, seated PvP post/reply/`client_id` echo+idempotent retry/react/read/`seen_count`/disable/history/re-enable, multipart PNG upload DM+game (`dama/chat`), video/mp4 reject |

| `scripts/e2e-hosted-events-check.mjs` | **E2E_PASS** on `:18080` through mig **281** + console GET + deep-link seek; prize pool flags/columns/chrome + create/join grow/kick drop/cancel release/start freeze/guarantee hold+release+capture + insufficient-guarantee reject + tournament GraphQL pot+`prizePoolGuaranteeAmount`+enroll grow+status freeze + kill-switch omits pot; mig **241-253** money notifs, portal payout focus, notif/invoice/auth-gate/OTP/OAuth/guest/compliance chrome, GraphQL publisher dash errors from DB; organizer+publisher wallet balance KPI; cash/RMG + geo heartbeat; OpsDataTable money `ops-row-{id}`; Flutter events+ads close chrome-only; Flutter otp_chrome err_* fail-closed; mig **250** legal+fingerprint API chrome; Flutter portal + player home wallet balance KPI; mig **251** avatar API chrome; mig **252** tournament API chrome + admin console chrome fail-closed; mig **253** txn deep-link id match + ads create-fee KPI; mig **270-272** `player.payout_updated` -> `/wallet?id=` history + mine seek/status_label/note/reviewed_at + mark-read; POST /payouts/request -> admin.payout_pending /payments?payout= + console mark-read; mig **275** wallet `link_*_href` + admin payments `list_page_size` from DB. See architecture **182-281**. Launch catalog formats (knockout / round_robin / swiss / groups_knockout) are DB-driven via admin Select + `client_enums.tournament_formats` (fail-closed chrome; no client hardcode). Events finish via bracket + organizer close (no hosted-events ends_at worker; ads keep ends_at auto-close). Soft archive. Result card = share text + DB-chrome PNG (mig **256-261**). Prize pool = entry nets + optional guarantee (mig **267**) + escrow settle worker (mig **350+**). Formats playthrough E2E: `scripts/e2e-hosted-formats-check.mjs` + `scripts/e2e-platform-tournament-suite.mjs`. Admin hosted Events Ops read-only (reports deactivate is scalpel). Monthly plan later upsell not in scope. |

| `scripts/e2e-hosted-formats-check.mjs` | **E2E_PASS** on `:18080`: enable-all playthrough knockout/RR/Swiss/groups_knockout + AdvanceOnGameFinish; restore knockout-only; assert result_card layout/typography/dialog/branding/width/card-pad chrome keys through mig **266** + prize pool chrome/flags through mig **267-269**; public catalog enabled-only; mig **270-278** payout history + admin money toast_failed chrome (incl. note + reviewed labels + link hrefs) + `/wallet?id=` seek + `status_label` stamp + admin payments page size. |

| `scripts/e2e-platform-tournaments-formats-check.mjs` | **E2E_PASS** on `:18080`: platform tournament formats from `client_enums.tournament_formats` (knockout/RR/Swiss/groups_knockout) create→open→enroll→start→bracket; admin format Select is enum-driven (mig **350-354**). |

| `scripts/e2e-platform-tournament-play-settle-check.mjs` | **E2E_PASS** on `:18080`: paid KO check-in→start→forfeit finish→prize escrow→wallet credit. Default: console settle. With `DAMA_E2E_WAIT_AUTO_SETTLE=1`: background worker settles after dispute window (no console click). Gated by `competition_prize_auto_settle` (mig **350-357**). |

| `scripts/e2e-platform-tournament-suite.mjs` | Master suite (mig **366–375** surface): standings Pts + dual-ready (+ rated board) + rematch + ready-timeout + formats + Arena ops/notifs/toast + platform+hosted KO **points toast** (engagement; places% money unchanged) + points-toast settings CRUD + payout guards/create-defaults + Arena/KO/RR/Swiss/Groups places% + score-share + **dual_purse** (platform + hosted) + settle + archive refund + report + check-in seed + hosted dual-ready/ready-timeout/settle/report + hosted Arena/toast/payout + pairing-leave + natural timer. Client deep-link: Flutter tournament focusId detail fetch; web EventsPlayerHub + EventsJoinPanel lobby from entries/seat latch. |
| `scripts/e2e-platform-tournament-ready-timeout-check.mjs` | **E2E_PASS** on `:18080`: one seat Ready, opponent silent past DB timeout → worker auto-forfeit (mig **361**). Also asserts `/platform/enums` exposes ready-timeout + check-in window keys. |
| `scripts/e2e-hosted-event-ready-timeout-check.mjs` | **E2E_PASS** on `:18080`: hosted event same ready-timeout worker path (one Ready, opponent silent → auto-forfeit). |
| `scripts/e2e-competition-checkin-seed-check.mjs` | **E2E_PASS** on `:18080`: enroll N+1, check-in only N → start → unchecked user absent from tournament + event bracket seats. |
| `scripts/e2e-hosted-event-play-settle-check.mjs` | **E2E_PASS** on `:18080`: paid event KO forfeit finish → `competition_prize_payouts` event escrow → wallet credit. Default: console settle. With `DAMA_E2E_WAIT_AUTO_SETTLE=1`: background worker settles after dispute window (organizer parity with platform; no console click). |
| `scripts/e2e-hosted-event-report-check.mjs` | **E2E_PASS** on `:18080`: event report → open report blocks settle → dismiss → settle credits (parity with tournament report gate). Also asserts `player.event_joined` / `player.event_report_received` `href_entity_id` = event UUID (cup lobby deep link, not join code). |
| `scripts/e2e-hosted-events-dual-ready-check.mjs` | **E2E_PASS** on `:18080`: event check-in→start→player dual-ready→auto `game_id` (mig **360** check-in seed). |

| `scripts/e2e-platform-tournament-report-check.mjs` | **E2E_PASS** on `:18080`: enrolled player report→console list→finish cup→settle blocked while report open→dismiss→settle credits (mig **358**). |

| `scripts/e2e-platform-tournament-dual-ready-check.mjs` | **E2E_PASS** on `:18080`: both players Ready on a ready bracket match→server auto StartGame→`game_id` on response + bracket (cup lobby poll/WS open board on clients). |

| `scripts/e2e-platform-tournament-standings-pts-check.mjs` | **E2E_PASS** on `:18080`: platform Round Robin forfeit→`GET /tournaments/{id}/standings` winner `points>=1` / `wins>=1` (cup Pts layer; falsifies “tournaments have no standings Pts”). |
| `scripts/e2e-platform-tournament-arena-check.mjs` | **E2E_PASS** on `:18080`: arena cup create→start→queue→worker pair→standings→leave→in-match re-queue 409→`POST /console/tournaments/{id}/arena/finish`→`finished_at`+`winner_id`→leave queue 200 (mig **366-367**). |
| `scripts/e2e-competition-arena-notifications-check.mjs` | Platform Arena start→`player.arena_started` → queue/pair→`player.arena_matched` → force-finish→`player.arena_finished` (app_notifications rows for both seats; mig **366** kinds). |
| `scripts/e2e-hosted-event-arena-check.mjs` | Hosted Arena create→join→start→queue→pair→standings→leave→`POST /events/{id}/arena/finish` (mig **366-369**). |
| `scripts/e2e-platform-tournament-arena-timer-check.mjs` | Platform Arena start → backdate `arena_ends_at` → finish worker sets `finished_at` (natural expiry path). |
| `scripts/e2e-competition-points-toast-settings-check.mjs` | Admin GET/PUT `/console/competition/points-toast-settings` round-trip (arena/standings labels + toast fmt + notif title/body); reject body without 3 `%s`; restore (mig **371**). |
| `scripts/e2e-competition-points-toast-check.mjs` | KO + RR + Swiss + Groups (group phase) forfeit → winner `player.competition_points_awarded` notif row + API body (toast source for web Sonner + Flutter SnackBar). |
| `scripts/e2e-competition-ko-points-toast-check.mjs` | Platform KO: admin standings probe → forfeit → unread `body_args` points+label + unread/list `toast_points_awarded_fmt` renderable (web Sonner / Flutter SnackBar inputs); restore settings; places% money unchanged. |
| `scripts/e2e-hosted-event-ko-points-toast-check.mjs` | Hosted KO: same admin probe + client chrome toast-path asserts as platform (parity). |
| `scripts/e2e-hosted-event-points-toast-check.mjs` | Hosted KO + RR + Swiss + Groups (group phase) forfeit → winner `player.competition_points_awarded` (hosted toast parity). |
| `scripts/e2e-competition-arena-pairing-leave-check.mjs` | Arena pairing mode `score` pairs closest high scores; leave-queue keeps `arena_points`; re-queue OK; restores settings. |
| `scripts/e2e-platform-tournament-rr-score-share-check.mjs` | Paid RR `score_share` by standings Pts → playthrough → escrow → settle → wallet (proves score-share beyond Arena). |
| `scripts/e2e-competition-arena-points-toast-check.mjs` | Arena queue→pair→forfeit (incl. ready match without game_id) → `arena_points` + points-awarded notif body. |
| `scripts/e2e-competition-arena-ops-check.mjs` | Admin `arena-settings` + `standings-settings` CRUD; streak-2 points; platform late enroll + hosted late join while live; restores arena settings. |
| `scripts/e2e-competition-payout-guards-check.mjs` | Admin payout-defaults CRUD incl. `competition_dual_purse_place_percent` PUT/GET round-trip + reject 0/100/abc; KO default/tournament `dual_purse` + `score_share` allowed (places% alternate); GraphQL create KO `dual_purse` asserts `prizePlacePercents` persist (explicit + omit→enum defaults) + reject bad place% sum; console PUT dual reject bad place% (unchanged); `score_share`; classic RR post-start enroll 409; arena pairing-mode round-trip (mig **373–374**). |
| `scripts/e2e-platform-tournament-ko-score-share-check.mjs` | Paid KO `score_share` by knockout-phase win Pts → pot×points/total escrow (eliminated winners share) → settle → wallet. |
| `scripts/e2e-hosted-event-ko-score-share-check.mjs` | Paid hosted KO `score_share` by knockout-phase win Pts → escrow → settle → wallet. |
| `scripts/e2e-platform-tournament-ko-dual-purse-check.mjs` | Paid 8-player KO `dual_purse` (place purse % + performance purse by win Pts) → merge escrow → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-hosted-event-ko-dual-purse-check.mjs` | Paid hosted 8-player KO `dual_purse` place+performance merge escrow → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-platform-tournament-arena-dual-purse-check.mjs` | Paid 4-player Arena `dual_purse` place+arena-Pts performance → finish freeze → merge escrow → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-hosted-event-arena-dual-purse-check.mjs` | Paid hosted 4-player Arena `dual_purse` place+arena-Pts performance → finish freeze (+ guarantee) → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-platform-tournament-rr-dual-purse-check.mjs` | Paid 6-player RR `dual_purse` place purse % + standings-Pts performance → merge escrow → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-platform-tournament-swiss-dual-purse-check.mjs` | Paid Swiss `dual_purse` place purse % + standings-Pts performance → merge escrow → settle → wallet; asserts ≥1 non-ITM (outside places 1/2/3) performance payee (mig **374**). |
| `scripts/e2e-platform-tournament-groups-dual-purse-check.mjs` | Paid Groups `dual_purse` place purse % + group-stage Pts performance → merge escrow → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-hosted-event-rr-dual-purse-check.mjs` | Paid hosted 6-player RR `dual_purse` place+performance merge escrow → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-hosted-event-swiss-dual-purse-check.mjs` | Paid hosted Swiss `dual_purse` place+performance merge escrow → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-hosted-event-groups-dual-purse-check.mjs` | Paid hosted Groups `dual_purse` place+group-stage Pts performance → merge escrow → settle → wallet; asserts ≥1 non-ITM performance payee (mig **374**). |
| `scripts/e2e-competition-payout-create-defaults-check.mjs` | Paid GraphQL Arena/KO/RR/Swiss/Groups + hosted Arena create omit `prizePayoutMode` → DB format defaults (`score_share` / `places_percent` + default percents); KO default temporarily `dual_purse` → omit-mode create asserts dual + place percents (platform GraphQL + hosted REST) then restores; hosted REST dual + bad place% sum → 400 (create + manage PATCH). |
| `scripts/e2e-platform-tournament-play-settle-check.mjs` (`DAMA_E2E_WAIT_AUTO_SETTLE=1`) | Paid KO finish → escrow → dispute close → **auto-settle worker** (no console settle) → wallet. Console settle remains default path when env unset. |
| `scripts/e2e-hosted-event-play-settle-check.mjs` (`DAMA_E2E_WAIT_AUTO_SETTLE=1`) | Paid organizer KO finish → event escrow → dispute close → **same auto-settle worker** settles hosted payouts (no console settle) → wallet. |
| `scripts/e2e-platform-tournament-ko-places-percent-check.mjs` | Paid KO `places_percent` 50/30/20 → playthrough → places 1/2/3 from final+semis → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-ko-places-percent-check.mjs` | Paid hosted KO `places_percent` 50/30/20 → places 1/2/3 → escrow → settle → wallet. |
| `scripts/e2e-platform-tournament-rr-places-percent-check.mjs` | Paid RR `places_percent` 50/30/20 (default mode) → playthrough → placements → escrow → settle → wallet. |
| `scripts/e2e-platform-tournament-swiss-places-percent-check.mjs` | Paid Swiss `places_percent` 50/30/20 → playthrough → standings placements → escrow → settle → wallet. |
| `scripts/e2e-platform-tournament-swiss-score-share-check.mjs` | Paid Swiss `score_share` by standings Pts → playthrough → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-rr-places-percent-check.mjs` | Paid hosted RR `places_percent` 50/30/20 → freeze at start → placements → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-swiss-places-percent-check.mjs` | Paid hosted Swiss `places_percent` 50/30/20 → freeze at start → placements → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-swiss-score-share-check.mjs` | Paid hosted Swiss `score_share` by standings Pts → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-rr-score-share-check.mjs` | Paid hosted RR `score_share` by standings Pts → escrow → settle → wallet. |
| `scripts/e2e-platform-tournament-groups-places-percent-check.mjs` | Paid Groups `places_percent` 50/30/20 → playthrough → placements → escrow → settle → wallet. |
| `scripts/e2e-platform-tournament-groups-score-share-check.mjs` | Paid Groups `score_share` by standings Pts → playthrough → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-groups-places-percent-check.mjs` | Paid hosted Groups `places_percent` 50/30/20 → freeze at start → placements → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-groups-score-share-check.mjs` | Paid hosted Groups `score_share` by standings Pts (group stage filter) → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-arena-points-toast-check.mjs` | Hosted Arena queue→pair→forfeit → `arena_points` + points-awarded toast notif. |
| `scripts/e2e-platform-tournament-payout-percent-check.mjs` | Paid Arena `places_percent` 70/30 → finish → escrow → dispute close → settle → wallet credit (mig **368**). |
| `scripts/e2e-platform-tournament-payout-score-share-check.mjs` | Paid Arena `score_share` by arena points → finish → escrow → settle → wallet (mig **368**). |
| `scripts/e2e-hosted-event-arena-payout-score-share-check.mjs` | Paid hosted Arena: PATCH `score_share` before start → finish freeze (+ guarantee) → escrow → settle → wallet. |
| `scripts/e2e-hosted-event-arena-payout-percent-check.mjs` | Paid hosted Arena: PATCH `places_percent` 70/30 → finish freeze (+ guarantee) → escrow → settle → wallet. |

| `scripts/e2e-ads-create-fee-check.mjs` | **E2E_PASS** on `:18080` through mig **324** + dual pricing assert (Addis → ETB Ethiopia fee, NYC → USD global fee) + map pin required (country-only rejected) + create fee at Addis pin + title patch + get/list labels + console GET + admin campaign notif `href_query_key=id` + invoice PDF chrome + unauth invoice `err_unauthorized` + schedule `err_dashboard_failed` + OTP/OAuth/guest chrome on money/sign-in paths. |



```powershell

$env:DAMA_E2E_API = 'http://127.0.0.1:8080'

$env:DAMA_E2E_WEB = 'http://127.0.0.1:3300'      # use a free host port (Windows may exclude 3000-3223)

$env:DAMA_E2E_CONSOLE = 'http://127.0.0.1:3500'

Remove-Item Env:DAMA_REDIS_URL, Env:REDIS_URL -ErrorAction SilentlyContinue

$env:REDIS_PASSWORD = 'change-me-local-redis'

powershell -File scripts/e2e-live-smoke.ps1

powershell -File scripts/e2e-rbac-ads.ps1

```



## Remaining honesty (not greenwashed)



| Gap | Status |

|---|---|

| Live Chapa/Paddle webhook delivery to a public URL | OPS_EXTERNAL (secrets in `.env`; need tunnel + dashboard destination) |

| Casual board / matchmaking seats | Non-monetary by design; paid path is tournament enroll + `is_free` |

| Tournament paid create/enroll fee gate | Pass (`paid_zero_fee_rejected` in live smoke) |

| Client invent UI copy on play/matchmaking (web + mobile) | Closed (DB chrome + E2E) |

| Admin tournament Make free / fee form invent | Closed (`tournament_chrome_db`) |

| Admin banks/payments/media/flags/avatars/telemetry/users/dashboard invent | Closed (`admin_console_chrome_db`) |

| Dense progression form field labels + admin mutation toasts | Closed (`040`/`041` + `admin_console_chrome_db`) |

| Public player inspect modal invent (web) | Closed (`042` + `profile_inspect_chrome_db`) |

| Flutter wallet/profile/match-board/inspect + practice flag invent | Closed (`043`/`044` + expanded wallet/play/profile chrome) |

| Flutter / web avatar, spectate, leaderboard, tournaments, OTP, wallet receipt invent | Closed (`045` + E2E chrome asserts) |

| Player dashboard / brand invent (`client_nav` brand + dashboard page chrome) | Closed (`046` + mig **197** overview KPI/table/action hrefs fail-closed) |

| Web `/settings` residual English invent | Closed (mig **198** session label + fail-closed title/blurb/profile CTA; profile?settings hrefs from `client_nav`) |

| Events/ads `/receipts` + `/transactions` re-export player shell | Closed (`ReceiptsWorkspace` / `TransactionsWorkspace` with `moneyBasePath`) |

| Ads unpaid create orphan on delete failure | Closed (DeleteOwned fail-closed + E2E orphan=0) |

| Join top-up hardcoded `/wallet` | Closed (mig **199** `top_up_href` on events player chrome) |

| Hosted / platform Arena clock | Arena uses `arena_ends_at` + competition arena finish worker; classic cups still finish on bracket completion + organizer close. Ads use creative `ends_at` auto_closed. E2E: `e2e-platform-tournament-arena-check.mjs` / `e2e-hosted-event-arena-check.mjs` (force-finish) + `e2e-platform-tournament-arena-timer-check.mjs` (natural expiry). |

| Hosted events multi-format catalog | Pass: admin per-format enabled toggles; organizer/public create list enabled-only; DB (mig **350+**) knockout / RR / Swiss / groups_knockout enabled with labels; engines present |

| Hosted events result card PNG | Pass: share text + canvas PNG from DB chrome (colors/fonts/filename/layout mig **256-261**); branding preview + dialog scroll + dialog/panel widths from chrome (mig **263-265**); clients fail closed; image share never invents download/text on failure |

| Monthly plan later upsell | Deferred (explicitly out of scope) |

| Paid join entry+settle not single DB transaction | Closed (zero-fee insert ? settle ? `SetEntryFeeMoney`; settle/stamp fail rolls back seat; stamp fail refunds) |

| Hosted events English API error strings | Closed (mig **201** `err_*` chrome + `writeEventsOrgErr` / `writeEventsPlayerErr` / `writeEventsAdminErr` with `error_key` for admin SPA chrome map; catalog put uses `err_catalog_invalid`) |

| Ads API English error invent | Closed (mig **202** `err_*` on `ad_runtime_chrome` + `writeAdsErr` / `AdRuntimeChromeString`) |

| Flutter events invent (` ? ` / bye / vs / top_up_href) | Closed (player/organizer bracket chrome + `meta_separator`; join honors `topUpHref` for `/wallet`) |

| Mobile events list close/reopen parity vs web OpsDataTable | Closed (PopupMenu manage/copy link/download QR/close/reopen gated like web; dashboard copy last share on web+Flutter; QR Bearer auth on manage+list) |

| Admin manual campaign close/reopen admin notifications | Closed (mig **200** `admin.campaign_closed` / `admin.campaign_reopened` + EmitAdmins) |

| Ads analytics labeled GraphQL in older notes | Closed honesty: REST aggregate via `useAdAnalyticsQuery` |

| Wallet top-up/route, MatchClock, leaderboard W/L/D, theme toggle, console brand invent | Closed (`047` + `theme_chrome_db` + expanded wallet/leaderboard/console_nav asserts) |

| Mobile live status / spectate moves / admin users W-L / media today / is_free display invent | Closed (`048` + expanded play/spectate/tournament/admin_console chrome) |

| Marketing hero/footer, site/console meta, ads brand, invoice filename, crop/WS/status invent | Closed (`049` + client_nav/console_nav/ad_runtime/play/avatar chrome) |

| Remaining list ` ? ` separators (tournaments/matchmaking/ads) invent | Closed (`050` + meta_separator on those chrome docs) |

| Play abandon / stop only local | Closed (`POST /games/{id}/abandon` + ForcedOutcome + web pending confirm) |

| Outgoing invite wait + publisher/matchmaking pending labels | Closed (mig `078` + REST `noteOutgoing`) |

| Play history skip labels + bottom-nav Continue/Playing invent | Closed (mig `079`) |

| Stats `/`, draw/enroll `()`, telemetry/media separators, enums unavailable invent | Closed (`051`) |

| Wallet/theme/match-clock paren wrappers + board size join invent | Closed (`052`) |

| Admin media-pool upload toast paren invent | Closed (`053`) |

| Label/value, amount/currency, piece glyphs, ads count parens, admin CSV/audit join invent | Closed (`054`) |

| Wallet checkout / receipt submit toasts invent | Closed (`wallet_chrome` receipt_submitted / checkout_failed + fail-closed mutations) |

| Clock digit `mm:ss` and GraphQL Accept `;` | Structural protocol/time formatters (not UI copy invent) |

| GraphQL as volume-primary for player tournaments/ads CRUD | Overstated in older PRD text; REST remains primary for those paths |

| YouTube OAuth refresh tokens / OTP carrier / edge WAF / mTLS / Rekognition add-on | OPS_EXTERNAL |

| Cash phone OTP SMS delivery to handset | OPS_EXTERNAL (carrier); E2E uses `debug_code` only when `DAMA_ALLOW_E2E_AUTH=1` |

| Play/App Store age-rating questionnaires + corporate Apple RMG account | OPS_EXTERNAL (`STORE_PACKAGING.md`) |

| Playwright / visual browser E2E for mini-cards, shimmer, calendar clip | Not in `e2e-ux-parity.ps1` (API + chrome asserts only) |

| Soft 401 on presence/fingerprint | Cleared quietly (`session_expired`); protected routes still bounce |

| Fail-closed chrome ? endless shimmer | Closed for admin console pages + ads/KYC/play/matchmaking/home (error copy, not skeleton) |

| AI training stuck until Start after OTP | Closed (`OTP_SESSION_EVENT` + play auto-start re-run) |

| OTP overlay flash before userId hydrate | Closed (gate requires `userId`; sessionStorage is source of truth) |

| Enroll modal ?dormant? (balance=0 while wallet loading ? false insufficient) | Closed (web + Flutter: wait for geo/wallet; country-missing path) |

| Enroll/wallet ?dormant? while feature-flags still loading (`cashLocked` true) | Closed (web + Flutter: shimmer/`resolving` until flags settle; lock only after settle) |

| Top-up amount accepted letters | Closed via shared `AmountInput` (keydown/beforeinput/paste + `sanitizeDecimalInput`) on web/admin money fields; Flutter `FilteringTextInputFormatter` + sanitize. Requires hard refresh of web/admin after deploy |

| Amount Field/Input + chrome placeholders vs Trim | Partial ? enroll/wallet/admin fee/campaign money + OTP + matchmaking/spectate invite use Field/Input + chrome placeholders (`085` on live DB). Events admin catalog host fee + entry commission use `AmountInput`. Wallet shows `balance_pending` (not blank). Mobile ads lat/lng/cap + schedule ints sanitized. Admin banks/rbac/payments text forms still raw `<input>` in places |

| Full Playwright form/placeholder visual parity with Trim | Not claimed (API chrome probes + sanitize unit smoke; no Playwright keystroke E2E in CI yet) |



## OPS_EXTERNAL only



Live Chapa/Paddle webhook secrets pointed at public tunnels, YouTube OAuth refresh tokens, outbound OTP SMS/email, public edge WAF, production mTLS, Cloudinary Rekognition subscription. Store Connect / Play Console age questionnaires and Apple corporate RMG account.

