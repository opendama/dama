package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"dama/apps/api/internal/adsgeo"
	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/config"
	"dama/apps/api/internal/crypto"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/graphql"
	"dama/apps/api/internal/invites"
	"dama/apps/api/internal/matchmaking"
	"dama/apps/api/internal/media"
	"dama/apps/api/internal/middleware"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/presence"
	"dama/apps/api/internal/redisx"
	"dama/apps/api/internal/rest"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"
	"dama/apps/api/internal/youtube"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "-readyz" {
		os.Exit(runReadyzProbe())
	}

	cfg := config.Load()
	if strings.TrimSpace(cfg.JWTSecret) == "" {
		if !config.AllowDevSecrets() {
			log.Fatal("JWT_SECRET (or DAMA_JWT_SECRET) is required; set DAMA_ALLOW_DEV_SECRETS=1 only for local smoke")
		}
		cfg.JWTSecret = "dev-only-local-jwt"
		log.Println("warning: using ephemeral local JWT secret (DAMA_ALLOW_DEV_SECRETS=1)")
	}
	if strings.TrimSpace(cfg.SecretsKey) == "" {
		if !config.AllowDevSecrets() {
			log.Fatal("DAMA_SECRETS_KEY is required; set DAMA_ALLOW_DEV_SECRETS=1 only for local smoke")
		}
		cfg.SecretsKey = cfg.JWTSecret
		log.Println("warning: using ephemeral local secrets key (DAMA_ALLOW_DEV_SECRETS=1)")
	}
	handle, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer handle.Close()

	redisClient, err := redisx.Connect(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer redisClient.Close()

	vault, err := crypto.NewVault(cfg.SecretsKey)
	if err != nil {
		log.Fatalf("secrets vault: %v", err)
	}
	revoked := auth.NewRevocationList(redisClient)
	disabled := auth.NewDisabledStore(redisClient)
	tokens := auth.NewTokenService(cfg.JWTSecret, 72)
	users := store.NewUserStore(handle)
	flags := store.NewFlagStore(handle)
	tournaments := store.NewTournamentStore(handle)
	entries := store.NewEntryStore(handle)
	ads := store.NewAdStore(handle)
	banks := store.NewBankStore(handle, vault)
	settings := store.NewSettingsStore(handle)
	auth.SetGateChrome(settings)
	flags.AttachSettings(settings)
	consoleGate := auth.ConsoleRoleGate{Allowed: settings.IsConsoleRole}
	mediaUploadGate := auth.MediaUploadRoleGate{
		IsConsole:   settings.IsConsoleRole,
		IsPublisher: settings.IsPublisherRole,
	}
	matches := store.NewMatchHistoryStore(handle)
	audit := store.NewAuditStore(handle)
	otpStore := store.NewOTPStore(handle)
	fingerprints := store.NewFingerprintStore(handle)
	geoIPStore := store.NewGeoIPStore(handle)
	paySvc := payments.NewService(cfg, handle, flags, banks, settings)
	ytPool := youtube.NewPool(handle, vault, cfg.AllowYouTubeStub)
	if err := ytPool.ReloadFromDB(context.Background()); err != nil {
		log.Printf("media pool: hydrate from database: %v", err)
	}
	geoResolver := geo.NewResolver()
	presenceSvc := presence.New(redisClient)
	adGeo := adsgeo.New(redisClient, ads, settings)
	_ = flags.Get(context.Background())

	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()
	ytWorker := &youtube.Worker{
		Pool:  ytPool,
		Redis: redisClient,
		OnDone: func(ctx context.Context, job youtube.UploadJob, result *youtube.UploadResult, err error) {
			if job.LocalPath != "" {
				_ = os.Remove(job.LocalPath)
			}
			if err != nil || result == nil || job.CampaignID == "" || job.PublisherID == "" {
				return
			}
			enums := settings.ClientEnums()
			if enums.Source != "database" || enums.VideoCreativeType == "" {
				return
			}
			c, getErr := ads.Get(ctx, job.CampaignID)
			if getErr != nil || c == nil || c.PublisherID != job.PublisherID || c.AutoClosed {
				return
			}
			if store.IsValidViewportSlot(job.ViewportSlot) {
				_, _ = ads.AttachYouTubeViewport(ctx, job.CampaignID, job.PublisherID, job.ViewportSlot, result.VideoID, enums.VideoCreativeType)
				return
			}
			_, _ = ads.AttachYouTube(ctx, job.CampaignID, job.PublisherID, result.VideoID, enums.VideoCreativeType)
		},
	}
	ytWorker.Start(workerCtx)

	if err := seedAdmin(context.Background(), users, settings); err != nil {
		log.Printf("seed bootstrap: %v", err)
	}

	hub := ws.NewHub(tokens, cfg.CORSOrigins)
	hub.AttachRedis(redisClient)
	hub.StartRedisFanout(workerCtx)
	gameStore := gamestore.New(redisClient)
	queue := matchmaking.NewQueue(gameStore, hub, redisClient, settings, handle)
	queue.OnGameCreated = func(gameID string) {
		rest.WarmJoinQRPNG(settings, gameID)
	}
	avatars := media.NewAvatarService(cfg)
	rateLimit := middleware.NewRateLimit(redisClient, cfg.RateLimitPerMinute)
	// Dedicated budget for official pause/resume/meta (DB official_pause_chrome.rate_limit_per_minute).
	officialPausePerMin := settings.OfficialPauseRateLimitPerMinute(context.Background())
	if officialPausePerMin <= 0 {
		log.Printf("official_pause_chrome.rate_limit_per_minute missing; apply mig 506 (soft-fill 20)")
		os.Exit(1)
	}
	officialPauseRateLimit := middleware.NewRateLimit(redisClient, officialPausePerMin)

	hostedEvents := store.NewHostedEventStore(handle)
	competitionPrizes := store.NewCompetitionPrizeStore(handle, settings)
	rbacStore := store.NewRBACStore(handle)
	officialPauseStore := store.NewOfficialPauseStore(handle)
	api := &rest.API{
		Store:             gameStore,
		Hub:               hub,
		Flags:             flags,
		Matches:           matches,
		Settings:          settings,
		Users:             users,
		Redis:             redisClient,
		DB:                handle,
		HostedEvents:      hostedEvents,
		Tournaments:       tournaments,
		CompetitionPrizes: competitionPrizes,
		Payments:          paySvc,
		RBAC:              rbacStore,
		OfficialPause:     officialPauseStore,
	}
	hub.SetMoveHandler(api.ApplyMoveCore)
	hub.SetClockFlagHandler(api.ClaimClockFlagCore)
	api.StartMatchClockSweeper()
	hub.SetSpectateAuthz(api.CanSpectateHostedEventGame)
	hub.SetFlagsSnapshot(func() map[string]any {
		f := flags.Get(context.Background())
		return map[string]any{
			"vs_ai_enabled":                f.VSAIEnabled,
			"otp_required":                 f.OTPRequired,
			"cash_rmg_enabled":             f.CashRmgEnabled,
			"cash_phone_kyc_required":      f.CashPhoneKycRequired,
			"cash_phone_otp_required":      f.CashPhoneOtpRequired,
			"cash_rmg_disabled_countries":  f.CashRmgDisabledCountries,
			"hosted_events_enabled":        f.HostedEventsEnabled,
			"public_events_enabled":        f.PublicEventsEnabled,
			"public_event_matches_rated":   f.PublicEventMatchesRated,
			"prize_pool_display_enabled":   f.PrizePoolDisplayEnabled,
			"prize_pool_guarantee_enabled": f.PrizePoolGuaranteeEnabled,
			"kyc_auto_approve":             f.KycAutoApprove,
			"ai_depths":                    f.AIDepths,
		}
	})
	legal := store.NewLegalStore(handle)
	legalAPI := &rest.LegalAPI{Legal: legal, Settings: settings}
	mediaAPI := &rest.MediaAPI{Users: users, Avatars: avatars, Settings: settings, UploadDir: cfg.UploadDir, DB: handle, Hub: hub}
	mmAPI := &rest.MatchmakingAPI{Queue: queue, Users: users}
	inviteSvc := invites.New(redisClient, hub, queue, users, settings, handle)
	inviteAPI := &rest.InviteAPI{Invites: inviteSvc, Settings: settings}
	notifAPI := &rest.NotificationsAPI{DB: handle, Settings: settings}
	hub.SetInviteHandler(func(ctx context.Context, userID, inviteID, action string) (map[string]any, error) {
		// Same OTP gate as REST invite accept / WSS moves (fail-closed when otp_required).
		if err := rest.EnsureOTPVerified(ctx, flags, redisClient, userID); err != nil {
			return nil, err
		}
		switch action {
		case "accept":
			inv, ready, err := inviteSvc.Accept(ctx, inviteID, userID)
			if err != nil {
				return nil, err
			}
			return map[string]any{
				"type":      "invite_accepted",
				"invite_id": inv.ID,
				"game_id":   ready.GameID,
			}, nil
		case "decline":
			inv, err := inviteSvc.Decline(ctx, inviteID, userID)
			if err != nil {
				return nil, err
			}
			return map[string]any{"type": "invite_declined", "invite_id": inv.ID}, nil
		case "cancel":
			inv, err := inviteSvc.Cancel(ctx, inviteID, userID)
			if err != nil {
				return nil, err
			}
			return map[string]any{"type": "invite_cancelled", "invite_id": inv.ID}, nil
		default:
			return nil, fmt.Errorf("unknown invite action")
		}
	})
	payouts := store.NewPayoutStore(handle)
	kycDocs := store.NewKycDocumentStore(handle)
	cashRmg := store.NewCashRmgStore(handle, settings, flags)
	api.Cash = cashRmg
	mediaAPI.Cash = cashRmg
	mmAPI.Cash = cashRmg
	inviteSvc.Cash = cashRmg
	authAPI := &rest.AuthAPI{
		Users:             users,
		Tokens:            tokens,
		Revoked:           revoked,
		Settings:          settings,
		Cash:              cashRmg,
		DB:                handle,
		Geo:               geoResolver,
		SupabaseURL:       cfg.SupabaseURL,
		SupabaseJWTSecret: cfg.SupabaseJWTSecret,
	}
	payAPI := &rest.PaymentsAPI{Payments: paySvc, Users: users, Settings: settings, Cash: cashRmg, Locate: geoResolver, Avatars: avatars, DB: handle}
	telegramBotAPI := &rest.TelegramBotAPI{
		Payments: paySvc, Payouts: payouts, Users: users, Settings: settings, Cash: cashRmg, DB: handle,
	}
	emailPolicyAPI := &rest.EmailPolicyAPI{DB: handle}
	payoutAPI := &rest.PayoutAPI{Payouts: payouts, Payments: paySvc, Cash: cashRmg, Docs: kycDocs, Users: users, Settings: settings, Flags: flags, Locate: geoResolver, DB: handle}
	cashAPI := &rest.CashRmgAPI{Cash: cashRmg, Users: users, OTP: otpStore, Flags: flags, Settings: settings, Locate: geoResolver, Docs: kycDocs}
	kycAPI := &rest.KycAPI{Cash: cashRmg, Docs: kycDocs, Avatars: avatars, Settings: settings, Flags: flags, DB: handle, Users: users}
	ytAPI := &rest.YouTubeAPI{Pool: ytPool, Worker: ytWorker, Settings: settings}
	adsAPI := &rest.AdsAPI{Ads: ads, YT: ytPool, Worker: ytWorker, Geo: adGeo, Locate: geoResolver, Settings: settings, Audit: audit, Avatars: avatars, Payments: paySvc, Cash: cashRmg, Users: users, DB: handle}
	go rest.RunCampaignAutoCloseWorker(workerCtx, adsAPI)
	rbacAPI := &rest.RBACAPI{RBAC: rbacStore, Users: users, Settings: settings, Audit: audit}
	invoiceAPI := &rest.InvoiceAPI{Ads: ads, Settings: settings, Locate: geoResolver}
	tourAPI := &rest.TournamentAPI{
		Tournaments: tournaments, Entries: entries, Payments: paySvc, Settings: settings, Flags: flags,
		Avatars: avatars, Cash: cashRmg, Users: users, Locate: geoResolver, Games: gameStore,
		OfficialPause: officialPauseStore, Hub: hub, DB: handle,
		CompetitionPrizes: competitionPrizes,
	}
	competitionPrizesAPI := &rest.CompetitionPrizesAPI{
		Prizes: competitionPrizes, Payments: paySvc, Settings: settings, DB: handle,
		TourAPI: tourAPI,
	}
	eventsAPI := &rest.HostedEventsAPI{
		OfficialPause:     officialPauseStore,
		Events:            hostedEvents,
		Payments:          paySvc,
		Settings:          settings,
		Flags:             flags,
		Users:             users,
		Cash:              cashRmg,
		Docs:              kycDocs,
		Games:             gameStore,
		Avatars:           avatars,
		Hub:               hub,
		DB:                handle,
		Locate:            geoResolver,
		CompetitionPrizes: competitionPrizes,
	}
	competitionPrizesAPI.EventsAPI = eventsAPI
	go rest.RunCompetitionPrizeSettleWorker(workerCtx, competitionPrizesAPI)
	go rest.RunCompetitionReadyTimeoutWorker(workerCtx, &rest.CompetitionReadyTimeoutAPI{
		Settings:    settings,
		Tournaments: tournaments,
		Events:      hostedEvents,
		TourAPI:     tourAPI,
		EventsAPI:   eventsAPI,
	})
	go rest.RunCompetitionArenaWorker(workerCtx, &rest.CompetitionArenaAPI{
		Settings:    settings,
		Tournaments: tournaments,
		Events:      hostedEvents,
		TourAPI:     tourAPI,
		EventsAPI:   eventsAPI,
	})
	adminAPI := &rest.AdminAPI{Users: users, Banks: banks, Payouts: payouts, Audit: audit, Settings: settings, Fingerprints: fingerprints, GeoIP: geoIPStore, Disabled: disabled, Cash: cashRmg, Events: hostedEvents, DB: handle, Hub: hub}
	activityStore := store.NewActivityStore(handle)
	activityAPI := &rest.ActivityAPI{Activity: activityStore, Presence: presenceSvc, Games: gameStore, Settings: settings}
	friendsStore := store.NewFriendsStore(handle)
	gameChatStore := store.NewGameChatStore(handle)
	dmStore := store.NewDMStore(handle)
	histAPI := &rest.HistoryAPI{Matches: matches, Users: users, Settings: settings, Presence: presenceSvc, Entries: entries, Games: gameStore, Friends: friendsStore, Cash: cashRmg, Events: hostedEvents}
	voteStore := store.NewVoteStore(handle)
	voteAPI := &rest.VoteAPI{
		Votes: voteStore, Users: users, Games: gameStore, Matches: matches, Hub: hub, Settings: settings,
		Cash: cashRmg, CanSpectate: api.CanSpectateHostedEventGame,
	}
	qrAPI := &rest.GameQRAPI{
		Games:       gameStore,
		Matches:     matches,
		Settings:    settings,
		CanSpectate: api.CanSpectateHostedEventGame,
	}
	friendsAPI := &rest.FriendsAPI{Friends: friendsStore, Users: users, Settings: settings, Presence: presenceSvc, Games: gameStore, Cash: cashRmg, DB: handle}
	gameChatAPI := &rest.GameChatAPI{
		Chat: gameChatStore, Games: gameStore, Users: users, Media: avatars, Hub: hub, Settings: settings,
		CanSpectate: api.CanSpectateHostedEventGame,
	}
	dmAPI := &rest.DMAPI{DMs: dmStore, Users: users, Settings: settings, Presence: presenceSvc, Media: avatars, Hub: hub, Cash: cashRmg, DB: handle}
	progAPI := &rest.ProgressionAPI{Settings: settings}
	rulesAPI := &rest.GameRulesAPI{Settings: settings}
	geoAPI := &rest.GeoAPI{Geo: geoResolver, Payments: paySvc, Presence: presenceSvc, Users: users, Settings: settings, DB: handle, Activity: activityAPI}
	otpAPI := &rest.OTPAPI{OTP: otpStore, Flags: flags, Users: users, Redis: redisClient, Settings: settings}
	fpAPI := &rest.FingerprintAPI{Fingerprints: fingerprints, Settings: settings}
	authMW := auth.Middleware{Tokens: tokens, Revoked: revoked, Disabled: disabled}
	otpGate := rest.RequireOTPWhenEnabled(flags, redisClient, settings)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestLogger)
	// CORS must wrap rate-limit / auth errors so browsers see ACAO on 429/401
	// (otherwise Failed to fetch hides the real status and storms retries).
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: cfg.CORSOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		// Receipt PDF downloads: filename headers must be readable cross-origin
		// (Trim exposes X-Trim-Download-Filename + Content-Disposition for the same reason).
		ExposedHeaders: []string{
			"Content-Disposition",
			"Content-Type",
			"X-Dama-Download-Filename",
		},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(rateLimit.Handler)
	r.Use(authMW.Handler)

	r.Get("/healthz", rest.Healthz)
	r.Get("/readyz", api.Readyz)

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/oauth/supabase", authAPI.ExchangeSupabaseOAuth)
		r.Get("/public/auth-providers", authAPI.ListAuthProviders)
		r.Get("/public/wallet-chrome", payAPI.WalletChrome)
		r.Get("/public/play-chrome", payAPI.PlayChrome)
		r.Get("/public/official-pause-chrome", payAPI.OfficialPauseChrome)
		r.Get("/public/play-rail-chrome", payAPI.PlayRailChrome)
		r.Get("/public/chat-emoji-catalog", payAPI.ChatEmojiCatalog)
		r.Get("/public/country-flag-chrome", payAPI.CountryFlagChrome)
		r.Get("/public/matchmaking-chrome", payAPI.MatchmakingChrome)
		r.Get("/public/tournament-chrome", payAPI.TournamentChrome)
		r.Get("/public/admin-console-chrome", payAPI.AdminConsoleChrome)
		r.Get("/public/profile-inspect-chrome", payAPI.ProfileInspectChrome)
		r.Get("/public/avatar-chrome", payAPI.AvatarChrome)
		r.Get("/public/media-upload-chrome", payAPI.MediaUploadChrome)
		r.Get("/public/spectate-chrome", payAPI.SpectateChrome)
		r.Get("/public/leaderboard-chrome", payAPI.LeaderboardChrome)
		r.Get("/public/tournaments-player-chrome", payAPI.TournamentsPlayerChrome)
		r.Get("/public/events-organizer-chrome", payAPI.EventsOrganizerChrome)
		r.Get("/public/events-player-chrome", payAPI.EventsPlayerChrome)
		r.Get("/public/events-admin-chrome", payAPI.EventsAdminChrome)
		r.Get("/public/home-chrome", payAPI.HomeSurfaceChrome)
		r.Get("/public/app-shell-chrome", payAPI.AppShellChrome)
		r.Get("/public/platform-stats-chrome", payAPI.PlatformStatsChrome)
		r.Get("/public/platform-stats", activityAPI.PublicPlatformStats)
		r.Post("/public/platform-stats/visit", activityAPI.PublicPlatformVisit)
		r.Get("/public/payment-modal-chrome", payAPI.PaymentModalChrome)
		r.Get("/public/otp-chrome", payAPI.OTPChrome)
		r.Get("/public/theme-chrome", payAPI.ThemeChrome)
		r.Get("/public/legal-chrome", payAPI.LegalChrome)
		r.Get("/public/store-compliance-chrome", payAPI.StoreComplianceChrome)
		r.Get("/public/cash-rmg-chrome", cashAPI.PublicChrome)
		r.Get("/public/legal/{kind}", legalAPI.LegalDoc)
		r.Get("/public/email-policy", emailPolicyAPI.Check)
		r.Post("/auth/guest", authAPI.GuestSession)
		r.Post("/auth/e2e/session", authAPI.E2ESession)
		r.With(auth.RequireAuth).Get("/auth/me", authAPI.Me)
		r.With(auth.RequireAuth).Post("/auth/logout", authAPI.Logout)
		r.With(auth.RequireAuth).Delete("/me/account", authAPI.DeleteAccount)
		r.With(auth.RequireAuth).Get("/me/data-export", authAPI.DataExport)
		r.With(auth.RequireAuth).Get("/me/notifications", notifAPI.ListMine)
		r.With(auth.RequireAuth).Get("/me/notifications/unread-count", notifAPI.UnreadMine)
		r.With(auth.RequireAuth).Post("/me/notifications/read-all", notifAPI.MarkAllReadMine)
		r.With(auth.RequireAuth).Post("/me/notifications/{id}/read", notifAPI.MarkReadMine)
		r.With(auth.RequireAuth).Get("/me/cash-eligibility", cashAPI.Eligibility)
		r.With(auth.RequireAuth).Put("/me/age-gate", cashAPI.SubmitAgeGate)
		r.With(auth.RequireAuth).Put("/me/phone-kyc", cashAPI.SavePhone)
		r.With(auth.RequireAuth).Post("/me/phone-kyc/otp/start", cashAPI.StartPhoneOTP)
		r.With(auth.RequireAuth).Post("/me/phone-kyc/otp/verify", cashAPI.VerifyPhoneOTP)

		r.Get("/feature-flags", api.FeatureFlags)
		r.Get("/progression", progAPI.Public)
		r.Get("/platform/enums", adminAPI.ListClientEnums)
		r.Get("/platform/console-nav", adminAPI.ListConsoleNav)
		r.Get("/platform/client-nav", adminAPI.ListClientNav)
		r.Get("/platform/feature-flag-catalog", adminAPI.ListFeatureFlagCatalog)
		r.Get("/game/rules", rulesAPI.Public)
		r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "feature_flags.write")).Post("/feature-flags", api.SetFeatureFlag)

		r.With(auth.RequireAuth).Post("/avatars/upload", mediaAPI.UploadAvatar)
		r.Get("/media/*", mediaAPI.ServeLocal)

		r.Get("/leaderboard", histAPI.Leaderboard)
		r.Get("/players", histAPI.ListPlayers)
		r.Get("/players/{id}/matches", histAPI.PublicPlayerMatches)
		r.Get("/players/{id}/placements", histAPI.PublicPlayerPlacements)
		r.Get("/players/{id}", histAPI.PublicPlayer)
		r.With(auth.RequireAuth).Get("/matches/me", histAPI.MyMatches)
		r.Route("/friends", func(r chi.Router) {
			r.With(auth.RequireAuth).Get("/", friendsAPI.List)
			r.With(auth.RequireAuth).Get("/requests", friendsAPI.ListRequests)
			r.With(auth.RequireAuth).Post("/requests/{id}/accept", friendsAPI.AcceptRequest)
			r.With(auth.RequireAuth).Post("/requests/{id}/deny", friendsAPI.DenyRequest)
			r.With(auth.RequireAuth).Delete("/requests/{id}", friendsAPI.CancelRequest)
			r.With(auth.RequireAuth).Post("/{id}", friendsAPI.Add)
			r.With(auth.RequireAuth).Delete("/{id}", friendsAPI.Remove)
		})

		r.Post("/geo/locate", geoAPI.Locate)
		r.Get("/presence", geoAPI.OnlineStatus)
		r.With(auth.RequireAuth).Post("/presence/heartbeat", geoAPI.Heartbeat)

		r.With(auth.RequireAuth).Post("/auth/otp/start", otpAPI.Start)
		r.With(auth.RequireAuth).Post("/auth/otp/verify", otpAPI.Verify)

		r.With(auth.RequireAuth).Post("/devices/fingerprint", fpAPI.Upsert)
		r.With(auth.RequireAuth).Get("/devices/fingerprint", fpAPI.ListMine)

		r.Route("/matchmaking", func(r chi.Router) {
			r.With(auth.RequireAuth).Get("/status", mmAPI.Status)
			r.With(auth.RequireAuth, otpGate).Post("/join", mmAPI.Join)
			r.With(auth.RequireAuth).Post("/leave", mmAPI.Leave)
		})

		r.Route("/invites", func(r chi.Router) {
			r.With(auth.RequireAuth, otpGate).Post("/", inviteAPI.Create)
			r.With(auth.RequireAuth).Get("/pending", inviteAPI.ListPending)
			r.With(auth.RequireAuth, otpGate).Post("/token/{token}/accept", inviteAPI.AcceptByToken)
			r.With(auth.RequireAuth).Get("/{id}", inviteAPI.Get)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/accept", inviteAPI.Accept)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/decline", inviteAPI.Decline)
		})

		r.Route("/games", func(r chi.Router) {
			r.Get("/live", api.ListLiveGames)
			r.Get("/{id}/spectators", api.ListGameSpectators)
			r.With(auth.RequireAuth, otpGate).Post("/start", api.StartGame)
			r.Get("/{id}/state", api.GetGameState)
			r.Get("/{id}/qr.png", qrAPI.GetQRPNG)
			r.Get("/{id}/join-url", qrAPI.GetJoinURL)
			r.Get("/{id}/votes", voteAPI.GetVotes)
			r.With(auth.RequireAuth).Post("/{id}/votes", voteAPI.CastVote)
			r.Get("/{id}/votes/correct", voteAPI.CorrectVoters)
			r.With(auth.RequireAuth).Get("/{id}/chat", gameChatAPI.List)
			r.With(auth.RequireAuth).Post("/{id}/chat", gameChatAPI.Post)
			r.With(auth.RequireAuth).Patch("/{id}/chat", gameChatAPI.Toggle)
			r.With(auth.RequireAuth).Post("/{id}/chat/image", gameChatAPI.UploadImage)
			r.With(auth.RequireAuth).Post("/{id}/chat/messages/{messageId}/reactions", gameChatAPI.React)
			r.With(auth.RequireAuth).Post("/{id}/chat/read", gameChatAPI.MarkRead)
			// REST move kept for tooling; primary client ingress is raw WSS type:move.
			r.With(auth.RequireAuth, otpGate).Post("/{id}/move", api.ApplyMove)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/abandon", api.AbandonGame)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/pause", api.PauseGame)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/resume", api.ResumeGame)
			r.With(auth.RequireAuth, otpGate, officialPauseRateLimit.HandlerScopedBody("official_pause", officialPauseRateLimitBody(settings))).Post("/official-pause/bulk", api.BulkOfficialPauseRound)
			r.With(auth.RequireAuth, otpGate, officialPauseRateLimit.HandlerScopedBody("official_pause", officialPauseRateLimitBody(settings))).Post("/official-resume/bulk", api.BulkOfficialResume)
			r.With(auth.RequireAuth, otpGate, officialPauseRateLimit.HandlerScopedBody("official_pause", officialPauseRateLimitBody(settings))).Post("/{id}/official-pause", api.OfficialPauseGame)
			r.With(auth.RequireAuth, otpGate, officialPauseRateLimit.HandlerScopedBody("official_pause", officialPauseRateLimitBody(settings))).Post("/{id}/official-resume", api.OfficialResumeGame)
			r.With(auth.RequireAuth, otpGate, officialPauseRateLimit.HandlerScopedBody("official_pause", officialPauseRateLimitBody(settings))).Post("/{id}/official-pause-meta", api.OfficialPauseMetaGame)
			r.With(auth.RequireAuth).Get("/{id}/official-pause-events", api.ListOfficialPauseEvents)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/clock-flag", api.ClaimClockFlag)
			// Lab-only flag-fall / clock_draw helpers (404 unless DAMA_ALLOW_E2E_AUTH=1).
			r.With(auth.RequireAuth, otpGate).Post("/{id}/e2e/expire-clock", api.E2EExpireActiveClock)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/e2e/bare-kings", api.E2EBareKingsBoard)
			r.With(auth.RequireAuth, otpGate).Get("/{id}/e2e/peek-clock", api.E2EPeekClock)
		})

		r.Route("/dms", func(r chi.Router) {
			r.With(auth.RequireAuth).Get("/requests", dmAPI.ListRequests)
			r.With(auth.RequireAuth).Get("/requests/{id}", dmAPI.GetRequest)
			r.With(auth.RequireAuth).Post("/requests/{id}/accept", dmAPI.Accept)
			r.With(auth.RequireAuth).Post("/requests/{id}/deny", dmAPI.Deny)
			r.With(auth.RequireAuth).Delete("/requests/{id}", dmAPI.Cancel)
			r.With(auth.RequireAuth).Post("/messages", dmAPI.Send)
			r.With(auth.RequireAuth).Get("/threads/{id}/messages", dmAPI.ListMessages)
			r.With(auth.RequireAuth).Post("/threads/{id}/messages/{messageId}/reactions", dmAPI.React)
			r.With(auth.RequireAuth).Post("/threads/{id}/read", dmAPI.MarkRead)
			r.With(auth.RequireAuth).Post("/image", dmAPI.UploadImage)
		})

		r.Route("/payments", func(r chi.Router) {
			r.Get("/route", payAPI.RoutePreview)
			r.Get("/currency", payAPI.CurrencyConfig)
			r.Get("/banks", payAPI.Banks)
			r.With(auth.RequireAuth).Get("/wallet", payAPI.Wallet)
			r.With(auth.RequireAuth, otpGate).Post("/checkout", payAPI.Checkout)
			r.With(auth.RequireAuth, otpGate).Post("/receipts/upload", payAPI.UploadReceipt)
			r.With(auth.RequireAuth, otpGate).Post("/receipts", payAPI.SubmitReceipt)
			r.With(auth.RequireAuth).Get("/receipts/mine", payAPI.ListMyReceipts)
			r.With(auth.RequireAuth).Get("/receipts/{id}/pdf", payAPI.DownloadMyReceiptPDF)
			r.With(auth.RequireAuth).Get("/receipts/{id}", payAPI.GetMyReceipt)
			r.With(auth.RequireAuth).Get("/transactions", payAPI.ListMyTransactions)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "payments.review")).Get("/receipts", payAPI.ListReceipts)
			// Distinct console paths (Trim admin /billing/receipts/{id}[+ /pdf] parity) - must not share
			// /receipts/{id} with the owner-only routes or chi would always hit the owner handlers.
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "payments.review")).Get("/console/receipts/{id}/pdf", payAPI.DownloadConsoleReceiptPDF)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "payments.review")).Get("/console/receipts/{id}", payAPI.GetConsoleReceipt)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "payments.review")).Post("/receipts/{id}/review", payAPI.ReviewReceipt)
			// Vendor-neutral webhook paths only (configure gateways to these URLs).
			r.Post("/local/webhook", payAPI.LocalWebhook)
			r.Post("/international/webhook", payAPI.InternationalWebhook)
			// Register stub completion only when explicitly enabled (never advertise the path in production).
			if os.Getenv("DAMA_ALLOW_PAYMENT_STUB") == "1" {
				r.Get("/dev/payment-complete", payAPI.StubComplete)
			}
		})

		r.Route("/payouts", func(r chi.Router) {
			r.With(auth.RequireAuth).Get("/method", payoutAPI.GetMethod)
			r.With(auth.RequireAuth).Put("/method", payoutAPI.UpsertMethod)
			r.With(auth.RequireAuth).Get("/methods", payoutAPI.ListMethods)
			r.With(auth.RequireAuth).Post("/methods", payoutAPI.CreateMethod)
			r.With(auth.RequireAuth).Patch("/methods/{id}", payoutAPI.UpdateMethod)
			r.With(auth.RequireAuth).Delete("/methods/{id}", payoutAPI.DeleteMethod)
			r.With(auth.RequireAuth).Get("/mine", payoutAPI.ListMine)
			r.With(auth.RequireAuth, otpGate).Post("/request", payoutAPI.CreateRequest)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "payments.review")).Get("/console", payoutAPI.ListConsole)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "payments.review")).Post("/console/{id}/review", payoutAPI.ReviewConsole)
		})

		// Shared telegram_bot adapter (X-Bot-Key). Never shares BACKEND_API_URL with other products.
		r.Route("/telegram-bot/admin/dama", func(r chi.Router) {
			r.Get("/chrome", telegramBotAPI.GetChrome)
			r.Get("/receipts/pending", telegramBotAPI.ListPendingReceipts)
			r.Get("/receipts/{id}", telegramBotAPI.GetReceipt)
			r.Post("/receipts/{id}/approve", telegramBotAPI.ApproveReceipt)
			r.Post("/receipts/{id}/reject", telegramBotAPI.RejectReceipt)
			r.Get("/payouts/pending", telegramBotAPI.ListPendingPayouts)
			r.Get("/payouts/{id}", telegramBotAPI.GetPayout)
			r.Post("/payouts/{id}/approve", telegramBotAPI.ApprovePayout)
			r.Post("/payouts/{id}/reject", telegramBotAPI.RejectPayout)
			r.Post("/payouts/{id}/paid", telegramBotAPI.MarkPayoutPaid)
		})

		r.Route("/kyc/documents", func(r chi.Router) {
			r.With(auth.RequireAuth).Get("/me", kycAPI.Mine)
			r.With(auth.RequireAuth).Post("/upload", kycAPI.Upload)
			r.With(auth.RequireAuth).Put("/draft", kycAPI.SaveDraft)
			r.With(auth.RequireAuth).Post("/submit", kycAPI.Submit)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "payments.review")).Get("/console", kycAPI.ListConsole)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "payments.review")).Post("/console/{id}/review", kycAPI.ReviewConsole)
		})
		r.Post("/webhooks/local", payAPI.LocalWebhook)
		r.Post("/webhooks/international", payAPI.InternationalWebhook)

		r.Route("/media/pool", func(r chi.Router) {
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "media_pool.write")).Get("/channels", ytAPI.ListChannels)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "media_pool.write")).Post("/channels", ytAPI.RegisterChannel)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "media_pool.write")).Patch("/channels/{id}", ytAPI.SetActive)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "media_pool.write")).Put("/channels/{id}", ytAPI.UpdateChannel)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "media_pool.write")).Delete("/channels/{id}", ytAPI.DeleteChannel)
			r.With(auth.RequireRoleChecker(consoleGate), auth.RequirePermission(rbacStore, "media_pool.write")).Post("/channels/{id}/test", ytAPI.TestChannel)
			r.With(auth.RequireRoleChecker(mediaUploadGate)).Post("/upload", ytAPI.Upload)
			r.With(auth.RequireRoleChecker(mediaUploadGate)).Post("/upload-file", ytAPI.UploadMultipart)
		})

		r.Route("/ads", func(r chi.Router) {
			r.Get("/serve", adsAPI.Serve)
			r.Get("/playback", adsAPI.Playback)
			r.Get("/pricing", adsAPI.Pricing)
			r.Post("/in-match/eligibility", adsAPI.InMatchEligibility)
			r.Post("/campaigns/{id}/impression", adsAPI.Impression)
			r.Post("/campaigns/{id}/click", adsAPI.Click)
			r.With(auth.RequireAuth).Get("/campaigns", adsAPI.List)
			r.With(auth.RequireAuth).Post("/campaigns", adsAPI.Create)
			r.With(auth.RequireAuth).Get("/campaigns/{id}", adsAPI.Get)
			r.With(auth.RequireAuth).Patch("/campaigns/{id}/status", adsAPI.SetStatus)
			r.With(auth.RequireAuth).Patch("/campaigns/{id}/title", adsAPI.UpdateTitle)
			r.With(auth.RequireAuth).Delete("/campaigns/{id}", adsAPI.Delete)
			r.With(auth.RequireAuth).Post("/campaigns/{id}/close", adsAPI.Close)
			r.With(auth.RequireAuth).Post("/campaigns/{id}/reopen", adsAPI.Reopen)
			r.With(auth.RequireAuth).Patch("/campaigns/{id}/creative", adsAPI.ReplaceCreative)
			r.With(auth.RequireAuth).Post("/campaigns/{id}/thumbnail", adsAPI.UploadThumbnail)
			r.With(auth.RequireAuth).Delete("/campaigns/{id}/thumbnail", adsAPI.ClearThumbnail)
			r.With(auth.RequireAuth).Post("/campaigns/{id}/gallery", adsAPI.UploadGalleryImage)
			r.With(auth.RequireAuth).Delete("/campaigns/{id}/gallery/{index}", adsAPI.RemoveGalleryImage)
			r.With(auth.RequireAuth).Post("/campaigns/{id}/creatives/{slot}", adsAPI.UploadViewportCreative)
			r.With(auth.RequireAuth).Delete("/campaigns/{id}/creatives/{slot}", adsAPI.ClearViewportCreative)
			r.With(auth.RequireAuth).Post("/campaigns/{id}/creatives/{slot}/video", adsAPI.AttachViewportVideoUpload)
			r.With(auth.RequireAuth).Delete("/campaigns/{id}/creatives/{slot}/video", adsAPI.ClearViewportVideo)
			r.With(auth.RequireAuth).Delete("/campaigns/{id}/video", adsAPI.ClearLegacyVideo)
			r.With(auth.RequireAuth).Patch("/campaigns/{id}/schedule", adsAPI.PublisherSetSchedule)
			r.With(auth.RequireAuth).Post("/campaigns/{id}/upload-job", adsAPI.AttachYouTubeUpload)
			r.With(auth.RequireAuth).Get("/invoices/pdf", invoiceAPI.PublisherPDF)
			r.Post("/campaigns/{id}/video-complete", adsAPI.VideoComplete)
		})

		r.Route("/tournaments", func(r chi.Router) {
			r.Get("/", tourAPI.List)
			r.Get("/{id}", tourAPI.Get)
			r.Get("/{id}/bracket", tourAPI.GetBracket)
			r.Get("/{id}/standings", tourAPI.GetStandings)
			r.Get("/{id}/entries", tourAPI.ListEntries)
			r.With(auth.RequireAuth).Post("/{id}/check-in", tourAPI.CheckIn)
			r.With(auth.RequireAuth).Post("/{id}/bracket/{matchId}/ready", tourAPI.MarkMatchReady)
			r.With(auth.RequireAuth).Post("/{id}/bracket/{matchId}/start-game", tourAPI.StartMatchGame)
			r.With(auth.RequireAuth).Post("/{id}/arena/queue", tourAPI.ArenaJoinQueue)
			r.With(auth.RequireAuth).Post("/{id}/arena/queue/leave", tourAPI.ArenaLeaveQueue)
			r.With(auth.RequireAuth).Get("/{id}/arena/standings", tourAPI.ArenaStandings)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/enroll", tourAPI.Enroll)
			r.With(auth.RequireAuth).Post("/{id}/report", tourAPI.Report)
		})

		r.Route("/events", func(r chi.Router) {
			r.Get("/catalog", eventsAPI.PublicCatalog)
			r.Get("/public", eventsAPI.ListPublic)
			r.With(auth.RequireAuth).Get("/", eventsAPI.ListMine)
			r.With(auth.RequireAuth).Get("/dashboard", eventsAPI.Dashboard)
			r.With(auth.RequireAuth).Get("/analytics", eventsAPI.Analytics)
			r.With(auth.RequireAuth).Get("/entry-fee-quote", eventsAPI.EntryFeeQuote)
			r.With(auth.RequireAuth).Get("/joined", eventsAPI.ListJoined)
			r.With(auth.RequireAuth, otpGate).Post("/", eventsAPI.Create)
			r.Get("/by-code/{code}", eventsAPI.GetByCode)
			r.With(auth.RequireAuth, otpGate).Post("/join", eventsAPI.Join)
			r.Get("/{id}", eventsAPI.Get)
			r.With(auth.RequireAuth).Patch("/{id}", eventsAPI.Patch)
			r.With(auth.RequireAuth).Post("/{id}/logo", eventsAPI.UploadLogo)
			r.With(auth.RequireAuth).Post("/{id}/sponsor-logo", eventsAPI.UploadSponsorLogo)
			r.With(auth.RequireAuth).Post("/{id}/prize-image", eventsAPI.UploadPrizeImage)
			r.With(auth.RequireAuth).Delete("/{id}/prize-image", eventsAPI.ClearPrizeImage)
			r.With(auth.RequireAuth).Post("/{id}/gallery", eventsAPI.UploadGalleryImage)
			r.With(auth.RequireAuth).Delete("/{id}/gallery/{index}", eventsAPI.RemoveGalleryImage)
			r.With(auth.RequireAuth).Post("/{id}/report", eventsAPI.Report)
			r.Get("/{id}/share", eventsAPI.Share)
			r.Get("/{id}/qr.png", eventsAPI.GetQRPNG)
			r.Get("/{id}/entries", eventsAPI.ListEntries)
			r.With(auth.RequireAuth).Get("/{id}/live-boards", eventsAPI.ListLiveBoards)
			r.Get("/{id}/bracket", eventsAPI.GetBracket)
			r.Get("/{id}/standings", eventsAPI.GetStandings)
			r.With(auth.RequireAuth).Post("/{id}/check-in", eventsAPI.CheckIn)
			r.With(auth.RequireAuth).Post("/{id}/bracket/{matchId}/ready", eventsAPI.MarkMatchReady)
			r.With(auth.RequireAuth).Post("/{id}/entries/{userId}/approve", eventsAPI.ApproveEntry)
			r.With(auth.RequireAuth).Post("/{id}/entries/{userId}/reject", eventsAPI.RejectEntry)
			r.With(auth.RequireAuth).Post("/{id}/entries/{userId}/kick", eventsAPI.KickEntry)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/start", eventsAPI.Start)
			// Seat recovery start-game matches tournaments (no OTP); organizer Start still OTP-gated above.
			r.With(auth.RequireAuth).Post("/{id}/bracket/{matchId}/start-game", eventsAPI.StartGame)
			r.With(auth.RequireAuth).Post("/{id}/bracket/{matchId}/forfeit", eventsAPI.ForfeitMatch)
			r.With(auth.RequireAuth).Post("/{id}/bracket/{matchId}/rematch", eventsAPI.RematchMatch)
			r.With(auth.RequireAuth).Post("/{id}/arena/queue", eventsAPI.ArenaJoinQueue)
			r.With(auth.RequireAuth).Post("/{id}/arena/queue/leave", eventsAPI.ArenaLeaveQueue)
			r.With(auth.RequireAuth).Get("/{id}/arena/standings", eventsAPI.ArenaStandings)
			r.With(auth.RequireAuth, otpGate).Post("/{id}/arena/finish", eventsAPI.OrganizerFinishArena)
			r.With(auth.RequireAuth).Post("/{id}/cancel", eventsAPI.Cancel)
			r.With(auth.RequireAuth).Post("/{id}/close", eventsAPI.Close)
			r.With(auth.RequireAuth).Post("/{id}/reopen", eventsAPI.Reopen)
		})

		r.Route("/console", func(r chi.Router) {
			r.Use(auth.RequireRoleChecker(consoleGate))
			r.Get("/nav", adminAPI.ListConsoleNav)
			r.Get("/me/permissions", rbacAPI.MyPermissions)
			r.Get("/notifications", notifAPI.ListConsole)
			r.Get("/notifications/unread-count", notifAPI.UnreadConsole)
			r.Post("/notifications/read-all", notifAPI.MarkAllReadConsole)
			r.Post("/notifications/{id}/read", notifAPI.MarkReadConsole)

			r.With(auth.RequirePermission(rbacStore, "payments.review")).Get("/transactions", payAPI.ListConsoleTransactions)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Get("/financial-overview", payAPI.ConsoleFinancialOverview)
			r.With(auth.RequireAnyPermission(rbacStore, "payments.review", "tournaments.write")).Post("/competitions/settle-prizes", competitionPrizesAPI.ConsoleSettleDue)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Get("/competition/arena-settings", adminAPI.GetCompetitionArenaSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Put("/competition/arena-settings", adminAPI.PutCompetitionArenaSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Get("/competition/standings-settings", adminAPI.GetCompetitionStandingsSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Put("/competition/standings-settings", adminAPI.PutCompetitionStandingsSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Get("/competition/payout-defaults-settings", adminAPI.GetCompetitionPayoutDefaultsSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Put("/competition/payout-defaults-settings", adminAPI.PutCompetitionPayoutDefaultsSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Get("/competition/prize-settle-settings", adminAPI.GetCompetitionPrizeSettleSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Put("/competition/prize-settle-settings", adminAPI.PutCompetitionPrizeSettleSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Get("/competition/points-toast-settings", adminAPI.GetCompetitionPointsToastSettings)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Put("/competition/points-toast-settings", adminAPI.PutCompetitionPointsToastSettings)
			r.With(auth.RequirePermission(rbacStore, "games.official_pause")).Get("/official-pause/live", api.ConsoleListOfficialPauseLive)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Get("/tournaments", tourAPI.ConsoleList)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Put("/tournaments/{id}", tourAPI.Update)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Delete("/tournaments/{id}", tourAPI.Delete)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Patch("/tournaments/{id}/status", tourAPI.SetStatus)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Post("/tournaments/{id}/prize-image", tourAPI.UploadPrizeImage)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Delete("/tournaments/{id}/prize-image", tourAPI.ClearPrizeImage)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Post("/tournaments/{id}/gallery", tourAPI.UploadGalleryImage)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Delete("/tournaments/{id}/gallery/{index}", tourAPI.RemoveGalleryImage)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Get("/tournaments/{id}/entries", tourAPI.ConsoleListEntries)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Post("/tournaments/{id}/start", tourAPI.ConsoleStart)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Post("/tournaments/{id}/arena/finish", tourAPI.ConsoleFinishArena)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Post("/tournaments/{id}/bracket/{matchId}/start-game", tourAPI.ConsoleStartMatchGame)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Post("/tournaments/{id}/bracket/{matchId}/forfeit", tourAPI.ConsoleForfeitMatch)
			r.With(auth.RequirePermission(rbacStore, "tournaments.write")).Post("/tournaments/{id}/bracket/{matchId}/rematch", tourAPI.ConsoleRematchMatch)
			r.With(auth.RequireAnyPermission(rbacStore, "payments.review", "tournaments.write")).Get("/tournaments/reports", tourAPI.ConsoleListReports)
			r.With(auth.RequireAnyPermission(rbacStore, "payments.review", "tournaments.write")).Patch("/tournaments/reports/{id}/dismiss", tourAPI.ConsoleDismissReport)
			r.With(auth.RequireAnyPermission(rbacStore, "payments.review", "tournaments.write")).Patch("/tournaments/reports/{id}/resolve", tourAPI.ConsoleResolveReport)
			r.With(auth.RequirePermission(rbacStore, "users.read")).Get("/users", adminAPI.ListUsers)
			r.With(auth.RequirePermission(rbacStore, "users.read")).Get("/users/{id}", adminAPI.GetUser)
			r.With(auth.RequirePermission(rbacStore, "users.write_role")).Patch("/users/{id}/role", adminAPI.SetUserRole)
			r.With(auth.RequirePermission(rbacStore, "users.write_active")).Patch("/users/{id}/active", adminAPI.SetUserActive)
			r.With(auth.RequirePermission(rbacStore, "avatars.moderate")).Get("/avatars", adminAPI.ListPendingAvatars)
			r.With(auth.RequirePermission(rbacStore, "avatars.moderate")).Post("/avatars/{id}/moderate", adminAPI.ModerateAvatar)
			r.With(auth.RequirePermission(rbacStore, "avatars.moderate")).Get("/moderation", adminAPI.GetModerationSettings)
			r.With(auth.RequirePermission(rbacStore, "avatars.moderate")).Put("/moderation", adminAPI.SetModerationSettings)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Get("/banks", adminAPI.ListBanks)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Post("/banks", adminAPI.CreateBank)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Put("/banks/{id}", adminAPI.UpdateBank)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Patch("/banks/{id}", adminAPI.SetBankActive)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Delete("/banks/{id}", adminAPI.DeleteBank)
			r.With(auth.RequirePermission(rbacStore, "telemetry.read")).Get("/fingerprints", adminAPI.ListFingerprints)
			r.With(auth.RequirePermission(rbacStore, "telemetry.read")).Get("/geo-ip", adminAPI.ListGeoIP)
			r.With(auth.RequirePermission(rbacStore, "telemetry.read")).Get("/audit", adminAPI.ListAudit)
			r.With(auth.RequirePermission(rbacStore, "activity.read")).Get("/activity", activityAPI.ConsoleActivity)
			r.With(auth.RequirePermission(rbacStore, "progression.write")).Get("/progression", progAPI.ConsoleGet)
			r.With(auth.RequirePermission(rbacStore, "progression.write")).Put("/progression", progAPI.ConsolePut)
			r.With(auth.RequirePermission(rbacStore, "progression.write")).Get("/game-rules", rulesAPI.Public)
			r.With(auth.RequirePermission(rbacStore, "progression.write")).Put("/game-rules", rulesAPI.ConsolePut)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Get("/currency", payAPI.ConsoleCurrencyGet)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Put("/currency", payAPI.ConsoleCurrencyPut)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Get("/geo-payment", payAPI.ConsoleGeoPaymentGet)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Put("/geo-payment", payAPI.ConsoleGeoPaymentPut)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Get("/telegram-ops-bot", payAPI.ConsoleTelegramOpsGet)
			r.With(auth.RequirePermission(rbacStore, "payments.review")).Put("/telegram-ops-bot", payAPI.ConsoleTelegramOpsPut)

			r.With(auth.RequirePermission(rbacStore, "feature_flags.write")).Get("/cash-rmg/policy", cashAPI.ConsoleGetPolicy)
			r.With(auth.RequirePermission(rbacStore, "feature_flags.write")).Put("/cash-rmg/host-trust-policy", cashAPI.ConsolePutHostTrustPolicy)
			r.With(auth.RequirePermission(rbacStore, "feature_flags.write")).Put("/cash-rmg/allowed-countries", cashAPI.ConsolePutAllowedCountries)
			r.With(auth.RequirePermission(rbacStore, "feature_flags.write")).Post("/cash-rmg/allowed-countries", cashAPI.ConsoleAddAllowedCountry)
			r.With(auth.RequirePermission(rbacStore, "feature_flags.write")).Delete("/cash-rmg/allowed-countries/{code}", cashAPI.ConsoleDeleteAllowedCountry)

			r.With(auth.RequirePermission(rbacStore, "rbac.manage")).Get("/rbac", rbacAPI.Snapshot)
			r.With(auth.RequirePermission(rbacStore, "rbac.manage")).Put("/rbac/catalog", rbacAPI.PutCatalog)
			r.With(auth.RequirePermission(rbacStore, "rbac.manage")).Post("/rbac/permissions", rbacAPI.UpsertPermission)
			r.With(auth.RequirePermission(rbacStore, "rbac.manage")).Put("/rbac/permissions", rbacAPI.UpsertPermission)
			r.With(auth.RequirePermission(rbacStore, "rbac.manage")).Delete("/rbac/permissions/{key}", rbacAPI.DeletePermission)
			r.With(auth.RequirePermission(rbacStore, "rbac.manage")).Put("/rbac/roles/{role}/permissions", rbacAPI.ReplaceRolePermissions)

			r.With(auth.RequirePermission(rbacStore, "ads.manage_runtime")).Get("/ads/playback", adsAPI.ConsolePlaybackGet)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_runtime")).Put("/ads/playback", adsAPI.ConsolePlaybackPut)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Get("/ads/campaigns", adsAPI.ConsoleListCampaigns)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Get("/ads/campaigns/{id}", adsAPI.ConsoleGetCampaign)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Patch("/ads/campaigns/{id}/schedule", adsAPI.ConsoleSetSchedule)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Patch("/ads/campaigns/{id}/status", adsAPI.ConsoleSetStatus)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Post("/ads/campaigns/{id}/thumbnail", adsAPI.ConsoleUploadThumbnail)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Delete("/ads/campaigns/{id}/thumbnail", adsAPI.ConsoleClearThumbnail)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Post("/ads/campaigns/{id}/gallery", adsAPI.ConsoleUploadGalleryImage)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Delete("/ads/campaigns/{id}/gallery/{index}", adsAPI.ConsoleRemoveGalleryImage)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Post("/ads/campaigns/{id}/creatives/{slot}", adsAPI.ConsoleUploadViewportCreative)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Delete("/ads/campaigns/{id}/creatives/{slot}", adsAPI.ConsoleClearViewportCreative)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Post("/ads/campaigns/{id}/creatives/{slot}/video", adsAPI.ConsoleAttachViewportVideo)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Delete("/ads/campaigns/{id}/creatives/{slot}/video", adsAPI.ConsoleClearViewportVideo)
			r.With(auth.RequirePermission(rbacStore, "ads.manage_campaigns")).Delete("/ads/campaigns/{id}/video", adsAPI.ConsoleClearLegacyVideo)

			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Get("/events/catalog", eventsAPI.ConsoleCatalogGet)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Put("/events/catalog", eventsAPI.ConsoleCatalogPut)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Get("/events/catalog/sizes", eventsAPI.ConsoleListCatalogSizes)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Post("/events/catalog/sizes", eventsAPI.ConsoleCreateCatalogSize)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Put("/events/catalog/sizes/{id}", eventsAPI.ConsoleUpdateCatalogSize)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Patch("/events/catalog/sizes/{id}/active", eventsAPI.ConsoleSetCatalogSizeActive)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Delete("/events/catalog/sizes/{id}", eventsAPI.ConsoleDeleteCatalogSize)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Get("/events", eventsAPI.ConsoleListEvents)
			r.With(auth.RequirePermission(rbacStore, "events.manage_reports")).Get("/events/reports", eventsAPI.ConsoleListReports)
			r.With(auth.RequirePermission(rbacStore, "events.manage_reports")).Post("/events/reports/{id}/dismiss", eventsAPI.ConsoleDismissReport)
			r.With(auth.RequirePermission(rbacStore, "events.manage_reports")).Post("/events/reports/{id}/deactivate", eventsAPI.ConsoleDeactivateReport)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Get("/events/{id}", eventsAPI.ConsoleGetEvent)
			r.With(auth.RequirePermission(rbacStore, "events.manage_catalog")).Get("/events/{id}/entries", eventsAPI.ConsoleListEventEntries)
		})
	})

	r.With(middleware.GraphQLDepthReject(12), middleware.GraphQLComplexityReject(200)).Mount("/graphql", graphql.Handler(graphql.Deps{
		Hub:         hub,
		Users:       users,
		Flags:       flags,
		Tokens:      tokens,
		Tournaments: tournaments,
		Entries:     entries,
		Payments:    paySvc,
		Presence:    presenceSvc,
		Ads:         ads,
		Matches:     matches,
		Settings:    settings,
		Cash:        cashRmg,
		Events:      hostedEvents,
		RBAC:        rbacStore,
		DB:          handle,
		Locate:      geoResolver,
	}))
	r.Get("/ws/game", hub.HandleGame)
	r.Get("/ws/matchmaking", hub.HandleMatchmaking)
	r.Get("/ws/spectate", hub.HandleSpectate)

	addr := cfg.Addr()
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("dama api listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Println(err)
		os.Exit(1)
	}
}

// officialPauseRateLimitBody returns DB err_rate_limited (fail closed empty) for official pause routes.
func officialPauseRateLimitBody(settings *store.SettingsStore) middleware.RateLimitDeniedBody {
	return func(r *http.Request, unavailable bool) (int, string) {
		msg := ""
		if settings != nil {
			if raw, err := settings.OfficialPauseChromeJSON(r.Context()); err == nil && len(raw) > 0 {
				var doc map[string]any
				if json.Unmarshal(raw, &doc) == nil {
					if s, ok := doc["err_rate_limited"].(string); ok {
						msg = strings.TrimSpace(s)
					}
				}
			}
		}
		status := http.StatusTooManyRequests
		if unavailable {
			status = http.StatusServiceUnavailable
		}
		b, err := json.Marshal(map[string]string{"error": msg, "error_key": "err_rate_limited"})
		if err != nil {
			return status, `{"error":"","error_key":"err_rate_limited"}`
		}
		return status, string(b)
	}
}

func seedAdmin(ctx context.Context, users *store.UserStore, settings *store.SettingsStore) error {
	username := strings.TrimSpace(os.Getenv("DAMA_SEED_ADMIN_USERNAME"))
	if username == "" {
		username = "admin"
	}
	if _, err := users.GetByUsername(ctx, username); err == nil {
		return nil
	}
	// Social-only: bootstrap console user is OAuth-linked (no password).
	// Set DAMA_SEED_ADMIN_EMAIL (+ optional DAMA_SEED_ADMIN_SUPABASE_ID) to enable.
	email := strings.TrimSpace(os.Getenv("DAMA_SEED_ADMIN_EMAIL"))
	if email == "" {
		return nil
	}
	if settings == nil {
		return fmt.Errorf("settings unavailable for bootstrap role")
	}
	enums := settings.ClientEnums()
	if enums.Source != "database" || len(enums.ConsoleRoles) == 0 {
		return fmt.Errorf("console roles unavailable for bootstrap")
	}
	role := strings.TrimSpace(os.Getenv("DAMA_SEED_ADMIN_ROLE"))
	if role != "" {
		ok := false
		for _, r := range enums.ConsoleRoles {
			if r == role {
				ok = true
				break
			}
		}
		if !ok {
			return fmt.Errorf("DAMA_SEED_ADMIN_ROLE not in console_roles")
		}
	} else {
		role = enums.ConsoleRoles[0]
	}
	sub := strings.TrimSpace(os.Getenv("DAMA_SEED_ADMIN_SUPABASE_ID"))
	if sub == "" {
		// Must be a UUID (users.supabase_user_id column type).
		sub = uuid.NewSHA1(uuid.NameSpaceOID, []byte("dama-seed:"+username)).String()
	}
	rewards := settings.MatchRewards()
	if rewards.Source != "database" || rewards.RatingFloor < 0 || rewards.StartingRating < rewards.RatingFloor {
		return fmt.Errorf("match_rewards.starting_rating unavailable for bootstrap")
	}
	_, err := users.UpsertOAuthGoogle(ctx, sub, email, username, role, "", rewards.StartingRating)
	if err == nil {
		log.Println("seeded console bootstrap user (social-only); sign in with Google using that email")
	}
	return err
}

// runReadyzProbe opens Postgres and Redis, pings each, exits 0/1.
// Used by Docker HEALTHCHECK (no wget/curl required in the image). Does not run migrations.
func runReadyzProbe() int {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.ReadyzTimeoutSec)*time.Second)
	defer cancel()

	if strings.TrimSpace(cfg.DatabaseURL) == "" {
		log.Printf("readyz: DATABASE_URL / DAMA_DATABASE_URL is required")
		return 1
	}
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Printf("readyz: postgres connect: %v", err)
		return 1
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Printf("readyz: postgres: %v", err)
		return 1
	}

	if strings.TrimSpace(cfg.RedisURL) == "" {
		log.Printf("readyz: REDIS_URL / DAMA_REDIS_URL is required")
		return 1
	}
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Printf("readyz: redis url: %v", err)
		return 1
	}
	rdb := redis.NewClient(opt)
	defer func() { _ = rdb.Close() }()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("readyz: redis: %v", err)
		return 1
	}
	return 0
}
