package rest

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/domain"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"
	"github.com/go-chi/chi/v5"
)

func parseISODateStart(raw string) (time.Time, bool) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return time.Time{}, false
	}
	t, err := time.ParseInLocation("2006-01-02", s, time.UTC)
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}

// parseISODateEndExclusive: YYYY-MM-DD means include that calendar day (next midnight exclusive).
func parseISODateEndExclusive(raw string) (time.Time, bool) {
	t, ok := parseISODateStart(raw)
	if !ok {
		return time.Time{}, false
	}
	return t.Add(24 * time.Hour), true
}

type AdminAPI struct {
	Users        *store.UserStore
	Banks        *store.BankStore
	Payouts      *store.PayoutStore
	Audit        *store.AuditStore
	Settings     *store.SettingsStore
	Fingerprints *store.FingerprintStore
	GeoIP        *store.GeoIPStore
	Disabled     *auth.DisabledStore
	Cash         *store.CashRmgStore
	Events       *store.HostedEventStore
	DB           *db.Handle
	Hub          *ws.Hub
}

func (a *AdminAPI) ListUsers(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	filter := store.UserListFilter{Q: strings.TrimSpace(r.URL.Query().Get("q"))}
	switch strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status"))) {
	case "active":
		on := true
		filter.Active = &on
	case "disabled":
		off := false
		filter.Active = &off
	}
	if from, ok := parseISODateStart(r.URL.Query().Get("created_from")); ok {
		filter.CreatedFrom = &from
	}
	if to, ok := parseISODateEndExclusive(r.URL.Query().Get("created_to")); ok {
		filter.CreatedTo = &to
	}
	list, total, err := a.Users.ListUsersPaged(r.Context(), params.Skip, params.Limit, filter)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load users")
		return
	}
	ids := make([]string, 0, len(list))
	for i := range list {
		phoneOK, _ := list[i]["phone_kyc_verified"].(bool)
		docOK, _ := list[i]["document_kyc_verified"].(bool)
		stampHostTrustFields(a.Cash, phoneOK, docOK, list[i])
		if id, _ := list[i]["id"].(string); strings.TrimSpace(id) != "" {
			ids = append(ids, strings.TrimSpace(id))
		}
	}
	if a.Events != nil && a.Settings != nil && len(ids) > 0 {
		enums := a.Settings.ClientEnums()
		finishedSt := strings.TrimSpace(enums.HostedEventFinishedStatus)
		cancelledSt := strings.TrimSpace(enums.HostedEventCancelledStatus)
		openReportSt := strings.TrimSpace(enums.HostedEventReportOpenStatus)
		if finishedSt != "" && cancelledSt != "" && openReportSt != "" {
			if reps, repErr := a.Events.MapHostReputation(r.Context(), ids, finishedSt, cancelledSt, openReportSt); repErr == nil {
				for i := range list {
					id, _ := list[i]["id"].(string)
					rep := reps[strings.TrimSpace(id)]
					list[i]["host_finished_paid_cups"] = rep.FinishedPaidCups
					list[i]["host_cancelled_paid_cups"] = rep.CancelledPaidCups
					list[i]["host_open_reports"] = rep.OpenReports
				}
			}
		}
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"users": list, "meta": meta})
}

// GetUser returns one console user profile (Trim /users/{id} + smart-menu staff detail parity).
func (a *AdminAPI) GetUser(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeClientError(w, http.StatusNotFound, "user not found")
		return
	}
	u, err := a.Users.GetByID(r.Context(), id)
	if err != nil || u == nil {
		writeClientError(w, http.StatusNotFound, "user not found")
		return
	}
	out := u.Self()
	stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, out)
	if a.Events != nil && a.Settings != nil {
		enums := a.Settings.ClientEnums()
		finishedSt := strings.TrimSpace(enums.HostedEventFinishedStatus)
		cancelledSt := strings.TrimSpace(enums.HostedEventCancelledStatus)
		openReportSt := strings.TrimSpace(enums.HostedEventReportOpenStatus)
		if finishedSt != "" && cancelledSt != "" && openReportSt != "" {
			if reps, repErr := a.Events.MapHostReputation(r.Context(), []string{id}, finishedSt, cancelledSt, openReportSt); repErr == nil {
				rep := reps[id]
				out["host_finished_paid_cups"] = rep.FinishedPaidCups
				out["host_cancelled_paid_cups"] = rep.CancelledPaidCups
				out["host_open_reports"] = rep.OpenReports
			}
		}
	}
	// Always emit payout_methods as [] on success so UI can tell empty vs load failure.
	// On list error, omit the key (client shows load-failed, not "no methods").
	if a.Payouts == nil {
		out["payout_methods"] = []map[string]any{}
	} else {
		methods, _, listErr := a.Payouts.ListMethodsForUser(r.Context(), id, 0, 20)
		if listErr == nil {
			rows := make([]map[string]any, 0, len(methods))
			for _, m := range methods {
				rows = append(rows, map[string]any{
					"id":           m.ID,
					"provider":     m.Provider,
					"account_name": m.AccountName,
					"phone":        m.Phone,
					"updated_at":   m.UpdatedAt,
				})
			}
			out["payout_methods"] = rows
		}
	}
	writeJSON(w, http.StatusOK, out)
}

