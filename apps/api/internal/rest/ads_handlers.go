package rest

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/adsgeo"
	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/media"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/youtube"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type AdsAPI struct {
	Ads      *store.AdStore
	YT       *youtube.Pool
	Worker   *youtube.Worker
	Geo      *adsgeo.Index
	Locate   *geo.Resolver
	Settings *store.SettingsStore
	Audit    *store.AuditStore
	Avatars  *media.AvatarService
	Payments *payments.Service
	Cash     *store.CashRmgStore
	Users    *store.UserStore
	DB       *db.Handle
}

// writeAdsErr writes a DB chrome error for ads APIs (fail closed).
func writeAdsErr(w http.ResponseWriter, settings *store.SettingsStore, status int, key string) {
	msg := ""
	if settings != nil {
		msg = settings.AdRuntimeChromeString(key)
		if msg == "" {
			msg = settings.AdRuntimeChromeString("playback_unavailable")
		}
		if msg == "" {
			msg = strings.TrimSpace(settings.AdRuntimeChrome().PlaybackUnavailable)
		}
	}
	if msg == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": ""})
		return
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

func (a *AdsAPI) impressionUnitCost() (float64, bool) {
	if a.Settings == nil {
		return 0, false
	}
	cfg := a.Settings.AdPricing()
	if cfg.Source != "database" || cfg.ImpressionUnitCost <= 0 {
		return 0, false
	}
	return cfg.ImpressionUnitCost, true
}

// payerCountryISO resolves payer country like reference pay geo (IP / GPS invent; no profile).
func (a *AdsAPI) payerCountryISO(r *http.Request) string {
	return resolvePayerCountryFromRequest(r, a.Locate, a.Settings, 0, 0)
}

func asJSONFloat64(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}

// extractGeoTargetPinCoords requires a finite non-null-island lat/lng on the first geo target
// (smart-menu BranchLocationPinField parity: map pin is mandatory for targeting).
func extractGeoTargetPinCoords(raw []any) (lat, lng float64, ok bool) {
	if len(raw) == 0 {
		return 0, 0, false
	}
	m, isMap := raw[0].(map[string]any)
	if !isMap {
		return 0, 0, false
	}
	lat, okLat := asJSONFloat64(m["lat"])
	lng, okLng := asJSONFloat64(m["lng"])
	if !okLat || !okLng {
		return 0, 0, false
	}
	if lat != lat || lng != lng { // NaN
		return 0, 0, false
	}
	if lat == 0 && lng == 0 {
		return 0, 0, false
	}
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return 0, 0, false
	}
	return lat, lng, true
}

// stampAdGeoTargetsCountry forces each target's country to the server-resolved ISO
// (reference pay geo: never trust client country invent on create).
// Allowlists only country/region/district/pin coords (worldwide match; no distance fence).
func stampAdGeoTargetsCountry(raw []any, payerCC string) []any {
	cc := strings.ToUpper(strings.TrimSpace(payerCC))
	if len(cc) != 2 {
		return nil
	}
	if len(raw) == 0 {
		return nil
	}
	out := make([]any, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		cp := map[string]any{"country": cc}
		if v, ok := m["region"]; ok {
			cp["region"] = v
		}
		if v, ok := m["district"]; ok {
			cp["district"] = v
		}
		if v, ok := m["lat"]; ok {
			cp["lat"] = v
		} else if v, ok := m["latitude"]; ok {
			cp["lat"] = v
		}
		if v, ok := m["lng"]; ok {
			cp["lng"] = v
		} else if v, ok := m["longitude"]; ok {
			cp["lng"] = v
		}
		out = append(out, cp)
	}
	return out
}

// campaignCreateFee returns the Ethiopia or global create-fee pair for the payer country.
func (a *AdsAPI) campaignCreateFee(r *http.Request) (amount float64, currency string, ok bool) {
	return a.campaignCreateFeeAt(r, 0, 0)
}

// campaignCreateFeeAt resolves Ethiopia vs global fee using pin GPS when provided (map create flow).
func (a *AdsAPI) campaignCreateFeeAt(r *http.Request, lat, lng float64) (amount float64, currency string, ok bool) {
	if a.Settings == nil {
		return 0, "", false
	}
	cc := resolvePayerCountryFromRequest(r, a.Locate, a.Settings, lat, lng)
	return a.Settings.CampaignCreateFeeForCountry(cc)
}

// Pricing returns DB-backed impression unit cost and geo-resolved create fee (Ethiopia vs global).
// Optional lat/lng query params resolve the fee pair at the map pin (campaign create parity).
func (a *AdsAPI) Pricing(w http.ResponseWriter, r *http.Request) {
	cost, ok := a.impressionUnitCost()
	if !ok {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_pricing_unavailable")
		return
	}
	var lat, lng float64
	if latS := strings.TrimSpace(r.URL.Query().Get("lat")); latS != "" {
		if v, err := strconv.ParseFloat(latS, 64); err == nil {
			lat = v
		}
	}
	if lngS := strings.TrimSpace(r.URL.Query().Get("lng")); lngS != "" {
		if v, err := strconv.ParseFloat(lngS, 64); err == nil {
			lng = v
		}
	}
	fee, currency, feeOK := a.campaignCreateFeeAt(r, lat, lng)
	if !feeOK {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_pricing_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"impression_unit_cost":         cost,
		"campaign_create_fee_amount":   fee,
		"campaign_create_fee_currency": currency,
		"country_code":                 resolvePayerCountryFromRequest(r, a.Locate, a.Settings, lat, lng),
	})
}

type createAdBody struct {
	Title         string   `json:"title"`
	DailySpendCap *float64 `json:"daily_spend_cap"`
	GeoTargets    []any    `json:"geo_targets"`
	CreativeType  string   `json:"creative_type"`
	CreativeURL   string   `json:"creative_url"`
	EndsAt        *string  `json:"ends_at"`
	CountryCode   string   `json:"country_code"`
}

func parseCampaignListFilter(r *http.Request) store.CampaignListFilter {
	return store.CampaignListFilter{
		Q:      strings.TrimSpace(r.URL.Query().Get("q")),
		Status: strings.TrimSpace(r.URL.Query().Get("status")),
	}
}

func (a *AdsAPI) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	list, total, err := a.Ads.ListByPublisherPaged(r.Context(), userID, params.Skip, params.Limit, parseCampaignListFilter(r))
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_list_failed")
		return
	}
	a.attachCampaignStatusLabels(list)
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"campaigns": list, "meta": meta})
}

func (a *AdsAPI) attachCampaignStatusLabels(list []store.AdCampaign) {
	if a == nil || a.Settings == nil || len(list) == 0 {
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		return
	}
	for i := range list {
		list[i].StatusLabel = store.StatusLabel(enums.CampaignStatusLabels, list[i].Status)
		list[i].CreativeTypeLabel = store.StatusLabel(enums.CreativeTypeLabels, list[i].CreativeType)
	}
}

func (a *AdsAPI) stampCampaignStatusLabel(c *store.AdCampaign) {
	if a == nil || a.Settings == nil || c == nil {
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		return
	}
	c.StatusLabel = store.StatusLabel(enums.CampaignStatusLabels, c.Status)
	c.CreativeTypeLabel = store.StatusLabel(enums.CreativeTypeLabels, c.CreativeType)
}