type setRoleBody struct {
	Role string `json:"role"`
}

func (a *AdminAPI) SetUserRole(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body setRoleBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Role == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role required"})
		return
	}
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" || !a.Settings.IsAllowedRole(body.Role) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid role"})
		return
	}
	u, err := a.Users.SetRole(r.Context(), id, body.Role)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to update role")
		return
	}
	if a.Audit != nil {
		actor := auth.UserIDFromContext(r.Context())
		a.Audit.Log(r.Context(), &actor, "user.set_role", "user", id, map[string]any{"role": body.Role})
	}
	if a.DB != nil && a.DB.Ready() {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, id, notifications.KindPlayerAccountStatus,
			"account_role:"+id+":"+body.Role, id, body.Role)
	}
	out := u.Self()
	stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, out)
	writeJSON(w, http.StatusOK, out)
}

type setUserActiveBody struct {
	Active bool `json:"active"`
}

func (a *AdminAPI) SetUserActive(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body setUserActiveBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "active required"})
		return
	}
	actor := auth.UserIDFromContext(r.Context())
	if actor == id {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot deactivate self"})
		return
	}
	u, err := a.Users.SetActive(r.Context(), id, body.Active)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to update active state")
		return
	}
	if a.Disabled != nil {
		_ = a.Disabled.SetDisabled(r.Context(), id, !body.Active)
	}
	if a.Audit != nil {
		a.Audit.Log(r.Context(), &actor, "user.set_active", "user", id, map[string]any{"active": body.Active})
	}
	if a.DB != nil && a.DB.Ready() {
		status := "inactive"
		if body.Active {
			status = "active"
		}
		notifications.EmitPlayer(r.Context(), a.DB.Pool, id, notifications.KindPlayerAccountStatus,
			"account_status:"+id+":"+status, id, status)
	}
	out := u.Self()
	stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, out)
	writeJSON(w, http.StatusOK, out)
}

func (a *AdminAPI) ListPendingAvatars(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	list, total, err := a.Users.ListPendingAvatarsPaged(r.Context(), params.Skip, params.Limit, q)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load avatars")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"avatars": list, "meta": meta})
}

type avatarModBody struct {
	Action string `json:"action"` // approve | flag | reset
}

func (a *AdminAPI) ModerateAvatar(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body avatarModBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Action == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "action required"})
		return
	}
	var (
		user any
		err  error
	)
	switch body.Action {
	case "approve":
		user, err = a.Users.SetAvatarModeration(r.Context(), id, "approved")
	case "flag":
		user, err = a.Users.SetAvatarModeration(r.Context(), id, "flagged")
	case "reset":
		user, err = a.Users.ResetAvatar(r.Context(), id)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown action"})
		return
	}
	if err != nil {
		writeClientError(w, http.StatusNotFound, "avatar not found")
		return
	}
	if a.Audit != nil {
		a.Audit.Log(r.Context(), nil, "avatar_"+body.Action, "user", id, nil)
	}
	if a.DB != nil && a.DB.Ready() && (body.Action == "approve" || body.Action == "flag" || body.Action == "reset") {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, id, notifications.KindPlayerAvatarReviewed,
			"avatar_reviewed:"+id+":"+body.Action, id, body.Action)
	}
	if u, ok := user.(*domain.User); ok {
		if a.Hub != nil {
			thumb, full := "", ""
			if u.AvatarThumbURL != nil {
				thumb = *u.AvatarThumbURL
			}
			if u.AvatarFullURL != nil {
				full = *u.AvatarFullURL
			}
			a.Hub.BroadcastAvatarUpdated(map[string]any{
				"type":             "avatar_updated",
				"user_id":          id,
				"avatar_thumb_url": thumb,
				"avatar_full_url":  full,
			})
		}
		out := u.Self()
		stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, out)
		writeJSON(w, http.StatusOK, out)
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (a *AdminAPI) ListBanks(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	bankFilter := store.BankListFilter{Q: strings.TrimSpace(r.URL.Query().Get("q"))}
	switch strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status"))) {
	case "active":
		on := true
		bankFilter.Active = &on
	case "inactive":
		off := false
		bankFilter.Active = &off
	}
	list, total, err := a.Banks.ListPaged(r.Context(), params.Skip, params.Limit, bankFilter)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load banks")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"banks": list, "meta": meta})
}

type bankBody struct {
	Provider      string `json:"provider"`
	Label         string `json:"label"`
	AccountName   string `json:"account_name"`
	AccountNumber string `json:"account_number"`
	MobileCode    string `json:"mobile_code"`
	Currency      string `json:"currency"`
	IsActive      bool   `json:"is_active"`
}

func (a *AdminAPI) CreateBank(w http.ResponseWriter, r *http.Request) {
	body := bankBody{IsActive: true}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if body.Currency == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "currency required"})
		return
	}
	b, err := a.Banks.Create(r.Context(), store.UpsertBankInput{
		Provider: body.Provider, Label: body.Label, AccountName: body.AccountName,
		AccountNumber: body.AccountNumber, MobileCode: body.MobileCode,
		Currency: body.Currency, IsActive: body.IsActive,
	})
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to create bank")
		return
	}
	writeJSON(w, http.StatusCreated, b)
}

type bankActiveBody struct {
	Active bool `json:"active"`
}

func (a *AdminAPI) SetBankActive(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body bankActiveBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	if err := a.Banks.SetActive(r.Context(), id, body.Active); err != nil {
		writeClientError(w, http.StatusNotFound, "bank not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *AdminAPI) UpdateBank(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var body bankBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	b, err := a.Banks.Update(r.Context(), id, store.UpsertBankInput{
		Provider: body.Provider, Label: body.Label, AccountName: body.AccountName,
		AccountNumber: body.AccountNumber, MobileCode: body.MobileCode,
		Currency: body.Currency, IsActive: body.IsActive,
	})
	if err != nil {
		if err == store.ErrNotFound {
			writeClientError(w, http.StatusNotFound, "bank not found")
			return
		}
		writeClientError(w, http.StatusBadRequest, "unable to update bank")
		return
	}
	writeJSON(w, http.StatusOK, b)
}

func (a *AdminAPI) DeleteBank(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if err := a.Banks.Delete(r.Context(), id); err != nil {
		if err == store.ErrNotFound {
			writeClientError(w, http.StatusNotFound, "bank not found")
			return
		}
		writeClientError(w, http.StatusBadRequest, "unable to delete bank")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *AdminAPI) Leaderboard(w http.ResponseWriter, r *http.Request) {
	playerRole := ""
	if a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			playerRole = enums.DefaultRole
		}
	}
	if playerRole == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "default role unavailable"})
		return
	}
	list, err := a.Users.Leaderboard(r.Context(), 50, playerRole)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load leaderboard")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"leaderboard": list})
}

func (a *AdminAPI) GetModerationSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	cfg := a.Settings.Moderation()
	if cfg.Source != "database" || cfg.Provider == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "moderation config unavailable",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"provider": publicModerationProvider(cfg.Provider),
		"enabled":  cfg.Enabled,
	})
}

func (a *AdminAPI) SetModerationSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "settings store unavailable"})
		return
	}
	var body store.ModerationConfig
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	body.Provider = internalModerationProvider(body.Provider)
	if err := a.Settings.SetModeration(r.Context(), body); err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to update moderation settings")
		return
	}
	cfg := a.Settings.Moderation()
	writeJSON(w, http.StatusOK, map[string]any{
		"provider": publicModerationProvider(cfg.Provider),
		"enabled":  cfg.Enabled,
	})
}

func publicModerationProvider(p string) string {
	switch p {
	case "cloudinary_aws_rek":
		return "auto_review"
	case "admin_only":
		return "manual_review"
	default:
		if p == "" {
			return "manual_review"
		}
		return "custom"
	}
}