// campaignStatusDisplay returns the DB label for notification bodies (fail closed; no raw-code invent).
func (a *AdsAPI) campaignStatusDisplay(status string) string {
	if a == nil || a.Settings == nil {
		return ""
	}
	enums := a.Settings.ClientEnums()
	return store.StatusLabel(enums.CampaignStatusLabels, status)
}

// Get returns one campaign owned by the caller (notification deep-link / manage).
func (a *AdsAPI) Get(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	c, err := a.Ads.GetForPublisher(r.Context(), id, userID)
	if err != nil || c == nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	a.stampCampaignStatusLabel(c)
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	var body createAdBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Title == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_title_required")
		return
	}
	status := ""
	creativeType := strings.TrimSpace(body.CreativeType)
	if creativeType == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_creative_type_required")
		return
	}
	if a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			status = enums.DefaultCampaignStatus
			if !a.Settings.IsAllowedCreativeType(creativeType) {
				writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_creative_type")
				return
			}
		}
	}
	if status == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_campaign_defaults_unavailable")
		return
	}
	pinLat, pinLng, pinOK := extractGeoTargetPinCoords(body.GeoTargets)
	if !pinOK {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_map_pin_required")
		return
	}
	createFee, createCur, feeOK := a.campaignCreateFeeAt(r, pinLat, pinLng)
	if !feeOK || a.Payments == nil || createFee <= 0 || strings.TrimSpace(createCur) == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_pricing_unavailable")
		return
	}
	if body.DailySpendCap == nil || *body.DailySpendCap <= 0 {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_daily_spend_cap_required")
		return
	}
	payerCC := resolvePayerCountryFromRequest(r, a.Locate, a.Settings, pinLat, pinLng)
	if payerCC == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_map_locate_failed")
		return
	}
	if !requireCashGate(w, r, a.Cash, a.Users, a.Settings, payerCC) {
		return
	}
	var endsAt *time.Time
	if body.EndsAt != nil {
		raw := strings.TrimSpace(*body.EndsAt)
		if raw != "" {
			t, err := time.Parse(time.RFC3339, raw)
			if err != nil {
				writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_ends_at")
				return
			}
			utc := t.UTC()
			endsAt = &utc
		}
	}
	// Stamp geo target country from server reverse-geocode of the pin (ignore client country invent).
	geoTargets := stampAdGeoTargetsCountry(body.GeoTargets, payerCC)
	if len(geoTargets) == 0 {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_map_pin_required")
		return
	}
	c, err := a.Ads.Create(r.Context(), store.CreateAdInput{
		PublisherID:   userID,
		Title:         body.Title,
		Status:        status,
		DailySpendCap: body.DailySpendCap,
		GeoTargets:    geoTargets,
		CreativeType:  creativeType,
		CreativeURL:   body.CreativeURL,
		EndsAt:        endsAt,
	})
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_create_failed")
		return
	}
	if err := a.Payments.SettleCampaignCreateFee(r.Context(), userID, createFee, createCur, c.ID); err != nil {
		if delErr := a.Ads.DeleteOwned(r.Context(), c.ID, userID); delErr != nil {
			writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_rollback_failed")
			return
		}
		msg := ""
		if a.Settings != nil {
			rt := a.Settings.AdRuntimeChrome()
			msg = strings.TrimSpace(rt.InsufficientCampaignCreateFee)
		}
		if msg == "" {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_insufficient_balance")
			return
		}
		writeJSON(w, http.StatusPaymentRequired, map[string]any{
			"error":    msg,
			"balance":  a.Payments.WalletBalance(r.Context(), userID, createCur),
			"currency": createCur,
		})
		return
	}
	if a.DB != nil && a.DB.Ready() && userID != "" {
		if statusLabel := a.campaignStatusDisplay(c.Status); statusLabel != "" {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, userID, notifications.KindPlayerCampaignStatus,
				"campaign_created:"+c.ID, c.ID, c.Title, statusLabel)
		}
	}
	a.stampCampaignStatusLabel(c)
	writeJSON(w, http.StatusCreated, c)
}

type statusBody struct {
	Status string `json:"status"`
}

type patchCampaignTitleBody struct {
	Title string `json:"title"`
}

// UpdateTitle lets the publisher rename a campaign while it is still editable.
func (a *AdsAPI) UpdateTitle(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var body patchCampaignTitleBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Title) == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_title_required")
		return
	}
	archived := a.archivedStatus()
	c, err := a.Ads.UpdateTitle(r.Context(), id, userID, body.Title, archived)
	if err != nil {
		if err == store.ErrCampaignTitleLocked {
			msg := ""
			if a.Settings != nil {
				msg = strings.TrimSpace(a.Settings.AdRuntimeChromeString("patch_title_locked"))
			}
			if msg == "" {
				writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "playback_unavailable")
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) SetStatus(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var body statusBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_status_required")
		return
	}
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" || !a.Settings.IsAllowedCampaignStatus(body.Status) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_status")
		return
	}
	c, err := a.Ads.SetStatus(r.Context(), id, userID, body.Status)
	if err != nil {
		if err == store.ErrInvalidAdStatus {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_status")
			return
		}
		if err == store.ErrCampaignCannotReopen {
			writeAdsErr(w, a.Settings, http.StatusConflict, "err_campaign_cannot_reopen")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	if a.Geo != nil {
		servable := ""
		if a.Settings != nil {
			enums := a.Settings.ClientEnums()
			if enums.Source == "database" {
				servable = enums.ServableCampaignStatus
			}
		}
		if servable != "" && c.Status == servable {
			a.Geo.IndexCampaign(r.Context(), c)
		} else {
			a.Geo.RemoveCampaign(r.Context(), c)
		}
	}
	if a.DB != nil && a.DB.Ready() && c != nil && c.PublisherID != "" {
		if statusLabel := a.campaignStatusDisplay(c.Status); statusLabel != "" {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, c.PublisherID, notifications.KindPlayerCampaignStatus,
				"campaign_status:"+c.ID+":"+c.Status, c.ID, c.Title, statusLabel)
		}
	}
	a.stampCampaignStatusLabel(c)
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) archivedStatus() string {
	if a.Settings == nil {
		return ""
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		return ""
	}
	return strings.TrimSpace(enums.ArchivedCampaignStatus)
}

func (a *AdsAPI) reopenStatus() string {
	if a.Settings == nil {
		return ""
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		return ""
	}
	if s := strings.TrimSpace(enums.ReopenCampaignStatus); s != "" {
		return s
	}
	return strings.TrimSpace(enums.DefaultCampaignStatus)
}

// Close archives the publisher's campaign (manual; can reopen unless later auto-closed).
// Delete permanently removes a publisher-owned campaign with no delivery history.
// Campaigns with impressions/clicks must be archived instead. Create fee is not refunded.
func (a *AdsAPI) Delete(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	c, err := a.Ads.GetForPublisher(r.Context(), id, userID)
	if err != nil || c == nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	if c.AutoClosed {
		writeAdsErr(w, a.Settings, http.StatusConflict, "err_delete_auto_closed")
		return
	}
	if c.Impressions > 0 || c.Clicks > 0 {
		writeAdsErr(w, a.Settings, http.StatusConflict, "err_delete_has_delivery")
		return
	}
	if a.Geo != nil {
		a.Geo.RemoveCampaign(r.Context(), c)
	}
	if err := a.Ads.DeleteOwned(r.Context(), id, userID); err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (a *AdsAPI) Close(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	archived := a.archivedStatus()
	if archived == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_campaign_defaults_unavailable")
		return
	}
	c, err := a.Ads.CloseForPublisher(r.Context(), id, userID, archived)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	if a.Geo != nil {
		a.Geo.RemoveCampaign(r.Context(), c)
	}
	if a.DB != nil && a.DB.Ready() && c != nil && c.PublisherID != "" {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, c.PublisherID, notifications.KindPlayerCampaignClosed,
			"campaign_closed:"+c.ID, c.ID, c.Title)
		if a.Settings != nil {
			roles := a.Settings.ClientEnums().ConsoleRoles
			notifications.EmitAdmins(r.Context(), a.DB.Pool, roles, notifications.KindAdminCampaignClosed,
				"admin_campaign_closed:"+c.ID, c.ID, c.Title)
		}
	}
	a.stampCampaignStatusLabel(c)
	writeJSON(w, http.StatusOK, c)
}

// Reopen restores a manually closed campaign. Auto-closed campaigns cannot reopen.
func (a *AdsAPI) Reopen(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	archived := a.archivedStatus()
	reopenTo := a.reopenStatus()
	if archived == "" || reopenTo == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_campaign_defaults_unavailable")
		return
	}
	c, err := a.Ads.ReopenForPublisher(r.Context(), id, userID, archived, reopenTo)
	if err != nil {
		if err == store.ErrCampaignCannotReopen {
			writeAdsErr(w, a.Settings, http.StatusConflict, "err_cannot_reopen")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	a.stampCampaignStatusLabel(c)
	if a.DB != nil && a.DB.Ready() && c != nil && c.PublisherID != "" {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, c.PublisherID, notifications.KindPlayerCampaignReopened,
			"campaign_reopened:"+c.ID, c.ID, c.Title)
		if a.Settings != nil {
			roles := a.Settings.ClientEnums().ConsoleRoles
			notifications.EmitAdmins(r.Context(), a.DB.Pool, roles, notifications.KindAdminCampaignReopened,
				"admin_campaign_reopened:"+c.ID, c.ID, c.Title)
		}
	}
	writeJSON(w, http.StatusOK, c)
}

type attachVideoBody struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Async       bool   `json:"async"`
}

func (a *AdsAPI) AttachYouTubeUpload(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
		return
	}
	var body attachVideoBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Title) == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_title_required")
		return
	}
	body.Title = strings.TrimSpace(body.Title)
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_campaign_defaults_unavailable")
		return
	}
	videoCreative := a.Settings.ClientEnums().VideoCreativeType
	if !a.Settings.IsAllowedCreativeType(videoCreative) {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_video_creative_unavailable")
		return
	}
	if body.Async && a.Worker != nil {
		jobID := uuid.NewString()
		err := a.Worker.Enqueue(r.Context(), youtube.UploadJob{
			JobID:       jobID,
			CampaignID:  id,
			PublisherID: userID,
			Title:       body.Title,
			Description: body.Description,
		})
		if err != nil {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_video_queue_failed")
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{
			"status":      "queued",
			"job_id":      jobID,
			"campaign_id": id,
		})
		return
	}
	result, err := a.YT.UploadVideo(r.Context(), body.Title, body.Description, "")
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_video_upload_failed")
		return
	}
	c, err := a.Ads.AttachYouTube(r.Context(), id, userID, result.VideoID, videoCreative)
	if err != nil {
		if errors.Is(err, store.ErrCampaignAutoClosed) {
			writeAdsErr(w, a.Settings, http.StatusConflict, "err_campaign_auto_closed")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"campaign": c,
		"upload": map[string]any{
			"video_id": result.VideoID,
		},
	})
}

func (a *AdsAPI) Serve(w http.ResponseWriter, r *http.Request) {
	// Optional device GPS for Nominatim; country/region/city always server-resolved
	// (ignore client country/region/district spoof - reference pay-geo parity).
	var lat, lng float64
	if latS := strings.TrimSpace(r.URL.Query().Get("lat")); latS != "" {
		if v, err := strconv.ParseFloat(latS, 64); err == nil {
			lat = v
		}
	}
	if lngS := strings.TrimSpace(r.URL.Query().Get("lng")); lngS != "" {
		if v, err := strconv.ParseFloat(lngS, 64); err == nil {
			lng = v
		}
	}
	country, region, district := "", "", ""
	var latPtr, lngPtr *float64
	if a.Locate != nil {
		res, err := a.Locate.Resolve(
			r.Context(),
			"",
			false,
			lat,
			lng,
			geo.ClientIP(r),
			privateDefaultFromSettings(a.Settings),
		)
		if err == nil && res != nil {
			country = strings.ToUpper(strings.TrimSpace(res.CountryCode))
			region = strings.TrimSpace(res.Region)
			district = strings.TrimSpace(res.City)
			if res.Latitude != 0 || res.Longitude != 0 {
				la, ln := res.Latitude, res.Longitude
				latPtr, lngPtr = &la, &ln
			}
		}
	}
	if lat != 0 || lng != 0 {
		la, ln := lat, lng
		latPtr, lngPtr = &la, &ln
	}
	var campaigns []store.AdCampaign
	if a.Geo != nil {
		if latPtr != nil && lngPtr != nil {
			campaigns = a.Geo.MatchCoords(r.Context(), country, region, district, latPtr, lngPtr)
		} else {
			campaigns = a.Geo.Match(r.Context(), country, region, district)
		}
	} else {
		servable := ""
		if a.Settings != nil {
			enums := a.Settings.ClientEnums()
			if enums.Source == "database" {
				servable = enums.ServableCampaignStatus
			}
		}
		if servable == "" {
			writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_servable_status_unavailable")
			return
		}
		list, err := a.Ads.ListActive(r.Context(), servable)
		if err != nil {
			writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_serve_failed")
			return
		}
		campaigns = list
	}
	unitCost, ok := a.impressionUnitCost()
	if !ok {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_pricing_unavailable")
		return
	}
	eligible := make([]store.AdCampaign, 0, len(campaigns))
	now := time.Now().UTC()
	for _, c := range campaigns {
		counts, err := a.Ads.CountImpressionsByPeriod(r.Context(), c.ID, now)
		if err != nil {
			continue
		}
		if c.WithinDailySpendCap(unitCost, counts.Day) {
			eligible = append(eligible, c)
		}
	}
	// Public ad serve: creative only. No publisher ids, spend caps, or geo targeting internals.
	public := make([]map[string]any, 0, len(eligible))
	for _, c := range eligible {
		public = append(public, campaignPublicCreativeFields(c))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"country":   country,
		"region":    region,
		"district":  district,
		"campaigns": public,
	})
}

type impressionBody struct {
	ViewerKey string `json:"viewer_key"`
	Placement string `json:"placement"`
}