func internalModerationProvider(p string) string {
	switch p {
	case "auto_review", "cloudinary_aws_rek":
		return "cloudinary_aws_rek"
	case "manual_review", "admin_only":
		return "admin_only"
	default:
		return p
	}
}

func (a *AdminAPI) ListFingerprints(w http.ResponseWriter, r *http.Request) {
	if a.Fingerprints == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "fingerprint store unavailable"})
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	list, total, err := a.Fingerprints.ListPaged(r.Context(), params.Skip, params.Limit, q)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load fingerprints")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"fingerprints": list, "meta": meta})
}

func (a *AdminAPI) ListGeoIP(w http.ResponseWriter, r *http.Request) {
	if a.GeoIP == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "geo-ip store unavailable"})
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	list, total, err := a.GeoIP.ListPaged(r.Context(), params.Skip, params.Limit, q)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load geo records")
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, g := range list {
		out = append(out, map[string]any{
			"id":           g.ID,
			"user_id":      g.UserID,
			"username":     g.Username,
			"ip":           g.IP,
			"country_code": g.CountryCode,
			"region":       g.Region,
			"city":         g.City,
			"source":       publicLocateSource(g.Source),
			"latitude":     g.Latitude,
			"longitude":    g.Longitude,
			"created_at":   g.CreatedAt,
		})
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"geo_ip_records": out, "meta": meta})
}

func publicLocateSource(s string) string {
	switch s {
	case "gps", "client":
		return "device"
	case "geoip", "geoip_error", "geoip_unavailable":
		return "network"
	default:
		return "unknown"
	}
}

func (a *AdminAPI) ListAudit(w http.ResponseWriter, r *http.Request) {
	if a.Audit == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "audit store unavailable"})
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	list, total, err := a.Audit.ListPaged(r.Context(), params.Skip, params.Limit, q)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load audit log")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"audit": list, "meta": meta})
}

// ListConsoleNav returns dashboard module links from platform_settings.console_nav.
func (a *AdminAPI) ListConsoleNav(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "console nav unavailable"})
		return
	}
	if err := a.Settings.ReloadConsoleNav(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "console nav unavailable"})
		return
	}
	nav := a.Settings.ConsoleNav()
	if nav.Source != "database" || len(nav.Modules) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "console nav unavailable"})
		return
	}
	out := map[string]any{
		"modules":          nav.Modules,
		"brand_title":      nav.BrandTitle,
		"title_template":   nav.TitleTemplate,
		"meta_description": nav.MetaDescription,
		"meta_separator":   nav.MetaSeparator,
		"graphql_empty":    nav.GraphqlEmpty,
	}
	if len(nav.Sections) > 0 {
		out["sections"] = nav.Sections
	}
	writeJSON(w, http.StatusOK, out)
}