func (a *AdsAPI) Impression(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	unitCost, ok := a.impressionUnitCost()
	if !ok {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_pricing_unavailable")
		return
	}
	viewerKey := strings.TrimSpace(r.Header.Get("X-Device-Id"))
	var body impressionBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
		return
	}
	if strings.TrimSpace(body.ViewerKey) != "" {
		viewerKey = strings.TrimSpace(body.ViewerKey)
	}
	placement := strings.TrimSpace(body.Placement)
	if placement == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_placement_required")
		return
	}
	if a.Settings == nil {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_player_chrome_unavailable")
		return
	}
	pc := a.Settings.AdPlayerChrome()
	if pc.Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_player_chrome_unavailable")
		return
	}
	if placement != pc.PlacementLobby && placement != pc.PlacementInMatch {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_placement")
		return
	}
	if a.Settings.ClientEnums().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_campaign_defaults_unavailable")
		return
	}
	servable := a.Settings.ClientEnums().ServableCampaignStatus
	if servable == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_servable_status_unavailable")
		return
	}
	requireSchedule := placement == pc.PlacementInMatch
	if err := a.Ads.RecordImpressionWithPlacement(r.Context(), id, unitCost, viewerKey, placement, servable, requireSchedule); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_validation_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "recorded"})
}

// Playback returns global ad_playback + chrome labels (DB only, fail closed).
func (a *AdsAPI) Playback(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_playback_unavailable")
		return
	}
	pb := a.Settings.AdPlayback()
	if pb.Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_playback_unavailable")
		return
	}
	player := a.Settings.AdPlayerChrome()
	if player.Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_player_chrome_unavailable")
		return
	}
	rt := a.Settings.AdRuntimeChrome()
	if rt.Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_runtime_chrome_unavailable")
		return
	}
	scheduleChrome := map[string]any{
		"schedule_enabled_label":              rt.ScheduleEnabledLabel,
		"non_skippable_label":                 rt.NonSkippableLabel,
		"first_show_label":                    rt.FirstShowLabel,
		"interval_label":                      rt.IntervalLabel,
		"daily_cap_label":                     rt.DailyCapLabel,
		"weekly_cap_label":                    rt.WeeklyCapLabel,
		"monthly_cap_label":                   rt.MonthlyCapLabel,
		"yearly_cap_label":                    rt.YearlyCapLabel,
		"platform_default_placeholder":        rt.PlatformDefaultPlaceholder,
		"unlimited_cap_placeholder":           rt.UnlimitedCapPlaceholder,
		"save_campaign_schedule_action":       rt.SaveCampaignScheduleAction,
		"publisher_page_title":                rt.PublisherPageTitle,
		"publisher_page_body":                 rt.PublisherPageBody,
		"toast_schedule_saved":                rt.ToastScheduleSaved,
		"toast_save_failed":                   rt.ToastSaveFailed,
		"toast_campaign_created":              rt.ToastCampaignCreated,
		"toast_campaign_status_updated":       rt.ToastCampaignStatusUpdated,
		"toast_campaign_title_saved":          rt.ToastCampaignTitleSaved,
		"toast_creative_replaced":             rt.ToastCreativeReplaced,
		"toast_video_attached":                rt.ToastVideoAttached,
		"video_upload_job_title":              rt.VideoUploadJobTitle,
		"ph_title":                            rt.PhTitle,
		"save_action":                         rt.SaveAction,
		"patch_title_locked":                  rt.PatchTitleLocked,
		"ph_country":                          rt.PhCountry,
		"ph_region":                           rt.PhRegion,
		"ph_district":                         rt.PhDistrict,
		"ph_lat":                              rt.PhLat,
		"ph_lng":                              rt.PhLng,
		"ph_daily_spend_cap":                  rt.PhDailySpendCap,
		"daily_spend_cap_label":               rt.DailySpendCapLabel,
		"daily_spend_cap_suffix":              rt.DailySpendCapSuffix,
		"close_campaign_action":               rt.CloseCampaignAction,
		"reopen_campaign_action":              rt.ReopenCampaignAction,
		"cannot_reopen_campaign_blurb":        rt.CannotReopenCampaignBlurb,
		"toast_campaign_closed":               rt.ToastCampaignClosed,
		"toast_campaign_reopened":             rt.ToastCampaignReopened,
		"toast_campaign_close_failed":         rt.ToastCampaignCloseFailed,
		"toast_campaign_reopen_failed":        rt.ToastCampaignReopenFailed,
		"auto_closed_badge":                   rt.AutoClosedBadge,
		"ends_at_label":                       rt.EndsAtLabel,
		"ends_at_blurb":                       rt.EndsAtBlurb,
		"ph_ends_at":                          rt.PhEndsAt,
		"create_action":                       rt.CreateAction,
		"create_pending":                      rt.CreatePending,
		"replace_creative_action":             rt.ReplaceCreativeAction,
		"replace_creative_pending":            rt.ReplaceCreativePending,
		"attach_video_action":                 rt.AttachVideoAction,
		"attach_video_pending":                rt.AttachVideoPending,
		"update_status_pending":               rt.UpdateStatusPending,
		"save_pending":                        rt.SavePending,
		"save_campaign_schedule_pending":      rt.SaveCampaignSchedulePending,
		"thumbnail_upload_pending":            rt.ThumbnailUploadPending,
		"gallery_upload_pending":              rt.GalleryUploadPending,
		"publisher_no_campaigns":              rt.PublisherNoCampaigns,
		"creative_url_prompt":                 rt.CreativeURLPrompt,
		"creative_url_required":               rt.CreativeURLRequired,
		"stats_impressions_suffix":            rt.StatsImpressionsSuffix,
		"stats_reach_suffix":                  rt.StatsReachSuffix,
		"stats_clicks_suffix":                 rt.StatsClicksSuffix,
		"video_attached_suffix":               rt.VideoAttachedSuffix,
		"daily_cap_suffix":                    rt.DailyCapSuffix,
		"publisher_dash_title":                rt.PublisherDashTitle,
		"publisher_dash_body":                 rt.PublisherDashBody,
		"publisher_dash_load_failed":          rt.PublisherDashLoadFailed,
		"publisher_stat_impressions":          rt.PublisherStatImpressions,
		"publisher_stat_reach":                rt.PublisherStatReach,
		"publisher_stat_clicks":               rt.PublisherStatClicks,
		"publisher_stat_ctr":                  rt.PublisherStatCtr,
		"publisher_stat_cpc":                  rt.PublisherStatCpc,
		"publisher_stat_completion":           rt.PublisherStatCompletion,
		"publisher_stat_create_fee":           rt.PublisherStatCreateFee,
		"publisher_stat_source_note":          rt.PublisherStatSourceNote,
		"publisher_campaigns_heading":         rt.PublisherCampaignsHeading,
		"publisher_manage_campaigns":          rt.PublisherManageCampaigns,
		"publisher_manage_campaigns_href":     rt.PublisherManageCampaignsHref,
		"publisher_analytics_title":           rt.PublisherAnalyticsTitle,
		"publisher_analytics_body":            rt.PublisherAnalyticsBody,
		"publisher_pricing_unavailable":       rt.PublisherPricingUnavailable,
		"publisher_invoice_action":            rt.PublisherInvoiceAction,
		"publisher_invoice_pending":           rt.PublisherInvoicePending,
		"publisher_invoice_failed":            rt.PublisherInvoiceFailed,
		"publisher_invoice_filename":          rt.PublisherInvoiceFilename,
		"publisher_portal_wallet_label":       rt.PublisherPortalWalletLabel,
		"publisher_portal_receipts_label":     rt.PublisherPortalReceiptsLabel,
		"publisher_portal_transactions_label": rt.PublisherPortalTransactionsLabel,
		"publisher_portal_overview_label":     rt.PublisherPortalOverviewLabel,
		"publisher_portal_create_label":       rt.PublisherPortalCreateLabel,
		"publisher_portal_section_title":      rt.PublisherPortalSectionTitle,
		"publisher_portal_wallet_href":        rt.PublisherPortalWalletHref,
		"publisher_portal_receipts_href":      rt.PublisherPortalReceiptsHref,
		"publisher_portal_transactions_href":  rt.PublisherPortalTransactionsHref,
		"publisher_portal_payout_label":       rt.PublisherPortalPayoutLabel,
		"publisher_portal_payout_href":        rt.PublisherPortalPayoutHref,
		"publisher_portal_payout_blurb":       rt.PublisherPortalPayoutBlurb,
		"publisher_portal_overview_href":      rt.PublisherPortalOverviewHref,
		"publisher_portal_create_href":        rt.PublisherPortalCreateHref,
		"campaign_create_fee_label":           rt.CampaignCreateFeeLabel,
		"campaign_create_fee_blurb":           rt.CampaignCreateFeeBlurb,
		"insufficient_campaign_create_fee":    rt.InsufficientCampaignCreateFee,
		"playback_unavailable":                rt.PlaybackUnavailable,
		"meta_separator":                      rt.MetaSeparator,
		"amount_currency_separator":           rt.AmountCurrencySeparator,
		"paren_open":                          rt.ParenOpen,
		"paren_close":                         rt.ParenClose,
		"thumbnail_label":                     rt.ThumbnailLabel,
		"gallery_label":                       rt.GalleryLabel,
		"gallery_add_action":                  rt.GalleryAddAction,
		"gallery_empty":                       rt.GalleryEmpty,
		"thumbnail_upload_action":             rt.ThumbnailUploadAction,
		"toast_thumbnail_saved":               rt.ToastThumbnailSaved,
		"toast_gallery_saved":                 rt.ToastGallerySaved,
		"media_upload_failed":                 rt.MediaUploadFailed,
		"gallery_max_slots":                   rt.GalleryMaxSlots,
		"gallery_slots_fmt":                   rt.GallerySlotsFmt,
		"thumbnail_main_badge":                rt.ThumbnailMainBadge,
		"thumbnail_empty_hint":                rt.ThumbnailEmptyHint,
		"thumbnail_hint":                      rt.ThumbnailHint,
		"gallery_limit_reached":               rt.GalleryLimitReached,
		"list_page_size":                      rt.ListPageSize,
		"empty_value":                         rt.EmptyValue,
		"cancel_action":                       rt.CancelAction,
		"dialog_close_label":                  rt.DialogCloseLabel,
		"search_campaigns_label":              rt.SearchCampaignsLabel,
		"search_campaigns_placeholder":        rt.SearchCampaignsPlaceholder,
		"filter_status_label":                 rt.FilterStatusLabel,
		"filter_status_all":                   rt.FilterStatusAll,
		"view_action":                         rt.ViewAction,
		"edit_action":                         rt.EditAction,
		"status_label":                        rt.StatusLabel,
		"row_actions_label":                   rt.RowActionsLabel,
		"select_all_label":                    rt.SelectAllLabel,
		"select_row_label":                    rt.SelectRowLabel,
		"selected_count_fmt":                  rt.SelectedCountFmt,
		"clear_selection_action":              rt.ClearSelectionAction,
		"bulk_apply_status_action":            rt.BulkApplyStatusAction,
		"bulk_status_pending":                 rt.BulkStatusPending,
		"delete_campaign_action":              rt.DeleteCampaignAction,
		"delete_campaign_pending":             rt.DeleteCampaignPending,
		"delete_campaign_confirm_title":       rt.DeleteCampaignConfirmTitle,
		"delete_campaign_confirm_description": rt.DeleteCampaignConfirmDescription,
		"toast_campaign_deleted":              rt.ToastCampaignDeleted,
		"toast_campaign_delete_failed":        rt.ToastCampaignDeleteFailed,
		"err_delete_has_delivery":             rt.ErrDeleteHasDelivery,
		"err_delete_auto_closed":              rt.ErrDeleteAutoClosed,
		"err_daily_spend_cap_required":        rt.ErrDailySpendCapRequired,
		"daily_spend_cap_required_hint":       rt.DailySpendCapRequiredHint,
		"publisher_portal_transfer_label":     rt.PublisherPortalTransferLabel,
		"publisher_portal_transfer_href":      rt.PublisherPortalTransferHref,
		"map_location_section_title":          rt.MapLocationSectionTitle,
		"map_pin_empty":                       rt.MapPinEmpty,
		"map_use_device_location":             rt.MapUseDeviceLocation,
		"map_clear_pin":                       rt.MapClearPin,
		"map_helper_text":                     rt.MapHelperText,
		"map_geolocation_unavailable":         rt.MapGeolocationUnavailable,
		"map_geolocation_failed":              rt.MapGeolocationFailed,
		"map_pin_required":                    rt.MapPinRequired,
		"map_pin_coords_fmt":                  rt.MapPinCoordsFmt,
		"map_listings_count_fmt":              rt.MapListingsCountFmt,
		"map_locate_failed":                   rt.MapLocateFailed,
	}
	for k, v := range viewportChromeKeys(a.Settings) {
		scheduleChrome[k] = v
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"non_skippable_seconds":         pb.NonSkippableSeconds,
		"first_show_after_game_seconds": pb.FirstShowAfterGameSeconds,
		"default_interval_seconds":      pb.DefaultIntervalSeconds,
		"non_skippable_min":             pb.NonSkippableMin,
		"non_skippable_max":             pb.NonSkippableMax,
		"first_show_min":                pb.FirstShowMin,
		"first_show_max":                pb.FirstShowMax,
		"interval_min":                  pb.IntervalMin,
		"interval_max":                  pb.IntervalMax,
		"impression_cap_min":            pb.ImpressionCapMin,
		"player_chrome":                 player,
		"schedule_chrome":               scheduleChrome,
	})
}

type inMatchEligibilityBody struct {
	GameElapsedSeconds int      `json:"game_elapsed_seconds"`
	SecondsSinceLastAd *int     `json:"seconds_since_last_ad"`
	ViewerKey          string   `json:"viewer_key"`
	Country            string   `json:"country"`
	Region             string   `json:"region"`
	District           string   `json:"district"`
	Lat                *float64 `json:"lat"`
	Lng                *float64 `json:"lng"`
}

// InMatchEligibility decides whether an in-match ad should show now (Meta/YT-style frequency + caps).
func (a *AdsAPI) InMatchEligibility(w http.ResponseWriter, r *http.Request) {
	var body inMatchEligibilityBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
		return
	}
	if body.GameElapsedSeconds < 0 {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_game_elapsed_required")
		return
	}
	if a.Settings == nil || a.Settings.AdPlayback().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_playback_unavailable")
		return
	}
	unitCost, ok := a.impressionUnitCost()
	if !ok {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_pricing_unavailable")
		return
	}
	servable := ""
	enums := a.Settings.ClientEnums()
	if enums.Source == "database" {
		servable = enums.ServableCampaignStatus
	}
	if servable == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_servable_status_unavailable")
		return
	}

	// Server geo only (ignore body.Country/Region/District spoof).
	var lat, lng float64
	if body.Lat != nil {
		lat = *body.Lat
	}
	if body.Lng != nil {
		lng = *body.Lng
	}
	country, region, district := "", "", ""
	var latPtr, lngPtr *float64
	if a.Locate != nil {
		res, err := a.Locate.Resolve(
			r.Context(),
			"",
			false,
			lat,
			lng,
			geo.ClientIP(r),
			privateDefaultFromSettings(a.Settings),
		)
		if err == nil && res != nil {
			country = strings.ToUpper(strings.TrimSpace(res.CountryCode))
			region = strings.TrimSpace(res.Region)
			district = strings.TrimSpace(res.City)
			if res.Latitude != 0 || res.Longitude != 0 {
				la, ln := res.Latitude, res.Longitude
				latPtr, lngPtr = &la, &ln
			}
		}
	}
	if lat != 0 || lng != 0 {
		la, ln := lat, lng
		latPtr, lngPtr = &la, &ln
	}
	var geoMatched []store.AdCampaign
	if a.Geo != nil {
		if latPtr != nil && lngPtr != nil {
			geoMatched = a.Geo.MatchCoords(r.Context(), country, region, district, latPtr, lngPtr)
		} else {
			geoMatched = a.Geo.Match(r.Context(), country, region, district)
		}
	} else {
		list, err := a.Ads.ListActive(r.Context(), servable)
		if err != nil {
			writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_list_failed")
			return
		}
		geoMatched = list
	}

	scheduled, err := a.Ads.ListScheduleEnabled(r.Context(), servable)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_schedule_list_failed")
		return
	}
	schedIDs := map[string]store.AdCampaign{}
	for _, c := range scheduled {
		schedIDs[c.ID] = c
	}

	now := time.Now().UTC()
	pb := a.Settings.AdPlayback()
	soonestRetry := pb.DefaultIntervalSeconds
	blockReason := "no_eligible_campaign"
	var blockNonSkip, blockFirst, blockInterval int
	blockNonSkip = pb.NonSkippableSeconds
	blockFirst = pb.FirstShowAfterGameSeconds
	blockInterval = pb.DefaultIntervalSeconds

	for _, geo := range geoMatched {
		c, ok := schedIDs[geo.ID]
		if !ok {
			continue
		}
		counts, err := a.Ads.CountImpressionsByPeriod(r.Context(), c.ID, now)
		if err != nil {
			writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_caps_failed")
			return
		}
		if !c.WithinDailySpendCap(unitCost, counts.Day) {
			continue
		}
		nonSkip, firstShow, interval, err := a.Settings.EffectiveAdTiming(&c)
		if err != nil {
			writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_playback_unavailable")
			return
		}
		if !c.WithinPeriodCaps(counts) {
			wait := c.SecondsUntilPeriodCapReset(counts, now)
			if wait < 1 {
				wait = 1
			}
			if blockReason == "no_eligible_campaign" || wait < soonestRetry {
				soonestRetry = wait
				blockReason = "period_cap_reached"
				blockNonSkip, blockFirst, blockInterval = nonSkip, firstShow, interval
			}
			continue
		}
		if body.GameElapsedSeconds < firstShow {
			wait := firstShow - body.GameElapsedSeconds
			if wait < soonestRetry {
				soonestRetry = wait
				blockReason = "before_first_show"
				blockNonSkip, blockFirst, blockInterval = nonSkip, firstShow, interval
			}
			continue
		}
		if body.SecondsSinceLastAd != nil && *body.SecondsSinceLastAd < interval {
			wait := interval - *body.SecondsSinceLastAd
			if wait < soonestRetry {
				soonestRetry = wait
				blockReason = "interval_not_elapsed"
				blockNonSkip, blockFirst, blockInterval = nonSkip, firstShow, interval
			}
			continue
		}
		campaign := campaignPublicCreativeFields(c)
		writeJSON(w, http.StatusOK, map[string]any{
			"show":                     true,
			"campaign":                 campaign,
			"non_skippable_seconds":    nonSkip,
			"interval_seconds":         interval,
			"first_show_after_seconds": firstShow,
			"period_counts":            counts,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"show":                     false,
		"reason":                   blockReason,
		"next_check_after_seconds": soonestRetry,
		"non_skippable_seconds":    blockNonSkip,
		"interval_seconds":         blockInterval,
		"first_show_after_seconds": blockFirst,
	})
}