// ListClientNav returns player/ads/marketing/mobile nav from platform_settings.client_nav.
func (a *AdminAPI) ListClientNav(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "client nav unavailable"})
		return
	}
	if err := a.Settings.ReloadClientNav(r.Context()); err != nil {
		log.Printf("ListClientNav: ReloadClientNav: %v", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "client nav unavailable"})
		return
	}
	nav := a.Settings.ClientNav()
	if nav.Source != "database" {
		log.Printf("ListClientNav: source=%q (db not hydrated)", nav.Source)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "client nav unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"player":                         nav.Player,
		"ads":                            nav.Ads,
		"events":                         nav.Events,
		"marketing":                      nav.Marketing,
		"mobile":                         nav.Mobile,
		"dashboard":                      nav.Dashboard,
		"bottom_nav":                     nav.BottomNav,
		"mobile_nav_unavailable":         nav.MobileNavUnavailable,
		"brand_name":                     nav.BrandName,
		"ads_brand_name":                 nav.AdsBrandName,
		"events_brand_name":              nav.EventsBrandName,
		"events_nav_unavailable":         nav.EventsNavUnavailable,
		"dashboard_page_title":           nav.DashboardPageTitle,
		"dashboard_page_blurb":           nav.DashboardPageBlurb,
		"profile_load_failed":            nav.ProfileLoadFailed,
		"dashboard_unavailable":          nav.DashboardUnavailable,
		"dashboard_history_title":        nav.DashboardHistoryTitle,
		"dashboard_history_empty":        nav.DashboardHistoryEmpty,
		"dashboard_history_unavailable":  nav.DashboardHistoryUnavailable,
		"dashboard_profile_action":       nav.DashboardProfileAction,
		"dashboard_profile_href":         nav.DashboardProfileHref,
		"dashboard_play_action":          nav.DashboardPlayAction,
		"dashboard_play_href":            nav.DashboardPlayHref,
		"dashboard_win_rate_label":       nav.DashboardWinRateLabel,
		"dashboard_percent_suffix":       nav.DashboardPercentSuffix,
		"dashboard_matches_suffix":       nav.DashboardMatchesSuffix,
		"dashboard_matches_joiner":       nav.DashboardMatchesJoiner,
		"dashboard_recent_results_title": nav.DashboardRecentResultsTitle,
		"dashboard_transactions_action":  nav.DashboardTransactionsAction,
		"dashboard_transactions_href":    nav.DashboardTransactionsHref,
		"dashboard_find_match_action":    nav.DashboardFindMatchAction,
		"dashboard_wallet_href":          nav.DashboardWalletHref,
		"dashboard_col_result":           nav.DashboardColResult,
		"dashboard_col_mode":             nav.DashboardColMode,
		"dashboard_col_moves":            nav.DashboardColMoves,
		"dashboard_col_date":             nav.DashboardColDate,
		"settings_session_label":         nav.SettingsSessionLabel,
		"settings_unavailable":           nav.SettingsUnavailable,
		"marketing_hero_eyebrow":         nav.MarketingHeroEyebrow,
		"marketing_hero_blurb":           nav.MarketingHeroBlurb,
		"marketing_footer_text":          nav.MarketingFooterText,
		"site_title_default":             nav.SiteTitleDefault,
		"site_title_template":            nav.SiteTitleTemplate,
		"site_description":               nav.SiteDescription,
		"graphql_empty":                  nav.GraphqlEmpty,
	})
}