func (a *AdsAPI) ConsolePlaybackGet(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_playback_unavailable")
		return
	}
	pb := a.Settings.AdPlayback()
	chrome := a.Settings.AdRuntimeChrome()
	if pb.Source != "database" || chrome.Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_playback_unavailable")
		return
	}
	chromeDoc := map[string]any{}
	raw, _ := json.Marshal(chrome)
	_ = json.Unmarshal(raw, &chromeDoc)
	for k, v := range viewportChromeKeys(a.Settings) {
		chromeDoc[k] = v
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"playback": pb,
		"chrome":   chromeDoc,
	})
}

type playbackPutBody struct {
	NonSkippableSeconds       int `json:"non_skippable_seconds"`
	FirstShowAfterGameSeconds int `json:"first_show_after_game_seconds"`
	DefaultIntervalSeconds    int `json:"default_interval_seconds"`
}

func (a *AdsAPI) ConsolePlaybackPut(w http.ResponseWriter, r *http.Request) {
	var body playbackPutBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
		return
	}
	cfg := store.AdPlaybackConfig{
		NonSkippableSeconds:       body.NonSkippableSeconds,
		FirstShowAfterGameSeconds: body.FirstShowAfterGameSeconds,
		DefaultIntervalSeconds:    body.DefaultIntervalSeconds,
	}
	if err := a.Settings.SetAdPlayback(r.Context(), cfg); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_validation_failed")
		return
	}
	if a.Audit != nil {
		actor := auth.UserIDFromContext(r.Context())
		a.Audit.Log(r.Context(), &actor, "ads.playback.put", "platform_settings", "ad_playback", map[string]any{
			"non_skippable_seconds":         body.NonSkippableSeconds,
			"first_show_after_game_seconds": body.FirstShowAfterGameSeconds,
			"default_interval_seconds":      body.DefaultIntervalSeconds,
		})
	}
	writeJSON(w, http.StatusOK, a.Settings.AdPlayback())
}

// ConsoleGetCampaign returns one campaign for admin notification deep-links (?id= off current page).
func (a *AdsAPI) ConsoleGetCampaign(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil || a.Settings.AdRuntimeChrome().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_runtime_chrome_unavailable")
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	c, err := a.Ads.Get(r.Context(), id)
	if err != nil || c == nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	gallery := c.Gallery
	if gallery == nil {
		gallery = []string{}
	}
	row := map[string]any{
		"id":                       c.ID,
		"publisher_id":             c.PublisherID,
		"title":                    c.Title,
		"status":                   c.Status,
		"daily_spend_cap":          c.DailySpendCap,
		"creative_type":            c.CreativeType,
		"creative_url":             c.CreativeURL,
		"creative_desktop_url":     c.CreativeDesktopURL,
		"creative_tablet_url":      c.CreativeTabletURL,
		"creative_mobile_url":      c.CreativeMobileURL,
		"video_id":                 c.YouTubeVideoID,
		"video_id_desktop":         c.YouTubeVideoIDDesktop,
		"video_id_tablet":          c.YouTubeVideoIDTablet,
		"video_id_mobile":          c.YouTubeVideoIDMobile,
		"thumbnail_url":            c.ThumbnailURL,
		"gallery":                  gallery,
		"impressions":              c.Impressions,
		"clicks":                   c.Clicks,
		"schedule_enabled":         c.ScheduleEnabled,
		"first_show_after_seconds": c.FirstShowAfterSeconds,
		"interval_seconds":         c.IntervalSeconds,
		"non_skippable_seconds":    c.NonSkippableSeconds,
		"daily_impression_cap":     c.DailyImpressionCap,
		"weekly_impression_cap":    c.WeeklyImpressionCap,
		"monthly_impression_cap":   c.MonthlyImpressionCap,
		"yearly_impression_cap":    c.YearlyImpressionCap,
		"ends_at":                  c.EndsAt,
		"closed_at":                c.ClosedAt,
		"auto_closed":              c.AutoClosed,
		"created_at":               c.CreatedAt,
	}
	enums := a.Settings.ClientEnums()
	if label := store.StatusLabel(enums.CampaignStatusLabels, c.Status); label != "" {
		row["status_label"] = label
	}
	if label := store.StatusLabel(enums.CreativeTypeLabels, c.CreativeType); label != "" {
		row["creative_type_label"] = label
	}
	writeJSON(w, http.StatusOK, row)
}

func (a *AdsAPI) ConsoleListCampaigns(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil || a.Settings.AdRuntimeChrome().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_runtime_chrome_unavailable")
		return
	}
	pbLimit := a.Settings.AdPlayback()
	if pbLimit.Source != "database" || pbLimit.ConsoleCampaignsLimit < 1 {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_playback_unavailable")
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	if params.Limit > pbLimit.ConsoleCampaignsLimit {
		params.Limit = pbLimit.ConsoleCampaignsLimit
	}
	list, total, err := a.Ads.ListAllPaged(r.Context(), params.Skip, params.Limit, parseCampaignListFilter(r))
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_list_failed")
		return
	}
	// Include publisher_id for console only.
	rows := make([]map[string]any, 0, len(list))
	for _, c := range list {
		gallery := c.Gallery
		if gallery == nil {
			gallery = []string{}
		}
		row := map[string]any{
			"id":                       c.ID,
			"publisher_id":             c.PublisherID,
			"title":                    c.Title,
			"status":                   c.Status,
			"daily_spend_cap":          c.DailySpendCap,
			"creative_type":            c.CreativeType,
			"creative_url":             c.CreativeURL,
			"creative_desktop_url":     c.CreativeDesktopURL,
			"creative_tablet_url":      c.CreativeTabletURL,
			"creative_mobile_url":      c.CreativeMobileURL,
			"video_id":                 c.YouTubeVideoID,
			"video_id_desktop":         c.YouTubeVideoIDDesktop,
			"video_id_tablet":          c.YouTubeVideoIDTablet,
			"video_id_mobile":          c.YouTubeVideoIDMobile,
			"thumbnail_url":            c.ThumbnailURL,
			"gallery":                  gallery,
			"impressions":              c.Impressions,
			"clicks":                   c.Clicks,
			"schedule_enabled":         c.ScheduleEnabled,
			"first_show_after_seconds": c.FirstShowAfterSeconds,
			"interval_seconds":         c.IntervalSeconds,
			"non_skippable_seconds":    c.NonSkippableSeconds,
			"daily_impression_cap":     c.DailyImpressionCap,
			"weekly_impression_cap":    c.WeeklyImpressionCap,
			"monthly_impression_cap":   c.MonthlyImpressionCap,
			"yearly_impression_cap":    c.YearlyImpressionCap,
			"ends_at":                  c.EndsAt,
			"closed_at":                c.ClosedAt,
			"auto_closed":              c.AutoClosed,
			"created_at":               c.CreatedAt,
		}
		if a.Settings != nil {
			enums := a.Settings.ClientEnums()
			if label := store.StatusLabel(enums.CampaignStatusLabels, c.Status); label != "" {
				row["status_label"] = label
			}
			if label := store.StatusLabel(enums.CreativeTypeLabels, c.CreativeType); label != "" {
				row["creative_type_label"] = label
			}
		}
		rows = append(rows, row)
	}
	pb := a.Settings.AdPlayback()
	if pb.Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_playback_unavailable")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{
		"campaigns": rows,
		"meta":      meta,
		"chrome":    a.Settings.AdRuntimeChrome(),
		"bounds": map[string]any{
			"non_skippable_min":  pb.NonSkippableMin,
			"non_skippable_max":  pb.NonSkippableMax,
			"first_show_min":     pb.FirstShowMin,
			"first_show_max":     pb.FirstShowMax,
			"interval_min":       pb.IntervalMin,
			"interval_max":       pb.IntervalMax,
			"impression_cap_min": pb.ImpressionCapMin,
		},
	})
}

type scheduleBody struct {
	ScheduleEnabled       bool `json:"schedule_enabled"`
	FirstShowAfterSeconds *int `json:"first_show_after_seconds"`
	IntervalSeconds       *int `json:"interval_seconds"`
	NonSkippableSeconds   *int `json:"non_skippable_seconds"`
	DailyImpressionCap    *int `json:"daily_impression_cap"`
	WeeklyImpressionCap   *int `json:"weekly_impression_cap"`
	MonthlyImpressionCap  *int `json:"monthly_impression_cap"`
	YearlyImpressionCap   *int `json:"yearly_impression_cap"`
}

func (a *AdsAPI) validateScheduleOverrides(body scheduleBody) error {
	if a.Settings == nil {
		return fmt.Errorf("ad playback unavailable")
	}
	pb := a.Settings.AdPlayback()
	if pb.Source != "database" {
		return fmt.Errorf("ad playback unavailable")
	}
	if body.NonSkippableSeconds != nil {
		v := *body.NonSkippableSeconds
		if v < pb.NonSkippableMin || v > pb.NonSkippableMax {
			return fmt.Errorf("non_skippable_seconds must be between %d and %d", pb.NonSkippableMin, pb.NonSkippableMax)
		}
	}
	if body.FirstShowAfterSeconds != nil {
		v := *body.FirstShowAfterSeconds
		if v < pb.FirstShowMin || v > pb.FirstShowMax {
			return fmt.Errorf("first_show_after_seconds must be between %d and %d", pb.FirstShowMin, pb.FirstShowMax)
		}
	}
	if body.IntervalSeconds != nil {
		v := *body.IntervalSeconds
		if v < pb.IntervalMin || v > pb.IntervalMax {
			return fmt.Errorf("interval_seconds must be between %d and %d", pb.IntervalMin, pb.IntervalMax)
		}
	}
	for _, cap := range []*int{body.DailyImpressionCap, body.WeeklyImpressionCap, body.MonthlyImpressionCap, body.YearlyImpressionCap} {
		if cap != nil && *cap < pb.ImpressionCapMin {
			return fmt.Errorf("impression caps must be >= %d when set", pb.ImpressionCapMin)
		}
	}
	return nil
}