// ListClientEnums returns assignable roles and lifecycle statuses from platform_settings.client_enums.
func (a *AdminAPI) ListClientEnums(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "client enums unavailable"})
		return
	}
	if err := a.Settings.ReloadClientEnums(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "client enums unavailable"})
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "client enums unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"roles":                                           enums.Roles,
		"console_roles":                                   enums.ConsoleRoles,
		"publisher_roles":                                 enums.PublisherRoles,
		"default_role":                                    enums.DefaultRole,
		"tournament_statuses":                             enums.TournamentStatuses,
		"campaign_statuses":                               enums.CampaignStatuses,
		"creative_types":                                  enums.CreativeTypes,
		"default_creative_type":                           enums.DefaultCreativeType,
		"video_creative_type":                             enums.VideoCreativeType,
		"default_tournament_status":                       enums.DefaultTournamentStatus,
		"default_campaign_status":                         enums.DefaultCampaignStatus,
		"enrollable_tournament_status":                    enums.EnrollableTournamentStatus,
		"servable_campaign_status":                        enums.ServableCampaignStatus,
		"archived_campaign_status":                        enums.ArchivedCampaignStatus,
		"reopen_campaign_status":                          enums.ReopenCampaignStatus,
		"ethiopia_payment_modes":                          enums.EthiopiaPaymentModes,
		"hosted_event_statuses":                           enums.HostedEventStatuses,
		"hosted_event_joinable_statuses":                  enums.HostedEventJoinableStatuses,
		"hosted_event_default_status":                     enums.HostedEventDefaultStatus,
		"hosted_event_formats":                            enums.HostedEventFormats,
		"hosted_event_default_format":                     enums.HostedEventDefaultFormat,
		"hosted_event_knockout_format":                    enums.HostedEventKnockoutFormat,
		"hosted_event_round_robin_format":                 enums.HostedEventRoundRobinFormat,
		"hosted_event_swiss_format":                       enums.HostedEventSwissFormat,
		"hosted_event_groups_knockout_format":             enums.HostedEventGroupsKnockoutFormat,
		"hosted_event_arena_format":                       enums.HostedEventArenaFormat,
		"hosted_event_bracket_phases":                     enums.HostedEventBracketPhases,
		"hosted_event_phase_knockout":                     enums.HostedEventPhaseKnockout,
		"hosted_event_phase_round_robin":                  enums.HostedEventPhaseRoundRobin,
		"hosted_event_phase_swiss":                        enums.HostedEventPhaseSwiss,
		"hosted_event_phase_group":                        enums.HostedEventPhaseGroup,
		"hosted_event_phase_arena":                        enums.HostedEventPhaseArena,
		"hosted_event_entry_statuses":                     enums.HostedEventEntryStatuses,
		"hosted_event_entry_pending":                      enums.HostedEventEntryPending,
		"hosted_event_entry_approved":                     enums.HostedEventEntryApproved,
		"hosted_event_entry_rejected":                     enums.HostedEventEntryRejected,
		"hosted_event_entry_kicked":                       enums.HostedEventEntryKicked,
		"hosted_event_bracket_statuses":                   enums.HostedEventBracketStatuses,
		"hosted_event_bracket_pending":                    enums.HostedEventBracketPending,
		"hosted_event_bracket_ready":                      enums.HostedEventBracketReady,
		"hosted_event_bracket_live":                       enums.HostedEventBracketLive,
		"hosted_event_bracket_done":                       enums.HostedEventBracketDone,
		"hosted_event_bracket_bye":                        enums.HostedEventBracketBye,
		"hosted_event_full_status":                        enums.HostedEventFullStatus,
		"hosted_event_live_status":                        enums.HostedEventLiveStatus,
		"hosted_event_finished_status":                    enums.HostedEventFinishedStatus,
		"hosted_event_cancelled_status":                   enums.HostedEventCancelledStatus,
		"hosted_event_visibilities":                       enums.HostedEventVisibilities,
		"hosted_event_default_visibility":                 enums.HostedEventDefaultVisibility,
		"hosted_event_public_visibility":                  enums.HostedEventPublicVisibility,
		"hosted_event_private_visibility":                 enums.HostedEventPrivateVisibility,
		"hosted_event_report_statuses":                    enums.HostedEventReportStatuses,
		"hosted_event_report_open_status":                 enums.HostedEventReportOpenStatus,
		"hosted_event_report_dismissed_status":            enums.HostedEventReportDismissedStatus,
		"hosted_event_report_deactivated_status":          enums.HostedEventReportDeactivatedStatus,
		"hosted_event_status_labels":                      enums.HostedEventStatusLabels,
		"hosted_event_entry_status_labels":                enums.HostedEventEntryStatusLabels,
		"hosted_event_bracket_status_labels":              enums.HostedEventBracketStatusLabels,
		"hosted_event_report_status_labels":               enums.HostedEventReportStatusLabels,
		"hosted_event_visibility_labels":                  enums.HostedEventVisibilityLabels,
		"campaign_status_labels":                          enums.CampaignStatusLabels,
		"tournament_status_labels":                        enums.TournamentStatusLabels,
		"tournament_formats":                              enums.TournamentFormats,
		"tournament_default_format":                       enums.TournamentDefaultFormat,
		"tournament_bracket_ready":                        enums.TournamentBracketReady,
		"tournament_bracket_live":                         enums.TournamentBracketLive,
		"creative_type_labels":                            enums.CreativeTypeLabels,
		"competition_prize_payout_statuses":               enums.CompetitionPrizePayoutStatuses,
		"competition_prize_payout_pending":                enums.CompetitionPrizePayoutPending,
		"competition_prize_payout_settled":                enums.CompetitionPrizePayoutSettled,
		"competition_prize_payout_failed":                 enums.CompetitionPrizePayoutFailed,
		"competition_prize_payout_cancelled":              enums.CompetitionPrizePayoutCancelled,
		"competition_dispute_window_hours":                enums.CompetitionDisputeWindowHours,
		"competition_prize_settle_interval_minutes":       enums.CompetitionPrizeSettleIntervalMinutes,
		"competition_prize_auto_settle":                   enums.CompetitionPrizeAutoSettle,
		"competition_check_in_window_hours":               enums.CompetitionCheckInWindowHours,
		"competition_match_ready_timeout_seconds":         enums.CompetitionMatchReadyTimeoutSeconds,
		"competition_match_ready_auto_forfeit":            enums.CompetitionMatchReadyAutoForfeit,
		"competition_arena_points_win":                    enums.CompetitionArenaPointsWin,
		"competition_arena_points_draw":                   enums.CompetitionArenaPointsDraw,
		"competition_arena_points_loss":                   enums.CompetitionArenaPointsLoss,
		"competition_arena_streak_second_win":             enums.CompetitionArenaStreakSecondWin,
		"competition_arena_streak_third_plus_win":         enums.CompetitionArenaStreakThirdPlusWin,
		"competition_arena_default_duration_minutes":      enums.CompetitionArenaDefaultDurationMinutes,
		"competition_arena_pairing_modes":                 enums.CompetitionArenaPairingModes,
		"competition_arena_default_pairing_mode":          enums.CompetitionArenaDefaultPairingMode,
		"competition_arena_auto_start":                    enums.CompetitionArenaAutoStart,
		"competition_arena_pair_interval_seconds":         enums.CompetitionArenaPairIntervalSeconds,
		"competition_arena_allow_join_while_live":         enums.CompetitionArenaAllowJoinWhileLive,
		"competition_payout_modes":                        enums.CompetitionPayoutModes,
		"competition_payout_mode_places_percent":          enums.CompetitionPayoutModePlacesPercent,
		"competition_payout_mode_score_share":             enums.CompetitionPayoutModeScoreShare,
		"competition_payout_mode_dual_purse":              enums.CompetitionPayoutModeDualPurse,
		"competition_dual_purse_place_percent":            enums.CompetitionDualPursePlacePercent,
		"competition_default_payout_mode_knockout":        enums.CompetitionDefaultPayoutModeKnockout,
		"competition_default_payout_mode_round_robin":     enums.CompetitionDefaultPayoutModeRoundRobin,
		"competition_default_payout_mode_swiss":           enums.CompetitionDefaultPayoutModeSwiss,
		"competition_default_payout_mode_groups_knockout": enums.CompetitionDefaultPayoutModeGroupsKnockout,
		"competition_default_payout_mode_arena":           enums.CompetitionDefaultPayoutModeArena,
		"competition_default_place_percent_1":             enums.CompetitionDefaultPlacePercent1,
		"competition_default_place_percent_2":             enums.CompetitionDefaultPlacePercent2,
		"competition_default_place_percent_3":             enums.CompetitionDefaultPlacePercent3,
		"competition_standings_points_win":                enums.CompetitionStandingsPointsWin,
		"competition_standings_points_draw":               enums.CompetitionStandingsPointsDraw,
		"unavailable":                                     enums.Unavailable,
	})
}

func competitionArenaSettingsResponse(enums store.ClientEnumsConfig) map[string]any {
	return map[string]any{
		"competition_arena_points_win":               enums.CompetitionArenaPointsWin,
		"competition_arena_points_draw":              enums.CompetitionArenaPointsDraw,
		"competition_arena_points_loss":              enums.CompetitionArenaPointsLoss,
		"competition_arena_streak_second_win":        enums.CompetitionArenaStreakSecondWin,
		"competition_arena_streak_third_plus_win":    enums.CompetitionArenaStreakThirdPlusWin,
		"competition_arena_default_duration_minutes": enums.CompetitionArenaDefaultDurationMinutes,
		"competition_arena_default_pairing_mode":     enums.CompetitionArenaDefaultPairingMode,
		"competition_arena_auto_start":               enums.CompetitionArenaAutoStart,
		"competition_arena_pair_interval_seconds":    enums.CompetitionArenaPairIntervalSeconds,
		"competition_arena_allow_join_while_live":    enums.CompetitionArenaAllowJoinWhileLive,
		"competition_arena_pairing_modes":            enums.CompetitionArenaPairingModes,
	}
}

func (a *AdminAPI) GetCompetitionArenaSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": enums.Unavailable})
		return
	}
	writeJSON(w, http.StatusOK, competitionArenaSettingsResponse(enums))
}

func (a *AdminAPI) PutCompetitionArenaSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	var body store.CompetitionArenaSettingsPatch
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if err := a.Settings.SetCompetitionArenaSettings(r.Context(), body); err != nil {
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	enums := a.Settings.ClientEnums()
	writeJSON(w, http.StatusOK, competitionArenaSettingsResponse(enums))
}

func competitionStandingsSettingsResponse(enums store.ClientEnumsConfig) map[string]any {
	return map[string]any{
		"competition_standings_points_win":  enums.CompetitionStandingsPointsWin,
		"competition_standings_points_draw": enums.CompetitionStandingsPointsDraw,
	}
}

func (a *AdminAPI) GetCompetitionStandingsSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": enums.Unavailable})
		return
	}
	writeJSON(w, http.StatusOK, competitionStandingsSettingsResponse(enums))
}

func (a *AdminAPI) PutCompetitionStandingsSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	var body store.CompetitionStandingsSettingsPatch
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if err := a.Settings.SetCompetitionStandingsSettings(r.Context(), body); err != nil {
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	enums := a.Settings.ClientEnums()
	writeJSON(w, http.StatusOK, competitionStandingsSettingsResponse(enums))
}