func (a *AdsAPI) ConsoleSetSchedule(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body scheduleBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
		return
	}
	if err := a.validateScheduleOverrides(body); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_validation_failed")
		return
	}
	c, err := a.Ads.UpdateSchedule(r.Context(), id, store.CampaignScheduleInput{
		ScheduleEnabled:       body.ScheduleEnabled,
		FirstShowAfterSeconds: body.FirstShowAfterSeconds,
		IntervalSeconds:       body.IntervalSeconds,
		NonSkippableSeconds:   body.NonSkippableSeconds,
		DailyImpressionCap:    body.DailyImpressionCap,
		WeeklyImpressionCap:   body.WeeklyImpressionCap,
		MonthlyImpressionCap:  body.MonthlyImpressionCap,
		YearlyImpressionCap:   body.YearlyImpressionCap,
	})
	if err != nil {
		if err == store.ErrNotFound {
			writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_validation_failed")
		return
	}
	if a.Audit != nil {
		actor := auth.UserIDFromContext(r.Context())
		a.Audit.Log(r.Context(), &actor, "ads.campaign.schedule", "ad_campaign", id, map[string]any{
			"schedule_enabled":         body.ScheduleEnabled,
			"first_show_after_seconds": body.FirstShowAfterSeconds,
			"interval_seconds":         body.IntervalSeconds,
			"non_skippable_seconds":    body.NonSkippableSeconds,
			"daily_impression_cap":     body.DailyImpressionCap,
			"weekly_impression_cap":    body.WeeklyImpressionCap,
			"monthly_impression_cap":   body.MonthlyImpressionCap,
			"yearly_impression_cap":    body.YearlyImpressionCap,
		})
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ConsoleSetStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body statusBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_status_required")
		return
	}
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" || !a.Settings.IsAllowedCampaignStatus(body.Status) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_status")
		return
	}
	c, err := a.Ads.SetStatusAdmin(r.Context(), id, body.Status)
	if err != nil {
		if err == store.ErrCampaignCannotReopen {
			writeAdsErr(w, a.Settings, http.StatusConflict, "err_campaign_cannot_reopen")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	if a.Geo != nil {
		servable := a.Settings.ClientEnums().ServableCampaignStatus
		if servable != "" && c.Status == servable {
			a.Geo.IndexCampaign(r.Context(), c)
		} else {
			a.Geo.RemoveCampaign(r.Context(), c)
		}
	}
	if a.Audit != nil {
		actor := auth.UserIDFromContext(r.Context())
		a.Audit.Log(r.Context(), &actor, "ads.campaign.status", "ad_campaign", id, map[string]any{"status": body.Status})
	}
	if a.DB != nil && a.DB.Ready() && c != nil && c.PublisherID != "" {
		if statusLabel := a.campaignStatusDisplay(c.Status); statusLabel != "" {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, c.PublisherID, notifications.KindPlayerCampaignStatus,
				"campaign_status:"+c.ID+":"+c.Status, c.ID, c.Title, statusLabel)
		}
	}
	a.stampCampaignStatusLabel(c)
	writeJSON(w, http.StatusOK, c)
}

// PublisherSetSchedule lets the campaign owner configure in-match schedule.
func (a *AdsAPI) PublisherSetSchedule(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var body scheduleBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
		return
	}
	if err := a.validateScheduleOverrides(body); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_validation_failed")
		return
	}
	c, err := a.Ads.UpdateScheduleForPublisher(r.Context(), id, userID, store.CampaignScheduleInput{
		ScheduleEnabled:       body.ScheduleEnabled,
		FirstShowAfterSeconds: body.FirstShowAfterSeconds,
		IntervalSeconds:       body.IntervalSeconds,
		NonSkippableSeconds:   body.NonSkippableSeconds,
		DailyImpressionCap:    body.DailyImpressionCap,
		WeeklyImpressionCap:   body.WeeklyImpressionCap,
		MonthlyImpressionCap:  body.MonthlyImpressionCap,
		YearlyImpressionCap:   body.YearlyImpressionCap,
	})
	if err != nil {
		if err == store.ErrNotFound {
			writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_validation_failed")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) Click(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.Ads.RecordClick(r.Context(), id); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_click_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "recorded"})
}

type creativeBody struct {
	CreativeType string `json:"creative_type"`
	CreativeURL  string `json:"creative_url"`
}

func (a *AdsAPI) ReplaceCreative(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
		return
	}
	var body creativeBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.CreativeURL) == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_creative_url_required")
		return
	}
	creativeType := strings.TrimSpace(body.CreativeType)
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_campaign_defaults_unavailable")
		return
	}
	if creativeType == "" {
		creativeType = a.Settings.ClientEnums().DefaultCreativeType
	}
	if !a.Settings.IsAllowedCreativeType(creativeType) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_creative_type")
		return
	}
	c, err := a.Ads.UpdateCreative(r.Context(), id, userID, creativeType, strings.TrimSpace(body.CreativeURL))
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) uploadCampaignImage(w http.ResponseWriter, r *http.Request) (userID, url string, ok bool) {
	userID = auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeAdsErr(w, a.Settings, http.StatusUnauthorized, "err_unauthorized")
		return "", "", false
	}
	if a.Avatars == nil {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_media_unavailable")
		return "", "", false
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_multipart")
		return "", "", false
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_file_required")
		return "", "", false
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_read_failed")
		return "", "", false
	}
	url, err = a.Avatars.UploadAdCreativeImage(userID, header.Filename, header.Header.Get("Content-Type"), data)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_media_upload_failed")
		return "", "", false
	}
	return userID, url, true
}

// UploadThumbnail accepts multipart file upload, stores media, and saves thumbnail_url.
func (a *AdsAPI) UploadThumbnail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID, url, ok := a.uploadCampaignImage(w, r)
	if !ok {
		return
	}
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
		return
	}
	c, err := a.Ads.UpdateThumbnail(r.Context(), id, userID, url)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// UploadGalleryImage accepts multipart file upload and appends the URL to gallery.
func (a *AdsAPI) UploadGalleryImage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID, url, ok := a.uploadCampaignImage(w, r)
	if !ok {
		return
	}
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
		return
	}
	c, err := a.Ads.AppendGalleryImage(r.Context(), id, userID, url)
	if err != nil {
		if errors.Is(err, store.ErrGalleryFull) {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "gallery_limit_reached")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// ClearThumbnail clears the campaign thumbnail.
func (a *AdsAPI) ClearThumbnail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := auth.UserIDFromContext(r.Context())
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
		return
	}
	c, err := a.Ads.ClearThumbnail(r.Context(), id, userID)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// RemoveGalleryImage removes one gallery slot by 0-based index.
func (a *AdsAPI) RemoveGalleryImage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := auth.UserIDFromContext(r.Context())
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
		return
	}
	idxRaw := strings.TrimSpace(chi.URLParam(r, "index"))
	index, err := strconv.Atoi(idxRaw)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
		return
	}
	c, err := a.Ads.RemoveGalleryAt(r.Context(), id, userID, index)
	if err != nil {
		if errors.Is(err, store.ErrGalleryIndex) {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) VideoComplete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.Ads.RecordVideoCompletion(r.Context(), id); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_completion_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "recorded"})
}