func (a *AdminAPI) GetCompetitionPointsToastSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	cfg, err := a.Settings.GetCompetitionPointsToastSettings(r.Context())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (a *AdminAPI) PutCompetitionPointsToastSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	var body store.CompetitionPointsToastSettingsPatch
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if err := a.Settings.SetCompetitionPointsToastSettings(r.Context(), body); err != nil {
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	cfg, err := a.Settings.GetCompetitionPointsToastSettings(r.Context())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func competitionPayoutDefaultsSettingsResponse(enums store.ClientEnumsConfig) map[string]any {
	return map[string]any{
		"competition_payout_modes":                        enums.CompetitionPayoutModes,
		"competition_payout_mode_places_percent":          enums.CompetitionPayoutModePlacesPercent,
		"competition_payout_mode_score_share":             enums.CompetitionPayoutModeScoreShare,
		"competition_payout_mode_dual_purse":              enums.CompetitionPayoutModeDualPurse,
		"competition_default_payout_mode_knockout":        enums.CompetitionDefaultPayoutModeKnockout,
		"competition_default_payout_mode_round_robin":     enums.CompetitionDefaultPayoutModeRoundRobin,
		"competition_default_payout_mode_swiss":           enums.CompetitionDefaultPayoutModeSwiss,
		"competition_default_payout_mode_groups_knockout": enums.CompetitionDefaultPayoutModeGroupsKnockout,
		"competition_default_payout_mode_arena":           enums.CompetitionDefaultPayoutModeArena,
		"competition_default_place_percent_1":             enums.CompetitionDefaultPlacePercent1,
		"competition_default_place_percent_2":             enums.CompetitionDefaultPlacePercent2,
		"competition_default_place_percent_3":             enums.CompetitionDefaultPlacePercent3,
		"competition_dual_purse_place_percent":            enums.CompetitionDualPursePlacePercent,
	}
}

func (a *AdminAPI) GetCompetitionPayoutDefaultsSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": enums.Unavailable})
		return
	}
	writeJSON(w, http.StatusOK, competitionPayoutDefaultsSettingsResponse(enums))
}

func (a *AdminAPI) PutCompetitionPayoutDefaultsSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	var body store.CompetitionPayoutDefaultsSettingsPatch
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if err := a.Settings.SetCompetitionPayoutDefaultsSettings(r.Context(), body); err != nil {
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	enums := a.Settings.ClientEnums()
	writeJSON(w, http.StatusOK, competitionPayoutDefaultsSettingsResponse(enums))
}

func competitionPrizeSettleSettingsResponse(enums store.ClientEnumsConfig) map[string]any {
	return map[string]any{
		"competition_prize_auto_settle":             enums.CompetitionPrizeAutoSettle,
		"competition_dispute_window_hours":          enums.CompetitionDisputeWindowHours,
		"competition_prize_settle_interval_minutes": enums.CompetitionPrizeSettleIntervalMinutes,
	}
}

func (a *AdminAPI) GetCompetitionPrizeSettleSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": enums.Unavailable})
		return
	}
	writeJSON(w, http.StatusOK, competitionPrizeSettleSettingsResponse(enums))
}

func (a *AdminAPI) PutCompetitionPrizeSettleSettings(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "settings store unavailable"})
		return
	}
	var body store.CompetitionPrizeSettleSettingsPatch
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if err := a.Settings.SetCompetitionPrizeSettleSettings(r.Context(), body); err != nil {
		writeClientError(w, http.StatusBadRequest, err.Error())
		return
	}
	enums := a.Settings.ClientEnums()
	writeJSON(w, http.StatusOK, competitionPrizeSettleSettingsResponse(enums))
}

// ListFeatureFlagCatalog returns console toggle metadata from platform_settings.feature_flag_catalog.
func (a *AdminAPI) ListFeatureFlagCatalog(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "feature flag catalog unavailable"})
		return
	}
	if err := a.Settings.ReloadFeatureFlagCatalog(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "feature flag catalog unavailable"})
		return
	}
	cat := a.Settings.FeatureFlagCatalog()
	if cat.Source != "database" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "feature flag catalog unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"toggles":            cat.Toggles,
		"ai_depths_flag_key": cat.AIDepthsFlagKey,
		"cash_rmg_flag_key":  cat.CashRmgFlagKey,
	})
}
