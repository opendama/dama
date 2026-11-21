package rest

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/media"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"

	"github.com/go-chi/chi/v5"
)

type HostedEventsAPI struct {
	Events            *store.HostedEventStore
	Payments          *payments.Service
	Settings          *store.SettingsStore
	Flags             *store.FlagStore
	Users             *store.UserStore
	Cash              *store.CashRmgStore
	Docs              *store.KycDocumentStore
	Games             *gamestore.Store
	OfficialPause     *store.OfficialPauseStore
	Avatars           *media.AvatarService
	Hub               *ws.Hub
	DB                *db.Handle
	Locate            *geo.Resolver
	CompetitionPrizes *store.CompetitionPrizeStore
}

// resolvePayerCountry mirrors reference IP/GPS invent (no manual country / profile).
func (a *HostedEventsAPI) resolvePayerCountry(r *http.Request) string {
	return a.resolvePayerCountryAt(r, 0, 0)
}

// resolvePayerCountryAt optionally uses lat/lng (ads Pricing catalog parity for host-fee preview).
func (a *HostedEventsAPI) resolvePayerCountryAt(r *http.Request, lat, lng float64) string {
	return resolvePayerCountryFromRequest(r, a.Locate, a.Settings, lat, lng)
}

func (a *HostedEventsAPI) eventsEnabled(ctx context.Context) bool {
	if a.Flags == nil {
		return false
	}
	return a.Flags.Get(ctx).HostedEventsEnabled
}

func (a *HostedEventsAPI) requireEventsEnabled(w http.ResponseWriter, r *http.Request) bool {
	if a.eventsEnabled(r.Context()) {
		return true
	}
	msg := eventsOrganizerChromeString(a.Settings, r.Context(), "feature_disabled")
	if msg == "" {
		msg = eventsPlayerChromeString(a.Settings, r.Context(), "feature_disabled")
	}
	if msg == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "feature_disabled")
		return false
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": msg})
	return false
}

func (a *HostedEventsAPI) requireEnumsCatalog(w http.ResponseWriter, r *http.Request) (store.ClientEnumsConfig, store.EventsCatalogConfig, bool) {
	if a.Settings == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "feature_disabled")
		return store.ClientEnumsConfig{}, store.EventsCatalogConfig{}, false
	}
	// SQL migs (share path, QR prefix, visibility codes) must apply without process restart -
	// same pattern as ListClientNav / ListClientEnums.
	if err := a.Settings.ReloadEventsCatalog(r.Context()); err != nil {
		log.Printf("requireEnumsCatalog: ReloadEventsCatalog: %v", err)
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return store.ClientEnumsConfig{}, store.EventsCatalogConfig{}, false
	}
	if err := a.Settings.ReloadClientEnums(r.Context()); err != nil {
		log.Printf("requireEnumsCatalog: ReloadClientEnums: %v", err)
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return store.ClientEnumsConfig{}, store.EventsCatalogConfig{}, false
	}
	enums := a.Settings.ClientEnums()
	cat := a.Settings.EventsCatalog()
	if enums.Source != "database" || cat.Source != "database" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return store.ClientEnumsConfig{}, store.EventsCatalogConfig{}, false
	}
	return enums, cat, true
}

func eventsOrganizerChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.EventsOrganizerChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func eventsPlayerChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.EventsPlayerChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

func eventsAdminChromeString(settings *store.SettingsStore, ctx context.Context, key string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.EventsAdminChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return ""
	}
	v, _ := doc[key].(string)
	return strings.TrimSpace(v)
}

// writeEventsOrgErr writes a DB chrome error for organizer-facing hosted-events APIs (fail closed).
// Includes error_key so clients can map without parsing copy (player/admin parity).
func writeEventsOrgErr(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	msg := eventsOrganizerChromeString(settings, ctx, key)
	if msg == "" {
		msg = eventsOrganizerChromeString(settings, ctx, "events_organizer_chrome_unavailable")
		if key == "" {
			key = "events_organizer_chrome_unavailable"
		}
	}
	if msg == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "", "error_key": key})
		return
	}
	writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
}

// writeEventsPlayerErr writes a DB chrome error for player-facing hosted-events APIs (fail closed).
// Includes error_key (tournament enroll parity) so clients can map conflicts without parsing copy.
func writeEventsPlayerErr(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	msg := eventsPlayerChromeString(settings, ctx, key)
	if msg == "" {
		msg = eventsPlayerChromeString(settings, ctx, "events_player_chrome_unavailable")
		if key == "" {
			key = "events_player_chrome_unavailable"
		}
	}
	if msg == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "", "error_key": key})
		return
	}
	writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
}

// writeEventsAdminErr writes a DB chrome error for admin hosted-events APIs (fail closed).
// Includes error_key so admin SPA can map err_unlimited_arena_only (and peers) from DB chrome.
func writeEventsAdminErr(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	msg := eventsAdminChromeString(settings, ctx, key)
	if msg == "" {
		msg = eventsAdminChromeString(settings, ctx, "events_admin_chrome_unavailable")
		if key == "" {
			key = "events_admin_chrome_unavailable"
		}
	}
	if msg == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "", "error_key": key})
		return
	}
	writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
}

func reportStatusFromEnums(enums store.ClientEnumsConfig, want string) string {
	want = strings.TrimSpace(want)
	for _, st := range enums.HostedEventReportStatuses {
		if st == want {
			return st
		}
	}
	return ""
}

func (a *HostedEventsAPI) emitPool() bool {
	return a != nil && a.DB != nil && a.DB.Ready()
}

func (a *HostedEventsAPI) notifyEventAdmins(ctx context.Context, kind, dedupePrefix, hrefEntity, title string) {
	if !a.emitPool() || kind == "" || a.Settings == nil {
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" || len(enums.ConsoleRoles) == 0 {
		return
	}
	notifications.EmitAdmins(ctx, a.DB.Pool, enums.ConsoleRoles, kind, dedupePrefix, hrefEntity, title)
}

func (a *HostedEventsAPI) notifyEventPlayers(ctx context.Context, userIDs []string, kind, dedupePrefix, hrefEntity, title string) {
	if !a.emitPool() || kind == "" {
		return
	}
	seen := map[string]bool{}
	for _, uid := range userIDs {
		uid = strings.TrimSpace(uid)
		if uid == "" || seen[uid] {
			continue
		}
		seen[uid] = true
		dedupe := ""
		if dedupePrefix != "" {
			dedupe = dedupePrefix + ":" + uid
		}
		notifications.EmitPlayer(ctx, a.DB.Pool, uid, kind, dedupe, hrefEntity, title)
	}
}

func (a *HostedEventsAPI) publicEvent(ctx context.Context, e *store.HostedEvent, enums store.ClientEnumsConfig) map[string]any {
	if e == nil {
		return nil
	}
	_ = a.Events.AttachEntryCounts(ctx, e, enums.HostedEventEntryApproved, enums.HostedEventEntryPending)
	gallery := e.Gallery
	if gallery == nil {
		gallery = []string{}
	}
	out := map[string]any{
		"id":                           e.ID,
		"organizer_id":                 e.OrganizerID,
		"title":                        e.Title,
		"description":                  e.Description,
		"format_id":                    e.FormatID,
		"size_id":                      e.SizeID,
		"host_fee_amount":              e.HostFeeAmount,
		"host_fee_currency":            e.HostFeeCurrency,
		"host_paid_at":                 e.HostPaidAt,
		"entry_fee_amount":             e.EntryFeeAmount,
		"entry_fee_currency":           e.EntryFeeCurrency,
		"entry_fee_commission_percent": e.EntryFeeCommissionPercent,
		"is_free_entry":                e.IsFreeEntry,
		"auto_approve":                 e.AutoApprove,
		"visibility":                   e.Visibility,
		"join_code":                    e.JoinCode,
		"status":                       e.Status,
		"approved_count":               e.ApprovedCount,
		"pending_count":                e.PendingCount,
		"prize_image_url":              e.PrizeImageURL,
		"gallery":                      gallery,
		"created_at":                   e.CreatedAt,
		"updated_at":                   e.UpdatedAt,
	}
	// Emit present max even when < 2 (invalid orphan) so clients never treat omit as Unlimited.
	if e.MaxPlayers != nil {
		out["max_players"] = *e.MaxPlayers
	}
	if label := store.StatusLabel(enums.HostedEventStatusLabels, e.Status); label != "" {
		out["status_label"] = label
	}
	if label := store.StatusLabel(enums.HostedEventVisibilityLabels, e.Visibility); label != "" {
		out["visibility_label"] = label
	}
	if a.Settings != nil {
		cat := a.Settings.EventsCatalog()
		// Null Unlimited or high safety ceiling: clients label fill as Unlimited (DB chrome).
		if store.SeatCapRequiresArenaOnly(e.MaxPlayers, cat.SwissRoundsByMaxPlayers) {
			out["seat_cap_unlimited"] = true
		}
		if cat.Source == "database" {
			if f, ok := a.Settings.FindEventsCatalogFormat(e.FormatID); ok {
				if label := strings.TrimSpace(f.Label); label != "" {
					out["format_label"] = label
				}
			}
			if sz, ok := a.Settings.FindEventsCatalogSize(e.SizeID); ok {
				if label := strings.TrimSpace(sz.Label); label != "" {
					out["size_label"] = label
				}
			}
		}
	}
	if e.LogoURL != nil {
		out["logo_url"] = *e.LogoURL
	}
	if e.BrandColor != nil {
		out["brand_color"] = *e.BrandColor
	}
	if e.SponsorLogoURL != nil {
		out["sponsor_logo_url"] = *e.SponsorLogoURL
	}
	if e.SponsorName != nil {
		out["sponsor_name"] = *e.SponsorName
	}
	if e.WinnerID != nil {
		out["winner_id"] = *e.WinnerID
	}
	if e.CheckInOpensAt != nil {
		out["check_in_opens_at"] = *e.CheckInOpensAt
	}
	if e.CheckInClosesAt != nil {
		out["check_in_closes_at"] = *e.CheckInClosesAt
	}
	if e.StartedAt != nil {
		out["started_at"] = *e.StartedAt
	}
	if e.ArenaEndsAt != nil {
		out["arena_ends_at"] = *e.ArenaEndsAt
	}
	if e.ArenaDurationMinutes != nil {
		out["arena_duration_minutes"] = *e.ArenaDurationMinutes
	}
	if e.FinishedAt != nil {
		out["finished_at"] = *e.FinishedAt
	}
	if e.PrizeSettledAt != nil {
		out["prize_settled_at"] = *e.PrizeSettledAt
	}
	if e.DisputeWindowEndsAt != nil {
		out["dispute_window_ends_at"] = *e.DisputeWindowEndsAt
	}
	if e.CancelledAt != nil {
		out["cancelled_at"] = *e.CancelledAt
	}
	if share, err := a.shareURL(ctx, e.JoinCode); err == nil {
		out["share_url"] = share
	}
	a.attachPrizePool(ctx, out, e)
	if strings.TrimSpace(e.PrizePayoutMode) != "" || len(e.PrizePlacePercents) > 0 {
		attachPrizePayoutFields(out, e.PrizePayoutMode, e.PrizePlacePercents)
	}
	if e.StartedAt != nil && e.FinishedAt == nil {
		liveSt := strings.TrimSpace(enums.HostedEventBracketLive)
		if liveSt != "" {
			if m, err := a.Events.MapLiveGameIDsByEventIDs(ctx, []string{e.ID}, liveSt); err == nil {
				if gid := strings.TrimSpace(m[e.ID]); gid != "" {
					out["live_game_id"] = gid
				}
			}
		}
	}
	return out
}

// publicEventWithHost is publicEvent plus organizer trust/reputation stamps.
// Use for single-event create/patch/cancel/reopen/join responses. List endpoints
// keep batching via loadOrganizerCardsWithReputation + attachOrganizerCard.
func (a *HostedEventsAPI) publicEventWithHost(
	ctx context.Context,
	e *store.HostedEvent,
	enums store.ClientEnumsConfig,
) map[string]any {
	m := a.publicEvent(ctx, e, enums)
	if m == nil || e == nil {
		return m
	}
	orgCards := a.loadOrganizerCardsWithReputation(
		ctx, []string{e.OrganizerID},
		enums.HostedEventFinishedStatus, enums.HostedEventCancelledStatus, enums.HostedEventReportOpenStatus,
	)
	a.attachOrganizerCard(ctx, m, e.OrganizerID, orgCards)
	return m
}

// attachOrganizerCard adds host presence fields. When preloaded is set, uses that map (list batch).
func (a *HostedEventsAPI) attachOrganizerCard(
	ctx context.Context,
	out map[string]any,
	organizerID string,
	preloaded map[string]store.OrganizerPublicCard,
) {
	if out == nil {
		return
	}
	organizerID = strings.TrimSpace(organizerID)
	if organizerID == "" {
		return
	}
	var card store.OrganizerPublicCard
	var ok bool
	if preloaded != nil {
		card, ok = preloaded[organizerID]
	} else if a.Events != nil {
		m, err := a.Events.MapOrganizerPublicCards(ctx, []string{organizerID})
		if err == nil {
			card, ok = m[organizerID]
		}
	}
	if !ok {
		return
	}
	if u := strings.TrimSpace(card.Username); u != "" {
		out["organizer_username"] = u
	}
	if av := strings.TrimSpace(card.AvatarThumbURL); av != "" {
		out["organizer_avatar_url"] = av
	}
	if card.Rating > 0 {
		out["organizer_rating"] = card.Rating
	}
	out["organizer_phone_kyc_verified"] = card.PhoneKycVerified
	out["organizer_document_kyc_verified"] = card.DocumentKycVerified
	out["organizer_finished_paid_cups"] = card.FinishedPaidCups
	out["organizer_cancelled_paid_cups"] = card.CancelledPaidCups
	out["organizer_open_reports"] = card.OpenReports
	if a.Cash != nil {
		if tier, badge := a.Cash.HostTrust(card.PhoneKycVerified, card.DocumentKycVerified); tier != "" && badge != "" {
			out["organizer_host_trust_tier"] = tier
			out["organizer_host_trust_badge"] = badge
		}
	}
}

// loadOrganizerCardsWithReputation batches host presence + Layer D reputation stats.
func (a *HostedEventsAPI) loadOrganizerCardsWithReputation(
	ctx context.Context,
	orgIDs []string,
	finishedStatus, cancelledStatus, openReportStatus string,
) map[string]store.OrganizerPublicCard {
	orgCards, _ := a.Events.MapOrganizerPublicCards(ctx, orgIDs)
	if a.Events == nil || len(orgCards) == 0 {
		return orgCards
	}
	reps, err := a.Events.MapHostReputation(ctx, orgIDs, finishedStatus, cancelledStatus, openReportStatus)
	if err == nil {
		store.MergeHostReputation(orgCards, reps)
	}
	return orgCards
}

// enforcePaidHostOpsGates applies Layer B phone KYC + Layer D concurrent/reputation gates
// for paid create and paid reopen. Writes the response and returns false when blocked.
func (a *HostedEventsAPI) enforcePaidHostOpsGates(
	w http.ResponseWriter,
	r *http.Request,
	organizerID string,
	enums store.ClientEnumsConfig,
	checkPhoneKyc bool,
	infraErrKey string,
) bool {
	if a.Users == nil || a.Cash == nil || !a.Cash.Ready() || a.Events == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, infraErrKey)
		return false
	}
	hostUser, uErr := a.Users.GetByID(r.Context(), organizerID)
	if uErr != nil || hostUser == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, infraErrKey)
		return false
	}
	policy := a.Cash.Policy()
	if checkPhoneKyc && policy.HostPaidCreateRequiresPhoneKyc && hostUser.PhoneKycVerifiedAt == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_host_paid_requires_phone_kyc")
		return false
	}
	docVerified := hostUser.DocumentKycVerifiedAt != nil
	if !docVerified && a.Docs != nil {
		if okDoc, _ := a.Docs.HasApprovedDocument(r.Context(), organizerID, policy.DocumentKycApprovedStatus); okDoc {
			docVerified = true
		}
	}
	finishedSt := strings.TrimSpace(enums.HostedEventFinishedStatus)
	cancelledSt := strings.TrimSpace(enums.HostedEventCancelledStatus)
	if finishedSt == "" || cancelledSt == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, infraErrKey)
		return false
	}
	settledPaid, settledErr := a.Events.CountSettledPaidByOrganizer(r.Context(), organizerID, finishedSt)
	if settledErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, infraErrKey)
		return false
	}
	capN := policy.ConcurrentOpenPaidCap(docVerified, settledPaid)
	if capN < 1 {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, infraErrKey)
		return false
	}
	openPaid, openErr := a.Events.CountOpenPaidByOrganizer(r.Context(), organizerID, finishedSt, cancelledSt)
	if openErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, infraErrKey)
		return false
	}
	if openPaid >= capN {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_host_concurrent_open_paid_cap")
		return false
	}
	openReportSt := strings.TrimSpace(enums.HostedEventReportOpenStatus)
	if openReportSt == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, infraErrKey)
		return false
	}
	reps, repErr := a.Events.MapHostReputation(r.Context(), []string{organizerID}, finishedSt, cancelledSt, openReportSt)
	if repErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, infraErrKey)
		return false
	}
	rep := reps[organizerID]
	if policy.HostReputationBlocksPaidCreate(rep.FinishedPaidCups, rep.CancelledPaidCups, rep.OpenReports) {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_host_reputation_blocked")
		return false
	}
	return true
}

// stampOrganizerReputationFields adds Layer D host ops counts onto a response map.
func (a *HostedEventsAPI) stampOrganizerReputationFields(
	ctx context.Context,
	out map[string]any,
	organizerID string,
	enums store.ClientEnumsConfig,
) {
	if out == nil || a.Events == nil || strings.TrimSpace(organizerID) == "" {
		return
	}
	finishedSt := strings.TrimSpace(enums.HostedEventFinishedStatus)
	cancelledSt := strings.TrimSpace(enums.HostedEventCancelledStatus)
	openReportSt := strings.TrimSpace(enums.HostedEventReportOpenStatus)
	if finishedSt == "" || cancelledSt == "" || openReportSt == "" {
		return
	}
	reps, err := a.Events.MapHostReputation(ctx, []string{organizerID}, finishedSt, cancelledSt, openReportSt)
	if err != nil {
		return
	}
	rep := reps[organizerID]
	out["host_finished_paid_cups"] = rep.FinishedPaidCups
	out["host_cancelled_paid_cups"] = rep.CancelledPaidCups
	out["host_open_reports"] = rep.OpenReports
}

// attachPrizePool adds honest pot fields when the cup opted into display (paid only).
// Platform kill-switch must be on. now = max(entry organizer nets, held guarantee floor).
// if_full only when max_players >= 2 (= max(max seats x per-seat net, held guarantee)).
// After Start, now uses frozen amount. Host fee is never included.
// Fail closed: omit pot fields if live sum cannot be computed.
func (a *HostedEventsAPI) attachPrizePool(ctx context.Context, out map[string]any, e *store.HostedEvent) {
	if out == nil || e == nil || e.IsFreeEntry || !e.PrizePoolDisplayEnabled {
		return
	}
	if a.Flags == nil || !a.Flags.Get(ctx).PrizePoolDisplayEnabled {
		return
	}
	currency := strings.TrimSpace(e.EntryFeeCurrency)
	if currency == "" {
		return
	}
	guarantee := 0.0
	if e.PrizePoolGuaranteeEnabled && e.PrizePoolGuaranteeHeld && e.PrizePoolGuaranteeAmount > 0 {
		guarantee = payments.RoundMoney2(e.PrizePoolGuaranteeAmount)
	}
	_, perSeatNet := payments.SplitEntryFeeCommission(e.EntryFeeAmount, e.EntryFeeCommissionPercent)

	frozen := e.PrizePoolFrozenAmount != nil
	var now float64
	if frozen {
		now = payments.RoundMoney2(*e.PrizePoolFrozenAmount)
	} else {
		if a.Events == nil {
			return
		}
		sum, err := a.Events.SumEntryOrganizerNets(ctx, e.ID)
		if err != nil {
			return
		}
		now = payments.PrizePoolFloor(sum, guarantee)
	}

	out["prize_pool_display_enabled"] = true
	out["prize_pool_guarantee_enabled"] = e.PrizePoolGuaranteeEnabled
	out["prize_pool_guarantee_held"] = e.PrizePoolGuaranteeHeld
	out["prize_pool_guarantee_captured"] = e.PrizePoolGuaranteeCaptured
	// Amount only while held so clients cannot invent a Guaranteed line after release/capture.
	if e.PrizePoolGuaranteeHeld && e.PrizePoolGuaranteeAmount > 0 {
		out["prize_pool_guarantee_amount"] = payments.RoundMoney2(e.PrizePoolGuaranteeAmount)
	}
	out["prize_pool_currency"] = currency
	out["prize_pool_frozen"] = frozen
	out["prize_pool_now"] = now
	// Honest if-full only for classic fixed caps (not null Unlimited / high safety ceiling).
	var swiss map[string]int
	if a.Settings != nil {
		swiss = a.Settings.EventsCatalog().SwissRoundsByMaxPlayers
	}
	if store.HasPlayerCap(e.MaxPlayers) && !store.SeatCapRequiresArenaOnly(e.MaxPlayers, swiss) {
		out["prize_pool_if_full"] = payments.PrizePoolFloor(float64(*e.MaxPlayers)*perSeatNet, guarantee)
	}
	if frozen && e.PrizePoolFrozenAt != nil {
		out["prize_pool_frozen_at"] = *e.PrizePoolFrozenAt
	}
}

func (a *HostedEventsAPI) shareURL(ctx context.Context, code string) (string, error) {
	if a.Settings == nil {
		return "", errors.New("settings unavailable")
	}
	cat := a.Settings.EventsCatalog()
	if cat.Source != "database" {
		return "", errors.New("catalog unavailable")
	}
	origin, err := a.Settings.PlayRailWebAppOrigin(ctx)
	if err != nil || strings.TrimSpace(origin) == "" {
		return "", errors.New("web_app_origin unavailable")
	}
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return "", errors.New("join code empty")
	}
	tpl := strings.TrimSpace(cat.SharePathTemplate)
	if tpl == "" || !strings.Contains(tpl, "{code}") {
		return "", errors.New("share_path_template unavailable")
	}
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	path := strings.ReplaceAll(communityInviteSharePathTemplate(tpl), "{code}", code)
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	path = communityInviteSharePath(path, code)
	// Never return bare origin "/" - that opens the home page instead of an invite.
	if path == "/" || !strings.Contains(strings.ToUpper(path), code) {
		return "", errors.New("share path incomplete")
	}
	return origin + path, nil
}

// communityInviteSharePathTemplate remaps legacy Event-browse templates to
// unified Tournaments Community (web/Flutter resolveEventInviteShareUrl parity).
func communityInviteSharePathTemplate(tpl string) string {
	t := strings.TrimSpace(tpl)
	lower := strings.ToLower(t)
	if strings.Contains(lower, "view=events") ||
		strings.Contains(lower, "/events/public") ||
		strings.Contains(lower, "/events/join") {
		return "/?view=tournaments&source=community&code={code}"
	}
	return t
}

// communityInviteSharePath remaps a built invite path off Event browse.
func communityInviteSharePath(path, code string) string {
	path = strings.TrimSpace(path)
	code = strings.ToUpper(strings.TrimSpace(code))
	if path == "" || code == "" {
		return path
	}
	lower := strings.ToLower(path)
	if strings.Contains(lower, "view=events") ||
		strings.HasPrefix(lower, "/events/public") ||
		strings.HasPrefix(lower, "/events/join") {
		return "/?view=tournaments&source=community&code=" + code
	}
	return path
}

func generateJoinCode(alphabet string, length int) (string, error) {
	if length < 1 || alphabet == "" {
		return "", errors.New("invalid join code alphabet")
	}
	var b strings.Builder
	max := big.NewInt(int64(len(alphabet)))
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b.WriteByte(alphabet[n.Int64()])
	}
	return b.String(), nil
}

// PublicCatalog returns enabled formats/sizes only (no disabled invent).
// Optional lat/lng query params resolve host fees at a map pin (ads /ads/pricing parity).
func (a *HostedEventsAPI) PublicCatalog(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, cat, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	formats := make([]store.EventsCatalogFormat, 0)
	enabledFormatIDs := map[string]struct{}{}
	for _, f := range cat.Formats {
		if f.Enabled && strings.TrimSpace(f.Label) != "" {
			formats = append(formats, f)
			enabledFormatIDs[strings.TrimSpace(f.ID)] = struct{}{}
		}
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
	// Geo resolves Ethiopia vs global host-fee amount+currency (ads create-fee parity).
	payerCC := a.resolvePayerCountryAt(r, lat, lng)
	sizes := make([]map[string]any, 0)
	for _, sz := range cat.Sizes {
		if !sz.Enabled || strings.TrimSpace(sz.Label) == "" {
			continue
		}
		allowed := make([]string, 0, len(sz.AllowedFormatIDs))
		for _, id := range sz.AllowedFormatIDs {
			id = strings.TrimSpace(id)
			if _, ok := enabledFormatIDs[id]; ok {
				allowed = append(allowed, id)
			}
		}
		if len(allowed) == 0 {
			continue
		}
		feeAmt, feeCur, feeOK := a.Settings.HostFeeForSizeCountry(sz, payerCC)
		if !feeOK {
			continue
		}
		// Public create UI gets the resolved geo fee only (ads Pricing parity: no dual admin keys).
		sizes = append(sizes, map[string]any{
			"id":                     sz.ID,
			"label":                  sz.Label,
			"enabled":                sz.Enabled,
			"sort_order":             sz.SortOrder,
			"max_players":            sz.MaxPlayers,
			"host_fee_amount":        feeAmt,
			"host_fee_currency":      feeCur,
			"public_host_fee_amount": payments.RoundMoney2(feeAmt * cat.PublicHostFeeMultiplier),
			"allowed_format_ids":     allowed,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"formats":                             formats,
		"sizes":                               sizes,
		"country_code":                        payerCC,
		"auto_approve_default":                true,
		"force_auto_approve":                  true,
		"default_visibility":                  cat.DefaultVisibility,
		"report_reason_codes":                 cat.ReportReasonCodes,
		"report_reason_labels":                cat.ReportReasonLabels,
		"public_host_fee_multiplier":          cat.PublicHostFeeMultiplier,
		"entry_fee_commission_percent":        cat.EntryFeeCommissionPercent,
		"hosted_event_visibilities":           enums.HostedEventVisibilities,
		"hosted_event_public_visibility":      enums.HostedEventPublicVisibility,
		"hosted_event_private_visibility":     enums.HostedEventPrivateVisibility,
		"hosted_event_phase_knockout":         enums.HostedEventPhaseKnockout,
		"hosted_event_phase_round_robin":      enums.HostedEventPhaseRoundRobin,
		"hosted_event_phase_swiss":            enums.HostedEventPhaseSwiss,
		"hosted_event_phase_group":            enums.HostedEventPhaseGroup,
		"hosted_event_knockout_format":        enums.HostedEventKnockoutFormat,
		"hosted_event_round_robin_format":     enums.HostedEventRoundRobinFormat,
		"hosted_event_swiss_format":           enums.HostedEventSwissFormat,
		"hosted_event_groups_knockout_format": enums.HostedEventGroupsKnockoutFormat,
		"hosted_event_arena_format":           enums.HostedEventArenaFormat,
		"hosted_event_phase_arena":            enums.HostedEventPhaseArena,
		"hosted_event_entry_statuses":         enums.HostedEventEntryStatuses,
		"hosted_event_entry_pending":          enums.HostedEventEntryPending,
		"hosted_event_entry_approved":         enums.HostedEventEntryApproved,
		"hosted_event_entry_rejected":         enums.HostedEventEntryRejected,
		"hosted_event_entry_kicked":           enums.HostedEventEntryKicked,
		"min_players_to_start":                cat.MinPlayersToStart,
		// Classic seat ceiling map: organizer UIs label Unlimited/high max from DB (admin parity).
		"swiss_rounds_by_max_players":  cat.SwissRoundsByMaxPlayers,
		"share_path_template":          communityInviteSharePathTemplate(cat.SharePathTemplate),
		"hosted_events_enabled":        a.Flags != nil && a.Flags.Get(r.Context()).HostedEventsEnabled,
		"public_events_enabled":        a.Flags != nil && a.Flags.Get(r.Context()).PublicEventsEnabled,
		"public_event_matches_rated":   a.Flags != nil && a.Flags.Get(r.Context()).PublicEventMatchesRated,
		"prize_pool_display_enabled":   a.Flags != nil && a.Flags.Get(r.Context()).PrizePoolDisplayEnabled,
		"prize_pool_guarantee_enabled": a.Flags != nil && a.Flags.Get(r.Context()).PrizePoolGuaranteeEnabled,
		"hosted_event_default_status":  enums.HostedEventDefaultStatus,
	})
}

// EntryFeeQuote returns server-side commission split for a gross entry fee (create-form preview).
func (a *HostedEventsAPI) EntryFeeQuote(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	if _, _, ok := a.requireEnumsCatalog(w, r); !ok {
		return
	}
	raw := strings.TrimSpace(r.URL.Query().Get("amount"))
	if raw == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_entry_fee_invalid")
		return
	}
	amount, err := strconv.ParseFloat(raw, 64)
	if err != nil || amount < 0 {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_entry_fee_invalid")
		return
	}
	cat := a.Settings.EventsCatalog()
	commission, net := payments.SplitEntryFeeCommission(amount, cat.EntryFeeCommissionPercent)
	writeJSON(w, http.StatusOK, map[string]any{
		"amount":             payments.RoundMoney2(amount),
		"commission_percent": cat.EntryFeeCommissionPercent,
		"commission":         commission,
		"organizer_net":      net,
	})
}

type createHostedEventBody struct {
	Title                     string             `json:"title"`
	Description               string             `json:"description"`
	FormatID                  string             `json:"format_id"`
	SizeID                    string             `json:"size_id"`
	Visibility                string             `json:"visibility"`
	AutoApprove               *bool              `json:"auto_approve"` // ignored; always forced true
	IsFreeEntry               *bool              `json:"is_free_entry"`
	EntryFeeAmount            *float64           `json:"entry_fee_amount"`
	EntryFeeCurrency          string             `json:"entry_fee_currency"`
	BrandColor                string             `json:"brand_color"`
	CountryCode               string             `json:"country_code"`
	PrizePoolDisplayEnabled   *bool              `json:"prize_pool_display_enabled"`
	PrizePoolGuaranteeEnabled *bool              `json:"prize_pool_guarantee_enabled"`
	PrizePoolGuaranteeAmount  *float64           `json:"prize_pool_guarantee_amount"`
	ArenaDurationMinutes      *int               `json:"arena_duration_minutes"`
	PrizePayoutMode           string             `json:"prize_payout_mode"`
	PrizePlacePercents        map[string]float64 `json:"prize_place_percents"`
}

type patchHostedEventBody struct {
	Title              *string            `json:"title"`
	Description        *string            `json:"description"`
	Visibility         *string            `json:"visibility"`
	BrandColor         *string            `json:"brand_color"`
	SponsorName        *string            `json:"sponsor_name"`
	PrizePayoutMode    *string            `json:"prize_payout_mode"`
	PrizePlacePercents map[string]float64 `json:"prize_place_percents"`
}

type reportEventBody struct {
	ReasonCode string `json:"reason_code"`
	Note       string `json:"note"`
}

func (a *HostedEventsAPI) Create(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	enums, cat, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	var body createHostedEventBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Title) == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_title_required")
		return
	}
	if strings.TrimSpace(body.FormatID) == "" || strings.TrimSpace(body.SizeID) == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_format_size_required")
		return
	}
	if !a.Settings.IsAllowedHostedEventFormat(body.FormatID) {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_format_id")
		return
	}
	format, fok := a.Settings.FindEventsCatalogFormat(body.FormatID)
	size, sok := a.Settings.FindEventsCatalogSize(body.SizeID)
	if !fok || !format.Enabled {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "format_unavailable")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg, "error_key": "format_unavailable"})
		return
	}
	if !sok || !size.Enabled {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "size_unavailable")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg, "error_key": "size_unavailable"})
		return
	}
	allowed := false
	for _, fid := range size.AllowedFormatIDs {
		if fid == body.FormatID {
			allowed = true
			break
		}
	}
	if !allowed {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "format_unavailable")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_format_not_allowed_for_size")
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg, "error_key": "format_unavailable"})
		return
	}
	// Defense: null Unlimited / high safety ceiling sizes must stay Arena even if catalog corrupt.
	if store.SeatCapRequiresArenaOnly(size.MaxPlayers, cat.SwissRoundsByMaxPlayers) {
		arenaID := strings.TrimSpace(enums.HostedEventArenaFormat)
		if arenaID == "" || strings.TrimSpace(body.FormatID) != arenaID {
			msg := eventsOrganizerChromeString(a.Settings, r.Context(), "format_unavailable")
			if msg == "" {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_format_not_allowed_for_size")
				return
			}
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg, "error_key": "format_unavailable"})
			return
		}
	}

	// Product: always auto-approve; ignore client auto_approve.
	autoApprove := true

	visibility := strings.TrimSpace(body.Visibility)
	if visibility == "" {
		visibility = strings.TrimSpace(cat.DefaultVisibility)
	}
	if visibility == "" {
		visibility = strings.TrimSpace(enums.HostedEventDefaultVisibility)
	}
	if !a.Settings.IsAllowedHostedEventVisibility(visibility) {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_visibility")
		return
	}
	publicVis := strings.TrimSpace(enums.HostedEventPublicVisibility)
	if publicVis != "" && visibility == publicVis {
		if a.Flags == nil || !a.Flags.Get(r.Context()).PublicEventsEnabled {
			msg := eventsOrganizerChromeString(a.Settings, r.Context(), "public_disabled")
			if msg == "" {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "public_disabled")
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
			return
		}
	}

	// Geo → Ethiopia vs global host fee (amount + currency). Server geo only.
	payerCC := a.resolvePayerCountry(r)
	hostFeeBase, hostCur, hostFeeOK := a.Settings.HostFeeForSizeCountry(size, payerCC)
	if payerCC == "" || !hostFeeOK || hostCur == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "location_unavailable")
		return
	}

	// Product: entry_fee_amount > 0 means paid seats; 0 / omitted means free.
	// Explicit is_free_entry:true always forces free (amount ignored).
	entryFee := 0.0
	entryCur := ""
	if body.EntryFeeAmount != nil {
		if *body.EntryFeeAmount < 0 {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_entry_fee_invalid")
			return
		}
		entryFee = *body.EntryFeeAmount
	}
	isFree := entryFee <= 0
	if body.IsFreeEntry != nil && *body.IsFreeEntry {
		isFree = true
		entryFee = 0
	}
	if body.IsFreeEntry != nil && !*body.IsFreeEntry && entryFee <= 0 {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_entry_fee_required")
		return
	}
	if !isFree {
		// Paid seats use the same geo currency as host fee (ignore client currency invent).
		entryCur = hostCur
		if !requireCashGate(w, r, a.Cash, a.Users, a.Settings, payerCC) {
			return
		}
		// Tier B phone KYC + Layer D concurrent/reputation (shared with paid reopen).
		if !a.enforcePaidHostOpsGates(w, r, userID, enums, true, "err_create_failed") {
			return
		}
	} else {
		entryCur = hostCur
	}
	// Free cups only charge the organizer host fee from wallet. Do not apply the full
	// player cash/RMG jurisdiction gate here (that blocked free organizers outside ET).

	hostFee := hostFeeBase
	if publicVis != "" && visibility == publicVis && cat.PublicHostFeeMultiplier != 1 {
		hostFee = hostFeeBase * cat.PublicHostFeeMultiplier
	}
	hostFee = payments.RoundMoney2(hostFee)

	// Fail closed before any wallet read: create money paths require payments.
	if hostFee > 0 && a.Payments == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
		return
	}
	if a.Payments != nil {
		if bal := a.Payments.WalletBalance(r.Context(), userID, hostCur); bal < hostFee {
			msg := eventsOrganizerChromeString(a.Settings, r.Context(), "insufficient_host_fee")
			if msg == "" {
				writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_insufficient_balance")
				return
			}
			writeJSON(w, http.StatusPaymentRequired, map[string]any{
				"error":     msg,
				"error_key": "insufficient_host_fee",
				"balance":   bal,
				"currency":  hostCur,
			})
			return
		}
	}
	commissionPct := cat.EntryFeeCommissionPercent
	if commissionPct < 0 {
		commissionPct = 0
	}
	if commissionPct > 100 {
		commissionPct = 100
	}

	var joinCode string
	var createErr error
	for attempt := 0; attempt < 12; attempt++ {
		joinCode, createErr = generateJoinCode(cat.JoinCodeAlphabet, cat.JoinCodeLength)
		if createErr != nil {
			break
		}
		exists, err := a.Events.JoinCodeExists(r.Context(), joinCode)
		if err != nil {
			createErr = err
			break
		}
		if !exists {
			break
		}
		joinCode = ""
	}
	if createErr != nil || joinCode == "" {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "toast_create_failed")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}

	var brandColor *string
	if bc := strings.TrimSpace(body.BrandColor); bc != "" {
		brandColor = &bc
	}

	// Prize pool: free always off. Paid requires platform flag; guarantee requires both flags + hold.
	prizeDisplay := false
	prizeGuarantee := false
	prizeGuaranteeAmt := 0.0
	if !isFree {
		platformDisplay := a.Flags != nil && a.Flags.Get(r.Context()).PrizePoolDisplayEnabled
		platformGuarantee := a.Flags != nil && a.Flags.Get(r.Context()).PrizePoolGuaranteeEnabled
		if platformDisplay && body.PrizePoolDisplayEnabled != nil && *body.PrizePoolDisplayEnabled {
			prizeDisplay = true
		}
		if prizeDisplay && platformGuarantee && body.PrizePoolGuaranteeEnabled != nil && *body.PrizePoolGuaranteeEnabled {
			if body.PrizePoolGuaranteeAmount == nil || *body.PrizePoolGuaranteeAmount <= 0 {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_prize_guarantee_amount_invalid")
				return
			}
			if a.Payments == nil {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
				return
			}
			prizeGuarantee = true
			prizeGuaranteeAmt = payments.RoundMoney2(*body.PrizePoolGuaranteeAmount)
			// Tier C: guaranteed pots require approved document KYC when policy says so.
			if a.Cash != nil && a.Cash.Ready() && a.Cash.Policy().HostGuaranteeRequiresDocumentKyc {
				policy := a.Cash.Policy()
				okDoc := false
				if hostUser, uErr := a.Users.GetByID(r.Context(), userID); uErr == nil && hostUser != nil {
					okDoc = hostUser.DocumentKycVerifiedAt != nil
				}
				if !okDoc && a.Docs != nil {
					okDoc, _ = a.Docs.HasApprovedDocument(r.Context(), userID, policy.DocumentKycApprovedStatus)
				}
				if !okDoc {
					writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_host_guarantee_requires_document_kyc")
					return
				}
			}
			// Guarantee is held in entry-fee currency; host fee may differ so check each wallet.
			guarCur := strings.ToUpper(strings.TrimSpace(entryCur))
			if guarCur == "" {
				guarCur = hostCur
			}
			if guarCur == hostCur {
				need := payments.RoundMoney2(hostFee + prizeGuaranteeAmt)
				if bal := a.Payments.WalletBalance(r.Context(), userID, hostCur); bal < need {
					msg := eventsOrganizerChromeString(a.Settings, r.Context(), "insufficient_prize_guarantee")
					if msg == "" {
						writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_insufficient_balance")
						return
					}
					writeJSON(w, http.StatusPaymentRequired, map[string]any{
						"error":     msg,
						"error_key": "insufficient_prize_guarantee",
						"balance":   bal,
						"currency":  hostCur,
					})
					return
				}
			} else {
				if bal := a.Payments.WalletBalance(r.Context(), userID, guarCur); bal < prizeGuaranteeAmt {
					msg := eventsOrganizerChromeString(a.Settings, r.Context(), "insufficient_prize_guarantee")
					if msg == "" {
						writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_insufficient_balance")
						return
					}
					writeJSON(w, http.StatusPaymentRequired, map[string]any{
						"error":     msg,
						"error_key": "insufficient_prize_guarantee",
						"balance":   bal,
						"currency":  guarCur,
					})
					return
				}
			}
		}
	}

	// Fail-closed Layer A: paid host fee / guaranteed pot must escrow in one TX (same as Reopen).
	if (hostFee > 0 || (prizeGuarantee && prizeGuaranteeAmt > 0)) &&
		(a.Payments == nil || a.DB == nil || !a.DB.Ready()) {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
		return
	}

	var arenaDur *int
	if body.ArenaDurationMinutes != nil && *body.ArenaDurationMinutes > 0 {
		d := *body.ArenaDurationMinutes
		arenaDur = &d
	} else if strings.TrimSpace(body.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat) {
		if n, err := strconv.Atoi(strings.TrimSpace(enums.CompetitionArenaDefaultDurationMinutes)); err == nil && n > 0 {
			arenaDur = &n
		}
	}
	// Paid + prize display: always resolve mode (DB format default when body omits mode).
	payoutEngage := prizeDisplay && !isFree && entryFee > 0
	payout, payoutErrKey := resolveCompetitionPayout(
		enums, body.FormatID, prizeDisplay, isFree, entryFee,
		competitionPayoutRequest{
			Mode:     body.PrizePayoutMode,
			Percents: body.PrizePlacePercents,
			Engage:   payoutEngage,
		},
		nil,
	)
	if payoutErrKey != "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, payoutErrKey)
		return
	}
	createIn := store.CreateHostedEventInput{
		OrganizerID:               userID,
		Title:                     strings.TrimSpace(body.Title),
		Description:               strings.TrimSpace(body.Description),
		FormatID:                  body.FormatID,
		SizeID:                    body.SizeID,
		MaxPlayers:                size.MaxPlayers,
		HostFeeAmount:             hostFee,
		HostFeeCurrency:           hostCur,
		EntryFeeAmount:            entryFee,
		EntryFeeCurrency:          entryCur,
		EntryFeeCommissionPercent: commissionPct,
		IsFreeEntry:               isFree,
		AutoApprove:               autoApprove,
		Visibility:                visibility,
		JoinCode:                  joinCode,
		Status:                    enums.HostedEventDefaultStatus,
		BrandColor:                brandColor,
		PrizePoolDisplayEnabled:   prizeDisplay,
		PrizePoolGuaranteeEnabled: prizeGuarantee,
		PrizePoolGuaranteeAmount:  prizeGuaranteeAmt,
		ArenaDurationMinutes:      arenaDur,
		PrizePayoutMode:           payout.Mode,
		PrizePlacePercents:        payout.Percents,
	}
	needEscrowTX := a.Payments != nil && a.DB != nil && a.DB.Ready() &&
		((prizeGuarantee && prizeGuaranteeAmt > 0) || hostFee > 0)

	var ev *store.HostedEvent
	var err error
	if needEscrowTX {
		// Atomic escrow: create + guarantee hold + host fee commit together (no cancelled orphans).
		tx, txErr := a.DB.Pool.Begin(r.Context())
		if txErr != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
			return
		}
		defer tx.Rollback(r.Context())

		ev, err = a.Events.CreateTx(r.Context(), tx, createIn)
		if err != nil {
			msg := eventsOrganizerChromeString(a.Settings, r.Context(), "toast_create_failed")
			if msg == "" {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
				return
			}
			writeClientError(w, http.StatusInternalServerError, msg)
			return
		}
		if prizeGuarantee && prizeGuaranteeAmt > 0 {
			cycle := ev.PrizePoolGuaranteeCycle
			if cycle < 1 {
				cycle = 1
			}
			if holdErr := a.Payments.SettlePrizePoolGuaranteeHoldTx(r.Context(), tx, userID, prizeGuaranteeAmt, entryCur, ev.ID, cycle); holdErr != nil {
				key := "err_prize_guarantee_settle_failed"
				if errors.Is(holdErr, payments.ErrInsufficientWalletBalance) {
					key = "insufficient_prize_guarantee"
				}
				msg := eventsOrganizerChromeString(a.Settings, r.Context(), key)
				if msg == "" {
					writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_insufficient_balance")
					return
				}
				status := http.StatusPaymentRequired
				if key != "insufficient_prize_guarantee" {
					status = http.StatusConflict
				}
				writeJSON(w, status, map[string]any{
					"error":     msg,
					"error_key": key,
					"balance":   a.Payments.WalletBalance(r.Context(), userID, entryCur),
					"currency":  entryCur,
				})
				return
			}
			held, holdErr := a.Events.MarkPrizePoolGuaranteeHeldTx(r.Context(), tx, ev.ID)
			if holdErr != nil || held == nil {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
				return
			}
			ev = held
		}
		if hostFee > 0 {
			if feeErr := a.Payments.SettleHostFeeTx(r.Context(), tx, userID, hostFee, hostCur, ev.ID); feeErr != nil {
				msg := eventsOrganizerChromeString(a.Settings, r.Context(), "insufficient_host_fee")
				if msg == "" {
					writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_insufficient_balance")
					return
				}
				writeJSON(w, http.StatusPaymentRequired, map[string]any{
					"error":     msg,
					"error_key": "insufficient_host_fee",
					"balance":   a.Payments.WalletBalance(r.Context(), userID, hostCur),
					"currency":  hostCur,
				})
				return
			}
		}
		if commitErr := tx.Commit(r.Context()); commitErr != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
			return
		}
	} else {
		ev, err = a.Events.Create(r.Context(), createIn)
		if err != nil {
			msg := eventsOrganizerChromeString(a.Settings, r.Context(), "toast_create_failed")
			if msg == "" {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_create_failed")
				return
			}
			writeClientError(w, http.StatusInternalServerError, msg)
			return
		}
	}
	if a.emitPool() {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, userID, notifications.KindPlayerEventCreated,
			"event_created:"+ev.ID, ev.ID, ev.Title)
	}
	writeJSON(w, http.StatusCreated, a.publicEventWithHost(r.Context(), ev, enums))
}

func (a *HostedEventsAPI) Dashboard(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	stats, err := a.Events.OrganizerDashboard(
		r.Context(), userID,
		enums.HostedEventLiveStatus,
		enums.HostedEventDefaultStatus,
		enums.HostedEventFullStatus,
		enums.HostedEventCancelledStatus,
	)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_dashboard_failed")
		return
	}
	pausedCount := 0
	if a.Games != nil {
		liveIDs, lerr := a.Events.ListUnfinishedLiveGameIDsForOrganizer(
			r.Context(), userID,
			enums.HostedEventLiveStatus,
			enums.HostedEventBracketLive,
		)
		if lerr == nil {
			for _, gid := range liveIDs {
				rec, ok := a.Games.GetAuthoritative(gid)
				if !ok || rec.State == nil || !rec.State.Paused {
					continue
				}
				if strings.TrimSpace(rec.State.PauseKind) == engine.PauseKindOfficial {
					pausedCount++
				}
			}
		}
	}
	stats.OfficiallyPausedCount = pausedCount
	avgPauseSec := 0
	if a.OfficialPause != nil {
		if avg, aerr := a.OfficialPause.AverageCompletedPauseSecondsForOrganizer(r.Context(), userID); aerr == nil {
			avgPauseSec = avg
		}
	}
	out := map[string]any{
		"active_count":               stats.ActiveCount,
		"upcoming_count":             stats.UpcomingCount,
		"players_joined_this_week":   stats.PlayersJoinedThisWeek,
		"officially_paused_count":    stats.OfficiallyPausedCount,
		"official_pause_avg_seconds": avgPauseSec,
		"host_fee_revenue_sum":       stats.HostFeeRevenueSum,
		"host_fee_currency":          strings.TrimSpace(stats.HostFeeCurrency),
		"entry_fee_revenue_sum":      stats.EntryFeeRevenueSum, // organizer net (compat)
		"entry_fee_net_sum":          stats.EntryFeeRevenueSum,
		"entry_fee_gross_sum":        stats.EntryFeeGrossSum,
		"entry_fee_commission_sum":   stats.EntryFeeCommissionSum,
		"entry_fee_currency":         strings.TrimSpace(stats.EntryFeeCurrency),
	}
	if a.Users != nil && a.Cash != nil && a.Cash.Ready() {
		if hostUser, uErr := a.Users.GetByID(r.Context(), userID); uErr == nil && hostUser != nil {
			if tier, badge := a.Cash.HostTrust(hostUser.PhoneKycVerifiedAt != nil, hostUser.DocumentKycVerifiedAt != nil); tier != "" && badge != "" {
				out["host_trust_tier"] = tier
				out["host_trust_badge"] = badge
			}
		}
	}
	a.stampOrganizerReputationFields(r.Context(), out, userID, enums)
	if stats.LastEventID != "" {
		out["last_event_id"] = stats.LastEventID
		out["last_event_join_code"] = stats.LastEventJoinCode
		if share, err := a.shareURL(r.Context(), stats.LastEventJoinCode); err == nil {
			out["last_event_share_url"] = share
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *HostedEventsAPI) Analytics(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	stats, err := a.Events.OrganizerAnalytics(
		r.Context(), userID,
		enums.HostedEventLiveStatus,
		enums.HostedEventFinishedStatus,
	)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_analytics_failed")
		return
	}
	events := make([]map[string]any, 0, len(stats.Events))
	for _, row := range stats.Events {
		item := map[string]any{
			"event_id":             row.EventID,
			"title":                row.Title,
			"status":               row.Status,
			"join_code":            row.JoinCode,
			"players_joined":       row.PlayersJoined,
			"started":              row.Started,
			"finished":             row.Finished,
			"host_fee":             row.HostFee,
			"host_fee_currency":    row.HostFeeCurrency,
			"entry_fees_sum":       row.EntryFeesSum,
			"entry_commission_sum": row.EntryCommissionSum,
			"entry_net_sum":        row.EntryNetSum,
			"entry_fee_currency":   row.EntryFeeCurrency,
		}
		if label := store.StatusLabel(enums.HostedEventStatusLabels, row.Status); label != "" {
			item["status_label"] = label
		}
		if share, err := a.shareURL(r.Context(), row.JoinCode); err == nil {
			item["share_url"] = share
		}
		events = append(events, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"metrics":              []string{"joins", "completions", "money"},
		"share_clicks_tracked": false,
		"events":               events,
		"totals": map[string]any{
			"players_joined":       stats.TotalPlayersJoined,
			"events_started":       stats.TotalStarted,
			"events_finished":      stats.TotalFinished,
			"host_fee_sum":         stats.TotalHostFeeSum,
			"host_fee_currency":    strings.TrimSpace(stats.HostFeeCurrency),
			"entry_fees_sum":       stats.TotalEntryFeesSum,
			"entry_commission_sum": stats.TotalEntryCommission,
			"entry_net_sum":        stats.TotalEntryNetSum,
			"entry_fee_currency":   strings.TrimSpace(stats.EntryFeeCurrency),
		},
	})
}

func (a *HostedEventsAPI) Patch(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	if ev.Status == enums.HostedEventCancelledStatus || ev.Status == enums.HostedEventFinishedStatus {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_event_not_editable")
		return
	}
	var body patchHostedEventBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	payoutTouched := body.PrizePayoutMode != nil || body.PrizePlacePercents != nil
	if body.Title == nil && body.Description == nil && body.Visibility == nil &&
		body.BrandColor == nil && body.SponsorName == nil && !payoutTouched {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_no_fields")
		return
	}
	if body.Title != nil && ev.Status != enums.HostedEventDefaultStatus {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "patch_title_locked")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "events_organizer_chrome_unavailable")
			return
		}
		writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
		return
	}
	var payoutModePtr *string
	var payoutPercents map[string]any
	setPrizePayout := false
	if payoutTouched {
		// Payout mode may change only before start / freeze (growing pot still uses % of freeze).
		if ev.StartedAt != nil || ev.PrizePoolFrozenAmount != nil ||
			ev.Status == enums.HostedEventLiveStatus || ev.Status == enums.HostedEventFinishedStatus {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_event_not_editable")
			return
		}
		modeIn := ""
		if body.PrizePayoutMode != nil {
			modeIn = strings.TrimSpace(*body.PrizePayoutMode)
		} else {
			modeIn = strings.TrimSpace(ev.PrizePayoutMode)
		}
		percentsIn := body.PrizePlacePercents
		if percentsIn == nil {
			percentsIn = map[string]float64{}
			for k, v := range ev.PrizePlacePercents {
				switch n := v.(type) {
				case float64:
					percentsIn[k] = n
				case int:
					percentsIn[k] = float64(n)
				case json.Number:
					if f, err := n.Float64(); err == nil {
						percentsIn[k] = f
					}
				}
			}
		}
		payoutEngage := strings.TrimSpace(modeIn) != "" || len(percentsIn) > 0 ||
			(ev.PrizePoolDisplayEnabled && !ev.IsFreeEntry && ev.EntryFeeAmount > 0 &&
				strings.TrimSpace(ev.PrizePayoutMode) == "")
		payout, payoutErrKey := resolveCompetitionPayout(
			enums, ev.FormatID, ev.PrizePoolDisplayEnabled, ev.IsFreeEntry, ev.EntryFeeAmount,
			competitionPayoutRequest{Mode: modeIn, Percents: percentsIn, Engage: payoutEngage},
			&competitionPayoutResolved{Mode: ev.PrizePayoutMode, Percents: ev.PrizePlacePercents},
		)
		if payoutErrKey != "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, payoutErrKey)
			return
		}
		setPrizePayout = true
		m := payout.Mode
		payoutModePtr = &m
		payoutPercents = payout.Percents
	}
	if body.Visibility != nil {
		newVis := strings.TrimSpace(*body.Visibility)
		if !a.Settings.IsAllowedHostedEventVisibility(newVis) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_visibility")
			return
		}
		if newVis != ev.Visibility {
			publicVis := strings.TrimSpace(enums.HostedEventPublicVisibility)
			privateVis := strings.TrimSpace(enums.HostedEventPrivateVisibility)
			blockedMsg := eventsOrganizerChromeString(a.Settings, r.Context(), "visibility_change_blocked")
			if blockedMsg == "" {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "events_organizer_chrome_unavailable")
				return
			}
			if publicVis != "" && newVis == publicVis {
				if a.Flags == nil || !a.Flags.Get(r.Context()).PublicEventsEnabled {
					msg := eventsOrganizerChromeString(a.Settings, r.Context(), "public_disabled")
					if msg == "" {
						writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "events_organizer_chrome_unavailable")
						return
					}
					writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
					return
				}
				// private→public only while open and before live
				if ev.Status != enums.HostedEventDefaultStatus {
					writeJSON(w, http.StatusConflict, map[string]string{"error": blockedMsg})
					return
				}
			}
			if privateVis != "" && newVis == privateVis {
				// public→private blocked once non-organizer entry exists OR live/finished
				if ev.Status == enums.HostedEventLiveStatus || ev.Status == enums.HostedEventFinishedStatus {
					writeJSON(w, http.StatusConflict, map[string]string{"error": blockedMsg})
					return
				}
				n, err := a.Events.CountNonOrganizerEntries(r.Context(), ev.ID, ev.OrganizerID)
				if err != nil {
					writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_update_failed")
					return
				}
				if n > 0 {
					writeJSON(w, http.StatusConflict, map[string]string{"error": blockedMsg})
					return
				}
			}
		}
	}
	ev, err = a.Events.Patch(r.Context(), ev.ID, store.PatchHostedEventInput{
		Title:              body.Title,
		Description:        body.Description,
		Visibility:         body.Visibility,
		BrandColor:         body.BrandColor,
		SponsorName:        body.SponsorName,
		PrizePayoutMode:    payoutModePtr,
		PrizePlacePercents: payoutPercents,
		SetPrizePayout:     setPrizePayout,
	})
	if err != nil {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "toast_save_failed")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_update_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

func parseHostedEventListFilter(r *http.Request) store.HostedEventListFilter {
	filter := store.HostedEventListFilter{
		Q:      strings.TrimSpace(r.URL.Query().Get("q")),
		Status: strings.TrimSpace(r.URL.Query().Get("status")),
	}
	switch strings.TrimSpace(strings.ToLower(r.URL.Query().Get("is_free_entry"))) {
	case "1", "true", "yes":
		v := true
		filter.IsFreeEntry = &v
	case "0", "false", "no":
		v := false
		filter.IsFreeEntry = &v
	}
	return filter
}

func (a *HostedEventsAPI) ListPublic(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	if a.Flags == nil || !a.Flags.Get(r.Context()).PublicEventsEnabled {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "public_disabled")
		if msg == "" {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "public_disabled")
			return
		}
		writeJSON(w, http.StatusForbidden, map[string]string{"error": msg})
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	publicVis := strings.TrimSpace(enums.HostedEventPublicVisibility)
	if publicVis == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	entryFilter := parseHostedEventListFilter(r)
	lifecycle := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("lifecycle")))
	if lifecycle == "" {
		lifecycle = "open"
	}
	switch lifecycle {
	case "open", "live", "finished", "all":
		// "all" skips timestamp clause in store (profile / My tournaments history).
		if lifecycle != "all" {
			entryFilter.Lifecycle = lifecycle
		}
	default:
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_list_failed")
		return
	}
	mine := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("mine")), "1") ||
		strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("mine")), "true")
	if mine {
		mineUID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
		if mineUID == "" {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
			return
		}
		entryFilter.MineUserID = mineUID
	}
	statuses := enums.HostedEventJoinableStatuses
	if lifecycle != "open" || mine {
		// Live/finished/mine: include non-joinable statuses that still appear on public browse.
		seen := map[string]struct{}{}
		statuses = nil
		for _, st := range enums.HostedEventStatuses {
			st = strings.TrimSpace(st)
			if st == "" || strings.EqualFold(st, enums.HostedEventCancelledStatus) {
				continue
			}
			if _, ok := seen[st]; ok {
				continue
			}
			seen[st] = struct{}{}
			statuses = append(statuses, st)
		}
		if len(statuses) == 0 {
			statuses = enums.HostedEventJoinableStatuses
		}
	}
	// Open discovery only: hide paid cash events outside allowlisted GeoIP region.
	if !mine && lifecycle == "open" {
		cashOK := viewerCashRegionOK(r, a.Cash, a.Locate, a.Settings)
		if !forceFreeEntryFilter(&entryFilter.IsFreeEntry, cashOK) {
			meta := pagination.BuildMeta(params, 0, skipCap, labels)
			writeJSON(w, http.StatusOK, map[string]any{"events": []any{}, "meta": meta})
			return
		}
	}
	list, total, err := a.Events.ListPublic(r.Context(), params.Skip, params.Limit, statuses, publicVis, entryFilter)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_list_failed")
		return
	}
	orgIDs := make([]string, 0, len(list))
	for i := range list {
		orgIDs = append(orgIDs, list[i].OrganizerID)
	}
	orgCards := a.loadOrganizerCardsWithReputation(
		r.Context(), orgIDs,
		enums.HostedEventFinishedStatus, enums.HostedEventCancelledStatus, enums.HostedEventReportOpenStatus,
	)
	liveGameByID := map[string]string{}
	liveSt := strings.TrimSpace(enums.HostedEventBracketLive)
	if liveSt != "" && len(list) > 0 {
		ids := make([]string, 0, len(list))
		for i := range list {
			ids = append(ids, list[i].ID)
		}
		if m, err := a.Events.MapLiveGameIDsByEventIDs(r.Context(), ids, liveSt); err == nil && m != nil {
			liveGameByID = m
		}
	}
	out := make([]map[string]any, 0, len(list))
	for i := range list {
		m := a.publicEvent(r.Context(), &list[i], enums)
		if gid := strings.TrimSpace(liveGameByID[list[i].ID]); gid != "" {
			m["live_game_id"] = gid
		}
		a.attachOrganizerCard(r.Context(), m, list[i].OrganizerID, orgCards)
		out = append(out, m)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"events": out, "meta": meta})
}

func (a *HostedEventsAPI) uploadEventImage(w http.ResponseWriter, r *http.Request) (url string, ok bool) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return "", false
	}
	if a.Avatars == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_media_unavailable")
		return "", false
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_multipart")
		return "", false
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_file_required")
		return "", false
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_read_failed")
		return "", false
	}
	url, err = a.Avatars.UploadTournamentPrizeImage(userID, header.Filename, header.Header.Get("Content-Type"), data)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_media_upload_failed")
		return "", false
	}
	return url, true
}

func (a *HostedEventsAPI) UploadLogo(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	url, ok := a.uploadEventImage(w, r)
	if !ok {
		return
	}
	ev, err = a.Events.SetLogoURL(r.Context(), ev.ID, url)
	if err != nil {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "upload_logo_failed")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_logo_save_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

func (a *HostedEventsAPI) UploadSponsorLogo(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	url, ok := a.uploadEventImage(w, r)
	if !ok {
		return
	}
	ev, err = a.Events.SetSponsorLogoURL(r.Context(), ev.ID, url)
	if err != nil {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "upload_sponsor_failed")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_sponsor_save_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

// UploadPrizeImage accepts multipart file upload and sets prize_image_url (organizer only).
func (a *HostedEventsAPI) UploadPrizeImage(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	url, ok := a.uploadEventImage(w, r)
	if !ok {
		return
	}
	ev, err = a.Events.SetPrizeImage(r.Context(), ev.ID, url)
	if err != nil {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "media_upload_failed")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_update_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

// ClearPrizeImage clears the hosted event prize thumbnail (organizer only).
func (a *HostedEventsAPI) ClearPrizeImage(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	ev, err = a.Events.ClearPrizeImage(r.Context(), ev.ID)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_update_failed")
		return
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

// UploadGalleryImage accepts multipart file upload and appends the URL to gallery.
func (a *HostedEventsAPI) UploadGalleryImage(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	url, ok := a.uploadEventImage(w, r)
	if !ok {
		return
	}
	ev, err = a.Events.AppendGallery(r.Context(), ev.ID, url)
	if err != nil {
		if errors.Is(err, store.ErrGalleryFull) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "gallery_limit_reached")
			return
		}
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "media_upload_failed")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_update_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

// RemoveGalleryImage removes one gallery slot by 0-based index.
func (a *HostedEventsAPI) RemoveGalleryImage(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	idxRaw := strings.TrimSpace(chi.URLParam(r, "index"))
	index, err := strconv.Atoi(idxRaw)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
		return
	}
	ev, err = a.Events.RemoveGalleryAt(r.Context(), ev.ID, index)
	if err != nil {
		if errors.Is(err, store.ErrGalleryIndex) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
			return
		}
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_update_failed")
		return
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

func (a *HostedEventsAPI) ListMine(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	list, total, err := a.Events.ListByOrganizer(r.Context(), userID, params.Skip, params.Limit, parseHostedEventListFilter(r))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_list_failed")
		return
	}
	orgIDs := make([]string, 0, len(list))
	for i := range list {
		orgIDs = append(orgIDs, list[i].OrganizerID)
	}
	orgCards := a.loadOrganizerCardsWithReputation(
		r.Context(), orgIDs,
		enums.HostedEventFinishedStatus, enums.HostedEventCancelledStatus, enums.HostedEventReportOpenStatus,
	)
	out := make([]map[string]any, 0, len(list))
	for i := range list {
		m := a.publicEvent(r.Context(), &list[i], enums)
		a.attachOrganizerCard(r.Context(), m, list[i].OrganizerID, orgCards)
		out = append(out, m)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"events": out, "meta": meta})
}

func (a *HostedEventsAPI) ListJoined(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	list, total, err := a.Events.ListJoinedByUser(r.Context(), userID, params.Skip, params.Limit)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_list_failed")
		return
	}
	orgIDs := make([]string, 0, len(list))
	for i := range list {
		orgIDs = append(orgIDs, list[i].OrganizerID)
	}
	orgCards := a.loadOrganizerCardsWithReputation(
		r.Context(), orgIDs,
		enums.HostedEventFinishedStatus, enums.HostedEventCancelledStatus, enums.HostedEventReportOpenStatus,
	)
	out := make([]map[string]any, 0, len(list))
	for i := range list {
		m := a.publicEvent(r.Context(), &list[i], enums)
		a.attachOrganizerCard(r.Context(), m, list[i].OrganizerID, orgCards)
		out = append(out, m)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"events": out, "meta": meta})
}

// requireCanViewEvent allows public cups for anyone; private cups only organizer or approved entry.
func (a *HostedEventsAPI) requireCanViewEvent(w http.ResponseWriter, r *http.Request, ev *store.HostedEvent, enums store.ClientEnumsConfig) bool {
	if ev == nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return false
	}
	publicVis := strings.TrimSpace(enums.HostedEventPublicVisibility)
	if publicVis != "" && strings.EqualFold(strings.TrimSpace(ev.Visibility), publicVis) {
		return true
	}
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return false
	}
	if userID == ev.OrganizerID {
		return true
	}
	en, err := a.Events.GetEntry(r.Context(), ev.ID, userID)
	if err == nil && en != nil && en.Status == enums.HostedEventEntryApproved {
		return true
	}
	msg := eventsPlayerChromeString(a.Settings, r.Context(), "cannot_join_status")
	if msg == "" {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_forbidden")
		return false
	}
	writeJSON(w, http.StatusForbidden, map[string]string{"error": msg})
	return false
}

func (a *HostedEventsAPI) Get(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	ev, err := a.Events.Get(r.Context(), id)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireCanViewEvent(w, r, ev, enums) {
		return
	}
	m := a.publicEvent(r.Context(), ev, enums)
	orgCards := a.loadOrganizerCardsWithReputation(
		r.Context(), []string{ev.OrganizerID},
		enums.HostedEventFinishedStatus, enums.HostedEventCancelledStatus, enums.HostedEventReportOpenStatus,
	)
	a.attachOrganizerCard(r.Context(), m, ev.OrganizerID, orgCards)
	if userID := strings.TrimSpace(auth.UserIDFromContext(r.Context())); userID != "" {
		if queued, qerr := a.Events.ViewerArenaQueued(r.Context(), ev.ID, userID); qerr == nil && queued {
			m["viewer_arena_queued"] = true
		}
	}
	writeJSON(w, http.StatusOK, m)
}

func (a *HostedEventsAPI) GetByCode(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	code := chi.URLParam(r, "code")
	ev, err := a.Events.GetByJoinCode(r.Context(), code)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	m := a.publicEvent(r.Context(), ev, enums)
	orgCards := a.loadOrganizerCardsWithReputation(
		r.Context(), []string{ev.OrganizerID},
		enums.HostedEventFinishedStatus, enums.HostedEventCancelledStatus, enums.HostedEventReportOpenStatus,
	)
	a.attachOrganizerCard(r.Context(), m, ev.OrganizerID, orgCards)
	writeJSON(w, http.StatusOK, m)
}

type joinEventBody struct {
	Code        string `json:"code"`
	CountryCode string `json:"country_code"`
}

func (a *HostedEventsAPI) Join(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	var body joinEventBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	code := strings.TrimSpace(body.Code)
	if code == "" {
		code = strings.TrimSpace(chi.URLParam(r, "code"))
	}
	if code == "" {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_code_required")
		return
	}
	ev, err := a.Events.GetByJoinCode(r.Context(), code)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	joinable := a.Settings.IsJoinableHostedEventStatus(ev.Status)
	if !joinable {
		joinable = hostedEventArenaLiveJoinAllowed(ev, enums, time.Now())
	}
	if !joinable {
		msg := eventsPlayerChromeString(a.Settings, r.Context(), "event_not_joinable")
		if msg == "" {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "event_not_joinable")
			return
		}
		writeJSON(w, http.StatusConflict, map[string]string{"error": msg, "error_key": "event_not_joinable"})
		return
	}
	approved, _ := a.Events.CountByStatus(r.Context(), ev.ID, enums.HostedEventEntryApproved)
	if seatCap := store.PlayerCapOrZero(ev.MaxPlayers); seatCap > 0 && approved >= seatCap {
		msg := eventsPlayerChromeString(a.Settings, r.Context(), "event_full")
		if msg == "" {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "event_full")
			return
		}
		writeJSON(w, http.StatusConflict, map[string]string{"error": msg, "error_key": "event_full"})
		return
	}
	if existing, err := a.Events.GetEntry(r.Context(), ev.ID, userID); err == nil && existing != nil {
		// Kick / close / cancel vacate the seat (status kicked). Allow a fresh rejoin.
		if existing.Status == enums.HostedEventEntryKicked {
			if delErr := a.Events.DeleteEntry(r.Context(), ev.ID, userID); delErr != nil {
				writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "events_player_chrome_unavailable")
				return
			}
		} else {
			msg := eventsPlayerChromeString(a.Settings, r.Context(), "already_joined")
			if msg == "" {
				writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "already_joined")
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": msg, "error_key": "already_joined"})
			return
		}
	}

	fee := 0.0
	commission := 0.0
	organizerNet := 0.0
	currency := ev.EntryFeeCurrency
	if !ev.IsFreeEntry {
		if ev.EntryFeeAmount <= 0 {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_entry_fee_unavailable")
			return
		}
		if !requireCashGate(w, r, a.Cash, a.Users, a.Settings, a.resolvePayerCountry(r)) {
			return
		}
		fee = ev.EntryFeeAmount
		commission, organizerNet = payments.SplitEntryFeeCommission(fee, ev.EntryFeeCommissionPercent)
		if bal := a.Payments.WalletBalance(r.Context(), userID, currency); bal < fee {
			msg := eventsPlayerChromeString(a.Settings, r.Context(), "insufficient_entry_fee")
			if msg == "" {
				writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_insufficient_balance")
				return
			}
			writeJSON(w, http.StatusPaymentRequired, map[string]any{
				"error":     msg,
				"error_key": "insufficient_entry_fee",
				"balance":   bal,
				"currency":  currency,
			})
			return
		}
	}

	// Product: always auto-approve. Insert seat with zero fee amounts first (currency required
	// by DB check), settle wallet, then stamp fee columns so settle failure never leaves
	// paid KPI rows without a ledger.
	entryStatus := enums.HostedEventEntryApproved
	entryCurrency := strings.TrimSpace(currency)
	if entryCurrency == "" {
		entryCurrency = strings.TrimSpace(ev.EntryFeeCurrency)
	}
	entry, err := a.Events.JoinWithCapacity(r.Context(), ev.ID, userID, entryStatus,
		0, 0, 0, entryCurrency, store.PlayerCapOrZero(ev.MaxPlayers), enums.HostedEventEntryApproved)
	if err != nil {
		if errors.Is(err, store.ErrHostedEventConflict) {
			msg := eventsPlayerChromeString(a.Settings, r.Context(), "already_joined")
			key := "already_joined"
			if msg == "" {
				msg = eventsPlayerChromeString(a.Settings, r.Context(), "event_full")
				key = "event_full"
			}
			if msg == "" {
				writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "events_player_chrome_unavailable")
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": msg, "error_key": key})
			return
		}
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "events_player_chrome_unavailable")
		return
	}
	if fee > 0 {
		if err := a.Payments.SettleEventEntryFee(r.Context(), userID, ev.OrganizerID,
			fee, commission, organizerNet, currency, entry.ID); err != nil {
			if delErr := a.Events.DeleteEntry(r.Context(), ev.ID, userID); delErr != nil {
				writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "events_player_chrome_unavailable")
				return
			}
			msg := eventsPlayerChromeString(a.Settings, r.Context(), "insufficient_entry_fee")
			if msg == "" {
				writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_insufficient_balance")
				return
			}
			writeJSON(w, http.StatusPaymentRequired, map[string]any{
				"error":     msg,
				"error_key": "insufficient_entry_fee",
				"balance":   a.Payments.WalletBalance(r.Context(), userID, currency),
				"currency":  currency,
			})
			return
		}
		stamped, stampErr := a.Events.SetEntryFeeMoney(r.Context(), ev.ID, userID,
			fee, commission, organizerNet, currency)
		if stampErr != nil {
			_ = a.Payments.RefundEventEntryFee(r.Context(), userID, ev.OrganizerID,
				fee, organizerNet, currency, entry.ID)
			_ = a.Events.DeleteEntry(r.Context(), ev.ID, userID)
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "events_player_chrome_unavailable")
			return
		}
		entry = stamped
	}
	ev, _ = a.Events.RefreshOpenOrFull(r.Context(), ev.ID, enums.HostedEventEntryApproved, enums.HostedEventDefaultStatus, enums.HostedEventFullStatus)
	if a.emitPool() {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, userID, notifications.KindPlayerEventJoined,
			"event_joined:"+ev.ID+":"+userID, ev.ID, ev.Title)
		joinerName := userID
		if a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), userID); err == nil && u != nil {
				joinerName = u.Username
			}
		}
		if ev.OrganizerID != userID {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, ev.OrganizerID, notifications.KindPlayerEventPlayerJoined,
				"event_player_joined:"+ev.ID+":"+userID, ev.ID, joinerName, ev.Title)
			if organizerNet > 0 {
				args := notifications.MoneyArgs(organizerNet, currency)
				hrefEntity := entry.ID
				if a.Payments != nil {
					if lid := a.Payments.LedgerIDByUserKindRef(
						r.Context(),
						ev.OrganizerID,
						payments.LedgerKindEventEntryEarned,
						"hosted_event_entry:"+entry.ID,
					); lid != "" {
						hrefEntity = lid
					}
				}
				notifications.EmitPlayer(r.Context(), a.DB.Pool, ev.OrganizerID, notifications.KindPlayerEventEntryEarned,
					"event_entry_earned:"+entry.ID, hrefEntity, append(args, ev.Title)...)
			}
		}
	}
	if entry != nil {
		entry.StatusLabel = store.StatusLabel(enums.HostedEventEntryStatusLabels, entry.Status)
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"entry": entry,
		"event": a.publicEventWithHost(r.Context(), ev, enums),
	})
}

func (a *HostedEventsAPI) requireOrganizer(w http.ResponseWriter, r *http.Request, ev *store.HostedEvent) bool {
	userID := auth.UserIDFromContext(r.Context())
	if ev == nil || userID == "" || ev.OrganizerID != userID {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "not_organizer")
		if msg == "" {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_forbidden")
			return false
		}
		writeJSON(w, http.StatusForbidden, map[string]string{"error": msg})
		return false
	}
	return true
}

func (a *HostedEventsAPI) ListEntries(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireCanViewEvent(w, r, ev, enums) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	isOrganizer := ev.OrganizerID == userID
	approvedOnly := ""
	if !isOrganizer {
		approvedOnly = strings.TrimSpace(enums.HostedEventEntryApproved)
		if approvedOnly == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
			return
		}
	}

	// Paged roster when skip+limit present (Manage Players/Payments). Unpaged keeps Results/lobby full.
	wantsPage := strings.TrimSpace(r.URL.Query().Get("skip")) != "" ||
		strings.TrimSpace(r.URL.Query().Get("limit")) != ""
	if wantsPage {
		params, labels, skipCap, pageOK := parseListPagination(w, r, a.Settings)
		if !pageOK {
			return
		}
		entries, total, err := a.Events.ListEntriesPage(
			r.Context(), ev.ID, params.Skip, params.Limit, approvedOnly,
		)
		if err != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_entries_failed")
			return
		}
		for i := range entries {
			entries[i].StatusLabel = store.StatusLabel(enums.HostedEventEntryStatusLabels, entries[i].Status)
		}
		meta := pagination.BuildMeta(params, total, skipCap, labels)
		out := map[string]any{"entries": entries, "meta": meta}
		if isOrganizer {
			totals, terr := a.Events.EntryFeeTotals(r.Context(), ev.ID)
			if terr != nil || totals == nil {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_entries_failed")
				return
			}
			out["entry_fees_gross"] = totals.Gross
			out["entry_fees_commission"] = totals.Commission
			out["entry_fees_organizer_net"] = totals.OrganizerNet
			out["entry_fees_paid_count"] = totals.PaidCount
			out["entry_fees_currency"] = totals.Currency
		}
		writeJSON(w, http.StatusOK, out)
		return
	}

	if !isOrganizer {
		entries, err := a.Events.ListEntries(r.Context(), ev.ID)
		if err != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_entries_failed")
			return
		}
		out := make([]store.HostedEventEntry, 0)
		for _, en := range entries {
			if en.Status == enums.HostedEventEntryApproved {
				en.StatusLabel = store.StatusLabel(enums.HostedEventEntryStatusLabels, en.Status)
				out = append(out, en)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"entries": out})
		return
	}
	entries, err := a.Events.ListEntries(r.Context(), ev.ID)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_entries_failed")
		return
	}
	for i := range entries {
		entries[i].StatusLabel = store.StatusLabel(enums.HostedEventEntryStatusLabels, entries[i].Status)
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

// ListLiveBoards is GET /events/{id}/live-boards - organizer skip/go list of unfinished boards.
func (a *HostedEventsAPI) ListLiveBoards(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	params, labels, skipCap, pageOK := parseListPagination(w, r, a.Settings)
	if !pageOK {
		return
	}
	officialOnly := strings.TrimSpace(r.URL.Query().Get("official_only")) == "1" ||
		strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("official_only")), "true")

	all, err := a.Events.ListLiveBracketMatches(r.Context(), ev.ID)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_bracket_failed")
		return
	}
	for i := range all {
		all[i].StatusLabel = store.StatusLabel(enums.HostedEventBracketStatusLabels, all[i].Status)
	}

	officialCount := 0
	filtered := make([]store.HostedBracketMatch, 0, len(all))
	for _, m := range all {
		gid := ""
		if m.GameID != nil {
			gid = strings.TrimSpace(*m.GameID)
		}
		isOfficial := false
		if gid != "" && a.Games != nil {
			if rec, ok := a.Games.GetAuthoritative(gid); ok && rec.State != nil {
				kind := strings.TrimSpace(rec.State.PauseKind)
				isOfficial = rec.State.Paused && kind == engine.PauseKindOfficial
			}
		}
		if isOfficial {
			officialCount++
		}
		if officialOnly && !isOfficial {
			continue
		}
		filtered = append(filtered, m)
	}

	total := len(filtered)
	page := []store.HostedBracketMatch{}
	if params.Skip < total {
		end := params.Skip + params.Limit
		if end > total {
			end = total
		}
		page = filtered[params.Skip:end]
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{
		"matches":                 page,
		"meta":                    meta,
		"officially_paused_count": officialCount,
	})
}

func (a *HostedEventsAPI) setEntryStatus(w http.ResponseWriter, r *http.Request, status string) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	if ev.Status == enums.HostedEventLiveStatus || ev.Status == enums.HostedEventFinishedStatus ||
		ev.Status == enums.HostedEventCancelledStatus {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_event_not_editable")
		return
	}
	userID := chi.URLParam(r, "userId")
	if status == enums.HostedEventEntryApproved {
		approved, _ := a.Events.CountByStatus(r.Context(), ev.ID, enums.HostedEventEntryApproved)
		if existing, err := a.Events.GetEntry(r.Context(), ev.ID, userID); err == nil && existing.Status != enums.HostedEventEntryApproved {
			if seatCap := store.PlayerCapOrZero(ev.MaxPlayers); seatCap > 0 && approved >= seatCap {
				msg := eventsOrganizerChromeString(a.Settings, r.Context(), "event_full")
				if msg == "" {
					writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "event_full")
					return
				}
				writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
				return
			}
		}
	}
	en, err := a.Events.SetEntryStatus(r.Context(), ev.ID, userID, status)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_entry_not_found")
		return
	}
	ev, _ = a.Events.RefreshOpenOrFull(r.Context(), ev.ID, enums.HostedEventEntryApproved, enums.HostedEventDefaultStatus, enums.HostedEventFullStatus)
	if en != nil {
		en.StatusLabel = store.StatusLabel(enums.HostedEventEntryStatusLabels, en.Status)
	}
	writeJSON(w, http.StatusOK, map[string]any{"entry": en, "event": a.publicEventWithHost(r.Context(), ev, enums)})
}

func (a *HostedEventsAPI) ApproveEntry(w http.ResponseWriter, r *http.Request) {
	// Product: joins are always auto-approved. Manual approve is disabled.
	msg := eventsOrganizerChromeString(a.Settings, r.Context(), "force_auto_approve_note")
	if msg == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_auto_approve_only")
		return
	}
	writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
}

func (a *HostedEventsAPI) RejectEntry(w http.ResponseWriter, r *http.Request) {
	// Reject of a paid seat must refund: reuse kick path.
	a.KickEntry(w, r)
}

func (a *HostedEventsAPI) KickEntry(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	if ev.Status == enums.HostedEventLiveStatus || ev.Status == enums.HostedEventFinishedStatus ||
		ev.Status == enums.HostedEventCancelledStatus {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_event_not_editable")
		return
	}
	userID := chi.URLParam(r, "userId")
	existing, err := a.Events.GetEntry(r.Context(), ev.ID, userID)
	if err != nil || existing == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_entry_not_found")
		return
	}
	if existing.Status == enums.HostedEventEntryKicked {
		existing.StatusLabel = store.StatusLabel(enums.HostedEventEntryStatusLabels, existing.Status)
		writeJSON(w, http.StatusOK, map[string]any{"entry": existing, "event": a.publicEventWithHost(r.Context(), ev, enums)})
		return
	}
	if existing.Status == enums.HostedEventEntryApproved && existing.FeePaid > 0 {
		if a.Payments == nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
			return
		}
		if err := a.Payments.RefundEventEntryFee(r.Context(), existing.UserID, ev.OrganizerID,
			existing.FeePaid, existing.OrganizerNet, existing.FeeCurrency, existing.ID); err != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
			return
		}
		if err := a.Events.ClearEntryFeeColumns(r.Context(), ev.ID, userID); err != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
			return
		}
	}
	en, err := a.Events.SetEntryStatus(r.Context(), ev.ID, userID, enums.HostedEventEntryKicked)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_entry_not_found")
		return
	}
	ev, _ = a.Events.RefreshOpenOrFull(r.Context(), ev.ID, enums.HostedEventEntryApproved, enums.HostedEventDefaultStatus, enums.HostedEventFullStatus)
	if a.emitPool() {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, userID, notifications.KindPlayerEventEntryKicked,
			"event_entry_kicked:"+ev.ID+":"+userID, ev.JoinCode, ev.Title)
	}
	if en != nil {
		en.StatusLabel = store.StatusLabel(enums.HostedEventEntryStatusLabels, en.Status)
	}
	writeJSON(w, http.StatusOK, map[string]any{"entry": en, "event": a.publicEventWithHost(r.Context(), ev, enums)})
}

func (a *HostedEventsAPI) releasePrizeGuaranteeIfHeld(ctx context.Context, ev *store.HostedEvent) error {
	if a == nil || ev == nil || !ev.PrizePoolGuaranteeHeld || ev.PrizePoolGuaranteeAmount <= 0 {
		return nil
	}
	if ev.PrizePoolGuaranteeCaptured {
		return errors.New("prize pool guarantee already captured")
	}
	// Fail closed: never release after the cup has started (Arena live hold must finish-capture).
	if ev.StartedAt != nil || ev.FinishedAt != nil {
		return errors.New("prize pool guarantee live cannot release")
	}
	// Fail closed: a held guarantee must never be skipped when payments is unavailable.
	if a.Payments == nil || a.DB == nil || !a.DB.Ready() {
		return errors.New("payments unavailable for prize guarantee release")
	}
	cycle := ev.PrizePoolGuaranteeCycle
	if cycle < 1 {
		cycle = 1
	}
	// Atomic: wallet release + clear held (no held=true after money returned).
	tx, err := a.DB.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := a.Payments.ReleasePrizePoolGuaranteeTx(ctx, tx, ev.OrganizerID,
		ev.PrizePoolGuaranteeAmount, ev.EntryFeeCurrency, ev.ID, cycle); err != nil {
		return err
	}
	if _, err := a.Events.ClearPrizePoolGuaranteeHeldTx(ctx, tx, ev.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// refundAndVacateEntries refunds paid seats then kicks every approved entry so reopen
// cannot restore free seats after a close/cancel/deactivate.
func (a *HostedEventsAPI) refundAndVacateEntries(ctx context.Context, ev *store.HostedEvent, approvedStatus, kickedStatus string) error {
	if a == nil || ev == nil {
		return nil
	}
	entries, err := a.Events.ListEntries(ctx, ev.ID)
	if err != nil {
		return err
	}
	for i := range entries {
		en := entries[i]
		if en.Status != approvedStatus {
			continue
		}
		if en.FeePaid > 0 {
			if a.Payments == nil {
				return errors.New("payments unavailable for entry fee refund")
			}
			if err := a.Payments.RefundEventEntryFee(ctx, en.UserID, ev.OrganizerID,
				en.FeePaid, en.OrganizerNet, en.FeeCurrency, en.ID); err != nil {
				return err
			}
			if err := a.Events.ClearEntryFeeColumns(ctx, ev.ID, en.UserID); err != nil {
				return err
			}
		}
		if _, err := a.Events.SetEntryStatus(ctx, ev.ID, en.UserID, kickedStatus); err != nil {
			return err
		}
	}
	return nil
}

func (a *HostedEventsAPI) Cancel(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	if ev.Status == enums.HostedEventLiveStatus || ev.Status == enums.HostedEventFinishedStatus {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_cannot_close")
		return
	}
	notifyIDs, _ := a.Events.ListApprovedUserIDs(r.Context(), ev.ID, enums.HostedEventEntryApproved, false)
	if err := a.refundAndVacateEntries(r.Context(), ev, enums.HostedEventEntryApproved, enums.HostedEventEntryKicked); err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
		return
	}
	if err := a.releasePrizeGuaranteeIfHeld(r.Context(), ev); err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
		return
	}
	ev, err = a.Events.Cancel(r.Context(), ev.ID, enums.HostedEventCancelledStatus)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_close_failed")
		return
	}
	if a.emitPool() {
		notifyIDs = append(notifyIDs, ev.OrganizerID)
		a.notifyEventPlayers(r.Context(), notifyIDs, notifications.KindPlayerEventCancelled,
			"event_cancelled:"+ev.ID, ev.JoinCode, ev.Title)
		a.notifyEventAdmins(r.Context(), notifications.KindAdminEventClosed,
			"admin_event_closed:"+ev.ID, ev.ID, ev.Title)
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

// Close is the organizer table action alias for Cancel (manual close before start).
func (a *HostedEventsAPI) Close(w http.ResponseWriter, r *http.Request) {
	a.Cancel(w, r)
}

// Reopen restores a manually closed event that never started and was never auto-finished.
func (a *HostedEventsAPI) Reopen(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	if ev.Status != enums.HostedEventCancelledStatus {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "cannot_reopen_blurb")
		return
	}
	if ev.StartedAt != nil || ev.FinishedAt != nil {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "cannot_reopen_blurb")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "cannot_reopen_blurb")
			return
		}
		writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
		return
	}
	// Paid reopen re-enters the open-paid set: apply the same host trust ops gates as create.
	if !ev.IsFreeEntry {
		if !a.enforcePaidHostOpsGates(w, r, ev.OrganizerID, enums, true, "err_create_failed") {
			return
		}
	}
	needReopenEscrow := ev.PrizePoolGuaranteeEnabled && ev.PrizePoolGuaranteeAmount > 0 &&
		!ev.PrizePoolGuaranteeCaptured && !ev.PrizePoolGuaranteeHeld
	if needReopenEscrow {
		// Same Tier C gate as create: re-hold requires approved document KYC when policy says so.
		if a.Cash != nil && a.Cash.Ready() && a.Cash.Policy().HostGuaranteeRequiresDocumentKyc {
			policy := a.Cash.Policy()
			okDoc := false
			if hostUser, uErr := a.Users.GetByID(r.Context(), ev.OrganizerID); uErr == nil && hostUser != nil {
				okDoc = hostUser.DocumentKycVerifiedAt != nil
			}
			if !okDoc && a.Docs != nil {
				okDoc, _ = a.Docs.HasApprovedDocument(r.Context(), ev.OrganizerID, policy.DocumentKycApprovedStatus)
			}
			if !okDoc {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_host_guarantee_requires_document_kyc")
				return
			}
		}
		if a.Payments == nil || a.DB == nil || !a.DB.Ready() {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_reopen_guarantee_hold_failed")
			return
		}
		// Atomic: bump cycle + hold + mark held + reopen status (fail rolls back; no stuck cycle/hold).
		tx, txErr := a.DB.Pool.Begin(r.Context())
		if txErr != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_reopen_guarantee_hold_failed")
			return
		}
		defer tx.Rollback(r.Context())

		bumped, bumpErr := a.Events.BumpPrizePoolGuaranteeCycleTx(r.Context(), tx, ev.ID)
		if bumpErr != nil || bumped == nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_reopen_guarantee_hold_failed")
			return
		}
		ev = bumped
		cycle := ev.PrizePoolGuaranteeCycle
		if cycle < 1 {
			cycle = 1
		}
		amt := payments.RoundMoney2(ev.PrizePoolGuaranteeAmount)
		if holdErr := a.Payments.SettlePrizePoolGuaranteeHoldTx(
			r.Context(), tx, ev.OrganizerID, amt, ev.EntryFeeCurrency, ev.ID, cycle,
		); holdErr != nil {
			key := "err_reopen_guarantee_hold_failed"
			if errors.Is(holdErr, payments.ErrInsufficientWalletBalance) {
				key = "insufficient_prize_guarantee"
			}
			msg := eventsOrganizerChromeString(a.Settings, r.Context(), key)
			if msg == "" {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusPaymentRequired, key)
				return
			}
			writeJSON(w, http.StatusPaymentRequired, map[string]any{
				"error":     msg,
				"error_key": key,
				"balance":   a.Payments.WalletBalance(r.Context(), ev.OrganizerID, ev.EntryFeeCurrency),
				"currency":  ev.EntryFeeCurrency,
			})
			return
		}
		held, holdMarkErr := a.Events.MarkPrizePoolGuaranteeHeldTx(r.Context(), tx, ev.ID)
		if holdMarkErr != nil || held == nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_reopen_guarantee_hold_failed")
			return
		}
		ev = held
		reopened, reopenErr := a.Events.ReopenTx(r.Context(), tx, ev.ID, enums.HostedEventCancelledStatus, enums.HostedEventDefaultStatus)
		if reopenErr != nil || reopened == nil {
			msg := eventsOrganizerChromeString(a.Settings, r.Context(), "cannot_reopen_blurb")
			if msg == "" {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "cannot_reopen_blurb")
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
			return
		}
		if commitErr := tx.Commit(r.Context()); commitErr != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_reopen_guarantee_hold_failed")
			return
		}
		ev = reopened
	} else {
		ev, err = a.Events.Reopen(r.Context(), ev.ID, enums.HostedEventCancelledStatus, enums.HostedEventDefaultStatus)
		if err != nil {
			msg := eventsOrganizerChromeString(a.Settings, r.Context(), "cannot_reopen_blurb")
			if msg == "" {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "cannot_reopen_blurb")
				return
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
			return
		}
	}
	if refreshed, err := a.Events.RefreshOpenOrFull(r.Context(), ev.ID, enums.HostedEventEntryApproved,
		enums.HostedEventDefaultStatus, enums.HostedEventFullStatus); err == nil && refreshed != nil {
		ev = refreshed
	} else {
		ev, _ = a.Events.Get(r.Context(), ev.ID)
	}
	if a.emitPool() && ev != nil {
		// Close vacates seats to kicked; notify those players so they can rejoin.
		ids, _ := a.Events.ListEntryUserIDs(r.Context(), ev.ID)
		ids = append(ids, ev.OrganizerID)
		a.notifyEventPlayers(r.Context(), ids, notifications.KindPlayerEventReopened,
			"event_reopened:"+ev.ID, ev.JoinCode, ev.Title)
		a.notifyEventAdmins(r.Context(), notifications.KindAdminEventReopened,
			"admin_event_reopened:"+ev.ID, ev.ID, ev.Title)
	}
	writeJSON(w, http.StatusOK, a.publicEventWithHost(r.Context(), ev, enums))
}

func (a *HostedEventsAPI) Start(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, cat, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	if ev.Status != enums.HostedEventDefaultStatus && ev.Status != enums.HostedEventFullStatus {
		// Always include error_key so clients map DB chrome (never body-only English).
		if eventsOrganizerChromeString(a.Settings, r.Context(), "already_started") != "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "already_started")
			return
		}
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_cannot_start")
		return
	}
	format, fok := a.Settings.FindEventsCatalogFormat(ev.FormatID)
	if !fok || !format.Enabled {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "format_unavailable")
		return
	}
	// Industry no-show gate: classic formats seed from checked-in approved seats.
	// Arena opens the clock from enrolled seats; queue is the play gate.
	requireCheckedIn := strings.TrimSpace(ev.FormatID) != strings.TrimSpace(enums.HostedEventArenaFormat)
	players, err := a.Events.ListApprovedUserIDs(r.Context(), ev.ID, enums.HostedEventEntryApproved, requireCheckedIn)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	minStart := cat.MinPlayersToStart[ev.FormatID]
	if minStart < 2 {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	if len(players) < minStart {
		// Always include error_key so web/Flutter map DB chrome (checked-in gate for classic).
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "not_enough_players")
		return
	}
	bst := store.HostedBracketStatuses{
		Pending: enums.HostedEventBracketPending,
		Ready:   enums.HostedEventBracketReady,
		Live:    enums.HostedEventBracketLive,
		Done:    enums.HostedEventBracketDone,
		Bye:     enums.HostedEventBracketBye,
	}
	phases := store.HostedFormatPhases{
		Knockout:   enums.HostedEventPhaseKnockout,
		RoundRobin: enums.HostedEventPhaseRoundRobin,
		Swiss:      enums.HostedEventPhaseSwiss,
		Group:      enums.HostedEventPhaseGroup,
		Arena:      enums.HostedEventPhaseArena,
	}
	var bracket []store.HostedBracketMatch
	var arenaStarted bool
	switch ev.FormatID {
	case enums.HostedEventArenaFormat:
		dur, derr := resolveArenaDurationMinutes(ev.ArenaDurationMinutes, enums)
		if derr != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "toast_arena_start_failed")
			return
		}
		ev, err = a.Events.StartArena(r.Context(), ev.ID, dur, phases.Arena)
		if err != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "toast_arena_start_failed")
			return
		}
		arenaStarted = true
	case enums.HostedEventKnockoutFormat:
		bracket, err = a.Events.GenerateKnockoutBracket(r.Context(), ev.ID, players, bst, phases.Knockout)
	case enums.HostedEventRoundRobinFormat:
		bracket, err = a.Events.GenerateRoundRobinBracket(r.Context(), ev.ID, players, bst, phases.RoundRobin)
	case enums.HostedEventSwissFormat:
		if len(cat.SwissRoundsByMaxPlayers) == 0 {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
			return
		}
		bracket, err = a.Events.GenerateSwissBracket(r.Context(), ev.ID, players, bst, phases.Swiss)
	case enums.HostedEventGroupsKnockoutFormat:
		if cat.GroupsKnockoutTargetGroupSize < 2 || cat.GroupsKnockoutAdvancePerGroup < 1 {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
			return
		}
		bracket, err = a.Events.GenerateGroupsKnockoutBracket(
			r.Context(), ev.ID, players, bst, phases,
			cat.GroupsKnockoutTargetGroupSize, cat.GroupsKnockoutAdvancePerGroup,
		)
	default:
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "format_unavailable")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_format_not_startable")
			return
		}
		writeJSON(w, http.StatusConflict, map[string]string{"error": msg})
		return
	}
	if err != nil && !arenaStarted {
		if errors.Is(err, store.ErrHostedAlreadyHasBracket) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_bracket_exists")
			return
		}
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "toast_start_failed")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	priorStatus := ev.Status
	eventID := ev.ID
	frozePool := false
	needCapture := false
	captureGuarantee := 0.0
	// Start compensation: classic clears unstarted bracket (+ freeze); Arena clears clock if
	// StartArena ran but MarkLive did not. Fail closed when compensation itself errors.
	abortStart := func() error {
		if arenaStarted {
			_, err := a.Events.RevertArenaClockAfterFailedStart(r.Context(), eventID, priorStatus)
			return err
		}
		if frozePool {
			if _, err := a.Events.ClearPrizePoolFreeze(r.Context(), eventID); err != nil {
				return err
			}
		}
		return a.Events.ClearUnstartedBracket(r.Context(), eventID)
	}
	revertLiveOrFail := func() {
		if _, err := a.Events.RevertLiveAfterFailedStart(r.Context(), eventID, priorStatus); err != nil {
			log.Printf("hosted Start: RevertLiveAfterFailedStart failed event_id=%s: %v", eventID, err)
		}
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
	}
	if !arenaStarted && ev.PrizePoolDisplayEnabled && !ev.IsFreeEntry {
		sum, sumErr := a.Events.SumEntryOrganizerNets(r.Context(), eventID)
		if sumErr != nil {
			_ = abortStart()
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
			return
		}
		entryPot := payments.RoundMoney2(sum)
		if ev.PrizePoolGuaranteeEnabled && ev.PrizePoolGuaranteeHeld && !ev.PrizePoolGuaranteeCaptured && ev.PrizePoolGuaranteeAmount > 0 {
			captureGuarantee = payments.RoundMoney2(ev.PrizePoolGuaranteeAmount)
			needCapture = captureGuarantee > 0
		}
		if needCapture && a.Payments == nil {
			if err := abortStart(); err != nil {
				log.Printf("hosted Start: abortStart failed event_id=%s: %v", eventID, err)
			}
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
			return
		}
		frozen, freezeErr := a.Events.FreezePrizePool(r.Context(), eventID, payments.PrizePoolFloor(entryPot, captureGuarantee))
		if freezeErr != nil || frozen == nil {
			if err := abortStart(); err != nil {
				log.Printf("hosted Start: abortStart failed event_id=%s: %v", eventID, err)
			}
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
			return
		}
		ev = frozen
		frozePool = true
	}
	ev, err = a.Events.MarkLive(r.Context(), eventID, enums.HostedEventLiveStatus)
	if err != nil {
		if abortErr := abortStart(); abortErr != nil {
			log.Printf("hosted Start: abortStart after MarkLive fail event_id=%s: %v", eventID, abortErr)
		}
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	checkInHours := optionalCheckInCloseHours(enums.CompetitionCheckInWindowHours)
	if refreshed, emitCheckIn, ensureErr := a.Events.EnsureCheckInOpenForCupStart(
		r.Context(), eventID, checkInHours,
	); ensureErr == nil && refreshed != nil {
		ev = refreshed
		if emitCheckIn {
			emitEventCheckInOpen(r.Context(), a.DB, ev, players)
		}
	}
	if needCapture {
		cycle := ev.PrizePoolGuaranteeCycle
		if cycle < 1 {
			cycle = 1
		}
		if a.DB == nil || !a.DB.Ready() {
			revertLiveOrFail()
			return
		}
		// Atomic: capture ledger + captured stamp (no held=true after capture).
		capTx, capTxErr := a.DB.Pool.Begin(r.Context())
		if capTxErr != nil {
			revertLiveOrFail()
			return
		}
		capOK := false
		defer func() {
			if !capOK {
				_ = capTx.Rollback(r.Context())
			}
		}()
		if capErr := a.Payments.CapturePrizePoolGuaranteeTx(r.Context(), capTx, ev.OrganizerID, captureGuarantee, ev.EntryFeeCurrency, eventID, cycle); capErr != nil {
			revertLiveOrFail()
			return
		}
		stamped, stampErr := a.Events.MarkPrizePoolGuaranteeCapturedTx(r.Context(), capTx, eventID)
		if stampErr != nil || stamped == nil {
			revertLiveOrFail()
			return
		}
		if commitErr := capTx.Commit(r.Context()); commitErr != nil {
			revertLiveOrFail()
			return
		}
		capOK = true
		ev = stamped
	}
	if a.emitPool() {
		startKind := notifications.KindPlayerEventStarted
		if arenaStarted {
			startKind = notifications.KindPlayerArenaStarted
		}
		a.notifyEventPlayers(r.Context(), players, startKind,
			"event_started:"+ev.ID, ev.ID, ev.Title)
		if ev.OrganizerID != "" {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, ev.OrganizerID, notifications.KindPlayerEventStartedOrg,
				"event_started_org:"+ev.ID, ev.ID, ev.Title)
		}
	}
	for i := range bracket {
		bracket[i].StatusLabel = store.StatusLabel(enums.HostedEventBracketStatusLabels, bracket[i].Status)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"event":   a.publicEventWithHost(r.Context(), ev, enums),
		"bracket": bracket,
	})
}

func (a *HostedEventsAPI) GetBracket(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	ev, err := a.Events.Get(r.Context(), id)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireCanViewEvent(w, r, ev, enums) {
		return
	}
	bracket, err := a.Events.ListBracket(r.Context(), id)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_bracket_failed")
		return
	}
	for i := range bracket {
		bracket[i].StatusLabel = store.StatusLabel(enums.HostedEventBracketStatusLabels, bracket[i].Status)
	}
	writeJSON(w, http.StatusOK, map[string]any{"bracket": bracket})
}

func (a *HostedEventsAPI) GetStandings(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	ev, err := a.Events.Get(r.Context(), id)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireCanViewEvent(w, r, ev, enums) {
		return
	}
	bst := store.HostedBracketStatuses{
		Pending: enums.HostedEventBracketPending,
		Ready:   enums.HostedEventBracketReady,
		Live:    enums.HostedEventBracketLive,
		Done:    enums.HostedEventBracketDone,
		Bye:     enums.HostedEventBracketBye,
	}
	phaseFilter := store.StandingsPhaseFilterForFormat(enums, ev.FormatID)
	ppw, ppwErr := store.StandingsPointsPerWin(enums)
	if ppwErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	ppd, ppdErr := store.StandingsPointsPerDraw(enums)
	if ppdErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	rows, err := a.Events.ListStandings(r.Context(), id, bst, phaseFilter, ppw, ppd)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_bracket_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"standings":    rows,
		"format_id":    ev.FormatID,
		"phase_filter": phaseFilter,
	})
}

func (a *HostedEventsAPI) StartGame(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if ev.Status != enums.HostedEventLiveStatus {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_event_not_live")
		return
	}
	matchID := chi.URLParam(r, "matchId")
	m, err := a.Events.GetBracketMatch(r.Context(), ev.ID, matchID)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_match_not_found")
		return
	}
	if m.Status != enums.HostedEventBracketReady {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_match_not_ready")
		return
	}
	if m.PlayerAID == nil || m.PlayerBID == nil || *m.PlayerAID == "" || *m.PlayerBID == "" {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_players_missing")
		return
	}
	isOrganizer := strings.TrimSpace(ev.OrganizerID) != "" && strings.TrimSpace(ev.OrganizerID) == userID
	isSeat := *m.PlayerAID == userID || *m.PlayerBID == userID
	if !isOrganizer && !isSeat {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_forbidden")
		return
	}
	// Organizer may force-start; seated players only when both have marked ready (cup lobby recovery).
	force := isOrganizer
	bst := a.eventBracketStatuses(enums)
	resp, startErr := a.startEventMatchGame(r.Context(), ev, m, bst, enums, force)
	if startErr != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_match_not_ready")
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

// eventFinishAfterBracket escrows prizes + dispute notices when a cup first reaches finished
// (organizer forfeit / ready-timeout). Board-game finish uses API.AdvanceBracketFromGame.
// freezeEventPrizePoolAtFinishIfNeeded freezes the live pot for Arena (late-join) cups and
// captures any held organizer guarantee into that pot (fail-closed). Classic formats freeze at Start.
func (a *HostedEventsAPI) freezeEventPrizePoolAtFinishIfNeeded(ctx context.Context, ev *store.HostedEvent) (*store.HostedEvent, error) {
	if ev == nil || ev.IsFreeEntry || !ev.PrizePoolDisplayEnabled || ev.PrizePoolFrozenAmount != nil {
		return ev, nil
	}
	if a.Events == nil {
		return ev, errors.New("events store unavailable")
	}
	sum, err := a.Events.SumEntryOrganizerNets(ctx, ev.ID)
	if err != nil {
		return ev, err
	}
	entryPot := payments.RoundMoney2(sum)
	captureGuarantee := 0.0
	if ev.PrizePoolGuaranteeEnabled && ev.PrizePoolGuaranteeHeld && !ev.PrizePoolGuaranteeCaptured && ev.PrizePoolGuaranteeAmount > 0 {
		captureGuarantee = payments.RoundMoney2(ev.PrizePoolGuaranteeAmount)
	}
	if captureGuarantee > 0 && a.Payments == nil {
		return ev, errors.New("payments unavailable for prize guarantee capture")
	}
	amt := payments.PrizePoolFloor(entryPot, captureGuarantee)
	frozen, freezeErr := a.Events.FreezePrizePool(ctx, ev.ID, amt)
	if freezeErr != nil || frozen == nil {
		if freezeErr != nil {
			return ev, freezeErr
		}
		return ev, errors.New("prize pool freeze failed")
	}
	if captureGuarantee > 0 {
		cycle := frozen.PrizePoolGuaranteeCycle
		if cycle < 1 {
			cycle = 1
		}
		if a.DB == nil || !a.DB.Ready() {
			_, _ = a.Events.ClearPrizePoolFreeze(ctx, frozen.ID)
			return ev, errors.New("database unavailable for prize guarantee capture")
		}
		capTx, capTxErr := a.DB.Pool.Begin(ctx)
		if capTxErr != nil {
			_, _ = a.Events.ClearPrizePoolFreeze(ctx, frozen.ID)
			return ev, capTxErr
		}
		capOK := false
		defer func() {
			if !capOK {
				_ = capTx.Rollback(ctx)
			}
		}()
		if capErr := a.Payments.CapturePrizePoolGuaranteeTx(
			ctx, capTx, frozen.OrganizerID, captureGuarantee, frozen.EntryFeeCurrency, frozen.ID, cycle,
		); capErr != nil {
			_, _ = a.Events.ClearPrizePoolFreeze(ctx, frozen.ID)
			return ev, capErr
		}
		stamped, stampErr := a.Events.MarkPrizePoolGuaranteeCapturedTx(ctx, capTx, frozen.ID)
		if stampErr != nil || stamped == nil {
			_, _ = a.Events.ClearPrizePoolFreeze(ctx, frozen.ID)
			if stampErr != nil {
				return ev, stampErr
			}
			return ev, errors.New("prize pool guarantee capture stamp failed")
		}
		if commitErr := capTx.Commit(ctx); commitErr != nil {
			_, _ = a.Events.ClearPrizePoolFreeze(ctx, frozen.ID)
			return ev, commitErr
		}
		capOK = true
		return stamped, nil
	}
	return frozen, nil
}

func (a *HostedEventsAPI) eventFinishAfterBracket(ctx context.Context, eventID string, finishedBefore bool, enums store.ClientEnumsConfig) {
	if finishedBefore || a == nil || a.Events == nil {
		return
	}
	ev, err := a.Events.Get(ctx, eventID)
	if err != nil || ev == nil || ev.FinishedAt == nil {
		return
	}
	isArena := strings.TrimSpace(ev.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
	if isArena {
		frozen, freezeErr := a.freezeEventPrizePoolAtFinishIfNeeded(ctx, ev)
		if freezeErr != nil {
			log.Printf("eventFinishAfterBracket: arena freeze failed event_id=%s: %v", eventID, freezeErr)
			return
		}
		ev = frozen
	}
	if a.CompetitionPrizes != nil {
		if err := a.CompetitionPrizes.EscrowEventFinish(ctx, ev, enums.HostedEventEntryApproved); err != nil {
			log.Printf("eventFinishAfterBracket: escrow failed event_id=%s: %v", eventID, err)
			return
		}
		if refreshed, getErr := a.Events.Get(ctx, eventID); getErr == nil && refreshed != nil {
			ev = refreshed
		}
		if a.DB != nil && a.DB.Ready() && ev.DisputeWindowEndsAt != nil {
			ids, _ := a.Events.ListApprovedUserIDs(ctx, ev.ID, enums.HostedEventEntryApproved, false)
			for _, uid := range ids {
				uid = strings.TrimSpace(uid)
				if uid == "" {
					continue
				}
				notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerCompetitionDisputeOpen,
					"competition_dispute:event:"+ev.ID+":"+uid, ev.ID, ev.Title)
			}
		}
	}
	if a.DB == nil || !a.DB.Ready() || isArena {
		return
	}
	ids, _ := a.Events.ListApprovedUserIDs(ctx, ev.ID, enums.HostedEventEntryApproved, false)
	seen := map[string]struct{}{}
	for _, uid := range ids {
		uid = strings.TrimSpace(uid)
		if uid == "" || uid == ev.OrganizerID {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerEventFinished,
			"event_finished:"+ev.ID+":"+uid, ev.ID, ev.Title)
	}
}

func (a *HostedEventsAPI) ForfeitMatch(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, cat, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	if ev.Status != enums.HostedEventLiveStatus {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_event_not_live")
		return
	}
	finishedBefore := ev.FinishedAt != nil
	var body struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.UserID) == "" {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_forfeit_failed")
		return
	}
	matchID := chi.URLParam(r, "matchId")
	bst := a.eventBracketStatuses(enums)
	arenaScore, arenaScoreErr := store.ParseArenaScoreConfig(enums)
	if arenaScoreErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	ppw, ppwErr := store.StandingsPointsPerWin(enums)
	if ppwErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	ppd, ppdErr := store.StandingsPointsPerDraw(enums)
	if ppdErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	updated, awards, err := a.Events.ForfeitHostedBracketMatch(
		r.Context(), ev.ID, matchID, body.UserID, bst,
		store.HostedEventStatuses{
			Open:      enums.HostedEventDefaultStatus,
			Full:      enums.HostedEventFullStatus,
			Live:      enums.HostedEventLiveStatus,
			Finished:  enums.HostedEventFinishedStatus,
			Cancelled: enums.HostedEventCancelledStatus,
		},
		enums.HostedEventEntryApproved,
		store.HostedFormatIDs{
			Knockout:       enums.HostedEventKnockoutFormat,
			RoundRobin:     enums.HostedEventRoundRobinFormat,
			Swiss:          enums.HostedEventSwissFormat,
			GroupsKnockout: enums.HostedEventGroupsKnockoutFormat,
			Arena:          enums.HostedEventArenaFormat,
		},
		store.HostedFormatPhases{
			Knockout:   enums.HostedEventPhaseKnockout,
			RoundRobin: enums.HostedEventPhaseRoundRobin,
			Swiss:      enums.HostedEventPhaseSwiss,
			Group:      enums.HostedEventPhaseGroup,
			Arena:      enums.HostedEventPhaseArena,
		},
		cat.SwissRoundsByMaxPlayers, cat.GroupsKnockoutAdvancePerGroup, arenaScore, ppw, ppd,
	)
	if err != nil {
		if errors.Is(err, store.ErrHostedBracketNotFound) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_match_not_found")
			return
		}
		if errors.Is(err, store.ErrHostedMatchForfeit) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_forfeit_failed")
			return
		}
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_forfeit_failed")
		return
	}
	if updated != nil {
		gid := ""
		if updated.GameID != nil {
			gid = strings.TrimSpace(*updated.GameID)
		}
		liveGID := gid
		if gid == "" {
			gid = "match:" + strings.TrimSpace(updated.ID)
		}
		preferArena := strings.TrimSpace(ev.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
		emitCompetitionPointsAwarded(r.Context(), a.DB, gid, ev.Title, ev.ID, awards, preferArena)
		if liveGID != "" {
			winnerID := ""
			if updated.WinnerID != nil {
				winnerID = strings.TrimSpace(*updated.WinnerID)
			}
			forceFinishLiveBoardAfterBracketWin(a.Games, a.Hub, liveGID, winnerID, "forfeit", &bracketLiveClearAudit{
				Ctx:         r.Context(),
				Store:       a.OfficialPause,
				ActorUserID: auth.UserIDFromContext(r.Context()),
				ActorRole:   "organizer",
				EventID:     ev.ID,
				Note:        "forfeit",
			})
		}
	}
	a.eventFinishAfterBracket(r.Context(), ev.ID, finishedBefore, enums)
	writeJSON(w, http.StatusOK, map[string]any{"match": updated})
}

// RematchMatch resets a ready/live unfinished bracket match (organizer ops rematch / release readiness).
func (a *HostedEventsAPI) RematchMatch(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	if ev.Status != enums.HostedEventLiveStatus {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_event_not_live")
		return
	}
	if ev.FinishedAt != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_rematch_failed")
		return
	}
	matchID := chi.URLParam(r, "matchId")
	bst := a.eventBracketStatuses(enums)
	liveGID := ""
	if before, berr := a.Events.GetBracketMatch(r.Context(), ev.ID, matchID); berr == nil && before != nil && before.GameID != nil {
		liveGID = strings.TrimSpace(*before.GameID)
	}
	// End Redis first so rematch cannot clear game_id while an official pause stays live.
	if err := abandonLiveBoardForRematch(a.Games, a.Hub, liveGID, &bracketLiveClearAudit{
		Ctx:         r.Context(),
		Store:       a.OfficialPause,
		ActorUserID: auth.UserIDFromContext(r.Context()),
		ActorRole:   "organizer",
		EventID:     ev.ID,
		Note:        "rematch",
	}); err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_rematch_failed")
		return
	}
	updated, err := a.Events.RematchHostedBracketMatch(r.Context(), ev.ID, matchID, bst)
	if err != nil {
		if errors.Is(err, store.ErrHostedBracketNotFound) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_match_not_found")
			return
		}
		if errors.Is(err, store.ErrHostedMatchRematch) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_rematch_failed")
			return
		}
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_rematch_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"match": updated})
}

func (a *HostedEventsAPI) Share(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireCanViewEvent(w, r, ev, enums) {
		return
	}
	url, err := a.shareURL(r.Context(), ev.JoinCode)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_share_url_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"join_code": ev.JoinCode,
		"share_url": url,
		"event":     a.publicEventWithHost(r.Context(), ev, enums),
	})
}

func (a *HostedEventsAPI) GetQRPNG(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, cat, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireCanViewEvent(w, r, ev, enums) {
		return
	}
	url, err := a.shareURL(r.Context(), ev.JoinCode)
	if err != nil {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "qr_unavailable")
		if msg == "" {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "qr_unavailable")
			return
		}
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": msg})
		return
	}
	pngBytes, err := encodeJoinQRPNG(url, 512)
	if err != nil {
		msg := eventsOrganizerChromeString(a.Settings, r.Context(), "qr_unavailable")
		if msg == "" {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_qr_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	cd := fmt.Sprintf(`inline; filename="%s%s.png"`, cat.QRFilenamePrefix, ev.JoinCode)
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Disposition", cd)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pngBytes)
}

func (a *HostedEventsAPI) ConsoleCatalogGet(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	// Parity with ListClientNav / requireEnumsCatalog: SQL mig catalog without restart.
	if err := a.Settings.ReloadEventsCatalog(r.Context()); err != nil {
		log.Printf("ConsoleCatalogGet: ReloadEventsCatalog: %v", err)
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	cat := a.Settings.EventsCatalog()
	if cat.Source != "database" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, cat)
}

func (a *HostedEventsAPI) ConsoleCatalogPut(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	// Reload so sizes come from DB; Host sizes DataTable owns CRUD (ads Progression parity:
	// catalog Save must never clobber size fees via a stale draft payload).
	if err := a.Settings.ReloadEventsCatalog(r.Context()); err != nil {
		log.Printf("events catalog put: ReloadEventsCatalog: %v", err)
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	current := a.Settings.EventsCatalog()
	if current.Source != "database" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	var body store.EventsCatalogConfig
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	body.Sizes = append([]store.EventsCatalogSize{}, current.Sizes...)
	if err := a.Settings.SetEventsCatalog(r.Context(), body); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return
	}
	writeJSON(w, http.StatusOK, a.Settings.EventsCatalog())
}

type eventsCatalogSizeBody struct {
	ID                    string   `json:"id"`
	Label                 string   `json:"label"`
	Enabled               *bool    `json:"enabled"`
	SortOrder             int      `json:"sort_order"`
	MaxPlayers            *int     `json:"max_players"` // nil = Unlimited (Arena only)
	HostFeeEthiopiaAmount float64  `json:"host_fee_ethiopia_amount"`
	HostFeeGlobalAmount   float64  `json:"host_fee_global_amount"`
	AllowedFormatIDs      []string `json:"allowed_format_ids"`
}

func (a *HostedEventsAPI) validateCatalogSizeMaxPlayers(w http.ResponseWriter, r *http.Request, maxPlayers *int, allowed []string) bool {
	arenaID := ""
	swiss := map[string]int{}
	if a.Settings != nil {
		arenaID = strings.TrimSpace(a.Settings.ClientEnums().HostedEventArenaFormat)
		swiss = a.Settings.EventsCatalog().SwissRoundsByMaxPlayers
	}
	if store.SeatCapRequiresArenaOnly(maxPlayers, swiss) {
		if arenaID == "" || len(allowed) != 1 || strings.TrimSpace(allowed[0]) != arenaID {
			writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_unlimited_arena_only")
			return false
		}
		return true
	}
	if maxPlayers != nil && *maxPlayers < 2 {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return false
	}
	return true
}

func (a *HostedEventsAPI) reloadCatalogOrErr(w http.ResponseWriter, r *http.Request) bool {
	if a.Settings == nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return false
	}
	if err := a.Settings.ReloadEventsCatalog(r.Context()); err != nil {
		log.Printf("events catalog sizes: ReloadEventsCatalog: %v", err)
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return false
	}
	if a.Settings.EventsCatalog().Source != "database" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return false
	}
	return true
}

func (a *HostedEventsAPI) ConsoleListCatalogSizes(w http.ResponseWriter, r *http.Request) {
	if !a.reloadCatalogOrErr(w, r) {
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	list, total := a.Settings.ListEventsCatalogSizesPaged(params.Skip, params.Limit, q, status)
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"sizes": list, "meta": meta})
}

func (a *HostedEventsAPI) ConsoleCreateCatalogSize(w http.ResponseWriter, r *http.Request) {
	if !a.reloadCatalogOrErr(w, r) {
		return
	}
	var body eventsCatalogSizeBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	id := strings.TrimSpace(body.ID)
	if id == "" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_size_id_required")
		return
	}
	enabled := true
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	cat := a.Settings.EventsCatalog()
	for _, existing := range cat.Sizes {
		if existing.ID == id {
			writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusConflict, "err_size_id_exists")
			return
		}
	}
	sortOrder := body.SortOrder
	if sortOrder == 0 {
		maxSort := 0
		for _, existing := range cat.Sizes {
			if existing.SortOrder > maxSort {
				maxSort = existing.SortOrder
			}
		}
		sortOrder = maxSort + 1
	}
	if body.HostFeeEthiopiaAmount <= 0 || body.HostFeeGlobalAmount <= 0 {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_host_fee_dual_required")
		return
	}
	if len(body.AllowedFormatIDs) == 0 || strings.TrimSpace(body.Label) == "" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return
	}
	if !a.validateCatalogSizeMaxPlayers(w, r, body.MaxPlayers, body.AllowedFormatIDs) {
		return
	}
	sz := store.EventsCatalogSize{
		ID:                    id,
		Label:                 strings.TrimSpace(body.Label),
		Enabled:               enabled,
		SortOrder:             sortOrder,
		MaxPlayers:            body.MaxPlayers,
		HostFeeEthiopiaAmount: body.HostFeeEthiopiaAmount,
		HostFeeGlobalAmount:   body.HostFeeGlobalAmount,
		AllowedFormatIDs:      append([]string{}, body.AllowedFormatIDs...),
	}
	cat.Sizes = append(cat.Sizes, sz)
	if err := a.Settings.SetEventsCatalog(r.Context(), cat); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return
	}
	created, _ := a.Settings.FindEventsCatalogSize(id)
	writeJSON(w, http.StatusCreated, created)
}

func (a *HostedEventsAPI) ConsoleUpdateCatalogSize(w http.ResponseWriter, r *http.Request) {
	if !a.reloadCatalogOrErr(w, r) {
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var body eventsCatalogSizeBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	cat := a.Settings.EventsCatalog()
	idx := -1
	for i := range cat.Sizes {
		if cat.Sizes[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_size_not_found")
		return
	}
	label := strings.TrimSpace(body.Label)
	if label == "" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return
	}
	formats := body.AllowedFormatIDs
	if len(formats) == 0 {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return
	}
	if !a.validateCatalogSizeMaxPlayers(w, r, body.MaxPlayers, formats) {
		return
	}
	if body.HostFeeEthiopiaAmount <= 0 || body.HostFeeGlobalAmount <= 0 {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_host_fee_dual_required")
		return
	}
	sortOrder := body.SortOrder
	if sortOrder == 0 {
		sortOrder = cat.Sizes[idx].SortOrder
	}
	enabled := cat.Sizes[idx].Enabled
	if body.Enabled != nil {
		enabled = *body.Enabled
	}
	cat.Sizes[idx] = store.EventsCatalogSize{
		ID:                    id,
		Label:                 label,
		Enabled:               enabled,
		SortOrder:             sortOrder,
		MaxPlayers:            body.MaxPlayers,
		HostFeeEthiopiaAmount: body.HostFeeEthiopiaAmount,
		HostFeeGlobalAmount:   body.HostFeeGlobalAmount,
		AllowedFormatIDs:      append([]string{}, formats...),
	}
	if err := a.Settings.SetEventsCatalog(r.Context(), cat); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return
	}
	updated, _ := a.Settings.FindEventsCatalogSize(id)
	writeJSON(w, http.StatusOK, updated)
}

func (a *HostedEventsAPI) ConsoleSetCatalogSizeActive(w http.ResponseWriter, r *http.Request) {
	if !a.reloadCatalogOrErr(w, r) {
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var body struct {
		Active bool `json:"active"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	cat := a.Settings.EventsCatalog()
	idx := -1
	for i := range cat.Sizes {
		if cat.Sizes[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_size_not_found")
		return
	}
	cat.Sizes[idx].Enabled = body.Active
	if err := a.Settings.SetEventsCatalog(r.Context(), cat); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return
	}
	updated, _ := a.Settings.FindEventsCatalogSize(id)
	writeJSON(w, http.StatusOK, updated)
}

func (a *HostedEventsAPI) ConsoleDeleteCatalogSize(w http.ResponseWriter, r *http.Request) {
	if !a.reloadCatalogOrErr(w, r) {
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	cat := a.Settings.EventsCatalog()
	next := make([]store.EventsCatalogSize, 0, len(cat.Sizes))
	found := false
	for _, sz := range cat.Sizes {
		if sz.ID == id {
			found = true
			continue
		}
		next = append(next, sz)
	}
	if !found {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_size_not_found")
		return
	}
	cat.Sizes = next
	if err := a.Settings.SetEventsCatalog(r.Context(), cat); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_catalog_invalid")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *API) isHostedEventBracketGame(ctx context.Context, gameID string) bool {
	if a == nil || a.HostedEvents == nil || strings.TrimSpace(gameID) == "" {
		return false
	}
	m, err := a.HostedEvents.GetBracketMatchByGameID(ctx, gameID)
	return err == nil && m != nil
}

func (a *API) isPrivateHostedEventGame(ctx context.Context, gameID string) bool {
	if a == nil || a.HostedEvents == nil || a.Settings == nil || strings.TrimSpace(gameID) == "" {
		return false
	}
	ev, err := a.HostedEvents.GetByBracketGameID(ctx, gameID)
	if err != nil || ev == nil {
		return false
	}
	enums := a.Settings.ClientEnums()
	publicVis := strings.TrimSpace(enums.HostedEventPublicVisibility)
	if publicVis == "" || enums.Source != "database" {
		return true
	}
	return !strings.EqualFold(strings.TrimSpace(ev.Visibility), publicVis)
}

// CanSpectateHostedEventGame: public cups anyone; private cups organizer or approved entry only.
func (a *API) CanSpectateHostedEventGame(ctx context.Context, userID, gameID string) bool {
	return a.canSpectateHostedEventGame(ctx, userID, gameID)
}

func (a *API) canSpectateHostedEventGame(ctx context.Context, userID, gameID string) bool {
	if a == nil || a.HostedEvents == nil || strings.TrimSpace(gameID) == "" {
		return true
	}
	ev, err := a.HostedEvents.GetByBracketGameID(ctx, gameID)
	if err != nil || ev == nil {
		return true
	}
	if a.Settings == nil {
		return false
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		return false
	}
	publicVis := strings.TrimSpace(enums.HostedEventPublicVisibility)
	if publicVis != "" && strings.EqualFold(strings.TrimSpace(ev.Visibility), publicVis) {
		return true
	}
	if strings.TrimSpace(userID) == "" {
		return false
	}
	if userID == ev.OrganizerID {
		return true
	}
	en, err := a.HostedEvents.GetEntry(ctx, ev.ID, userID)
	return err == nil && en != nil && en.Status == enums.HostedEventEntryApproved
}

func (a *API) canAccessGameAsViewer(ctx context.Context, userID, gameID string, state *engine.State) bool {
	if state != nil {
		if state.Player1ID != nil && strings.TrimSpace(*state.Player1ID) != "" && *state.Player1ID == userID {
			return true
		}
		if state.Player2ID != nil && strings.TrimSpace(*state.Player2ID) != "" && *state.Player2ID == userID {
			return true
		}
	}
	return a.canSpectateHostedEventGame(ctx, userID, gameID)
}

// shouldApplyCareerForGame awards XP/W-L/rating for rated PvP. Hosted event brackets:
// private never; public only when Flags.PublicEventMatchesRated is on (and game.Rated).
func (a *API) shouldApplyCareerForGame(ctx context.Context, gameID string, rated bool) bool {
	if !rated {
		return false
	}
	if a == nil || a.HostedEvents == nil || strings.TrimSpace(gameID) == "" {
		return true
	}
	ev, err := a.HostedEvents.GetByBracketGameID(ctx, gameID)
	if err != nil || ev == nil {
		return true
	}
	if a.Settings == nil {
		return false
	}
	enums := a.Settings.ClientEnums()
	publicVis := strings.TrimSpace(enums.HostedEventPublicVisibility)
	if publicVis == "" || enums.Source != "database" ||
		!strings.EqualFold(strings.TrimSpace(ev.Visibility), publicVis) {
		return false
	}
	return a.Flags != nil && a.Flags.Get(ctx).PublicEventMatchesRated
}

func (a *HostedEventsAPI) Report(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	enums, cat, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	ev, err := a.Events.Get(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	var body reportEventBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	reason := strings.TrimSpace(body.ReasonCode)
	allowed := false
	for _, c := range cat.ReportReasonCodes {
		if c == reason {
			allowed = true
			break
		}
	}
	if !allowed {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_reason_code")
		return
	}
	openStatus := strings.TrimSpace(enums.HostedEventReportOpenStatus)
	if openStatus == "" {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	rep, err := a.Events.CreateReport(r.Context(), ev.ID, userID, reason, strings.TrimSpace(body.Note), openStatus)
	if err != nil {
		if errors.Is(err, store.ErrHostedReportConflict) {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_report_already_open")
			return
		}
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_report_submit_failed")
		return
	}
	if a.emitPool() {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, userID, notifications.KindPlayerEventReportReceived,
			"event_report_received:"+rep.ID, ev.ID, ev.Title)
		reporterName := userID
		if a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), userID); err == nil && u != nil {
				reporterName = u.Username
			}
		}
		roles := enums.ConsoleRoles
		notifications.EmitAdmins(r.Context(), a.DB.Pool, roles, notifications.KindAdminEventReportPending,
			"admin_event_report:"+rep.ID, rep.ID, reporterName, ev.Title, reason)
	}
	writeJSON(w, http.StatusCreated, rep)
}

func (a *HostedEventsAPI) ConsoleListEvents(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	enums, _, enumsOK := a.requireEnumsCatalog(w, r)
	if !enumsOK {
		return
	}
	list, total, err := a.Events.ListConsole(r.Context(), params.Skip, params.Limit, parseHostedEventListFilter(r))
	if err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_list_failed")
		return
	}
	orgIDs := make([]string, 0, len(list))
	for i := range list {
		orgIDs = append(orgIDs, list[i].OrganizerID)
	}
	orgCards := a.loadOrganizerCardsWithReputation(
		r.Context(), orgIDs,
		enums.HostedEventFinishedStatus, enums.HostedEventCancelledStatus, enums.HostedEventReportOpenStatus,
	)
	out := make([]map[string]any, 0, len(list))
	for i := range list {
		row := a.publicEvent(r.Context(), &list[i].HostedEvent, enums)
		if row == nil {
			continue
		}
		a.attachOrganizerCard(r.Context(), row, list[i].OrganizerID, orgCards)
		if u := strings.TrimSpace(list[i].OrganizerUsername); u != "" {
			row["organizer_username"] = u
		}
		out = append(out, row)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"events": out, "meta": meta})
}

// ConsoleGetEvent returns one cup for admin notification deep-links (?id= off current page).
func (a *HostedEventsAPI) ConsoleGetEvent(w http.ResponseWriter, r *http.Request) {
	enums, _, enumsOK := a.requireEnumsCatalog(w, r)
	if !enumsOK {
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_event_not_found")
		return
	}
	row, err := a.Events.GetConsole(r.Context(), id)
	if err != nil || row == nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	out := a.publicEvent(r.Context(), &row.HostedEvent, enums)
	if out == nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	orgCards := a.loadOrganizerCardsWithReputation(
		r.Context(), []string{row.OrganizerID},
		enums.HostedEventFinishedStatus, enums.HostedEventCancelledStatus, enums.HostedEventReportOpenStatus,
	)
	a.attachOrganizerCard(r.Context(), out, row.OrganizerID, orgCards)
	if u := strings.TrimSpace(row.OrganizerUsername); u != "" {
		out["organizer_username"] = u
	}
	writeJSON(w, http.StatusOK, out)
}

// ConsoleListEventEntries returns a paged hosted-event roster for admin (all statuses).
func (a *HostedEventsAPI) ConsoleListEventEntries(w http.ResponseWriter, r *http.Request) {
	enums, _, enumsOK := a.requireEnumsCatalog(w, r)
	if !enumsOK {
		return
	}
	params, labels, skipCap, pageOK := parseListPagination(w, r, a.Settings)
	if !pageOK {
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_event_not_found")
		return
	}
	if _, err := a.Events.Get(r.Context(), id); err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	entries, total, err := a.Events.ListEntriesPage(r.Context(), id, params.Skip, params.Limit, "")
	if err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_entries_failed")
		return
	}
	for i := range entries {
		entries[i].StatusLabel = store.StatusLabel(enums.HostedEventEntryStatusLabels, entries[i].Status)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries, "meta": meta})
}

func (a *HostedEventsAPI) ConsoleListReports(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	list, total, err := a.Events.ListReports(r.Context(), status, params.Skip, params.Limit)
	if err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_reports_failed")
		return
	}
	if a.Settings != nil {
		cat := a.Settings.EventsCatalog()
		if cat.Source == "database" {
			for i := range list {
				list[i].ReasonLabel = store.StatusLabel(cat.ReportReasonLabels, list[i].ReasonCode)
			}
		}
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"reports": list, "meta": meta})
}

func (a *HostedEventsAPI) ConsoleDismissReport(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	dismissed := strings.TrimSpace(enums.HostedEventReportDismissedStatus)
	if dismissed == "" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	rep, err := a.Events.SetReportStatus(r.Context(), chi.URLParam(r, "id"), dismissed, userID)
	if err != nil {
		if errors.Is(err, store.ErrHostedReportNotFound) {
			writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_report_not_found")
			return
		}
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_dismiss_failed")
		return
	}
	writeJSON(w, http.StatusOK, rep)
}

func (a *HostedEventsAPI) ConsoleDeactivateReport(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	rep, err := a.Events.GetReport(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_report_not_found")
		return
	}
	ev, err := a.Events.Get(r.Context(), rep.EventID)
	if err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	notifyIDs, _ := a.Events.ListApprovedUserIDs(r.Context(), ev.ID, enums.HostedEventEntryApproved, false)
	if ev.Status != enums.HostedEventCancelledStatus {
		if err := a.refundAndVacateEntries(r.Context(), ev, enums.HostedEventEntryApproved, enums.HostedEventEntryKicked); err != nil {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
			return
		}
		// Fail closed: never silently return a live/captured guarantee to the organizer.
		if ev.PrizePoolGuaranteeHeld && (ev.StartedAt != nil || ev.FinishedAt != nil || ev.PrizePoolGuaranteeCaptured) {
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_guarantee_live_cannot_release")
			return
		}
		if err := a.releasePrizeGuaranteeIfHeld(r.Context(), ev); err != nil {
			if strings.Contains(err.Error(), "live cannot release") || strings.Contains(err.Error(), "already captured") {
				writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_guarantee_live_cannot_release")
				return
			}
			writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
			return
		}
		ev, err = a.Events.Cancel(r.Context(), ev.ID, enums.HostedEventCancelledStatus)
		if err != nil {
			writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_deactivate_failed")
			return
		}
	}
	deactivated := strings.TrimSpace(enums.HostedEventReportDeactivatedStatus)
	if deactivated == "" {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_catalog_unavailable")
		return
	}
	rep, err = a.Events.SetReportStatus(r.Context(), rep.ID, deactivated, userID)
	if err != nil {
		writeEventsAdminErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_report_update_failed")
		return
	}
	if a.emitPool() {
		notifyIDs = append(notifyIDs, ev.OrganizerID)
		a.notifyEventPlayers(r.Context(), notifyIDs, notifications.KindPlayerEventCancelled,
			"event_deactivated:"+ev.ID, ev.JoinCode, ev.Title)
		a.notifyEventAdmins(r.Context(), notifications.KindAdminEventClosed,
			"admin_event_deactivated:"+ev.ID, ev.ID, ev.Title)
	}
	writeJSON(w, http.StatusOK, map[string]any{"report": rep, "event": a.publicEventWithHost(r.Context(), ev, enums)})
}

func tournamentEntrantIDs(ctx context.Context, handle *db.Handle, tournamentID string) ([]string, error) {
	if handle == nil || !handle.Ready() {
		return nil, fmt.Errorf("database unavailable")
	}
	rows, err := handle.Pool.Query(ctx, `
		SELECT user_id::text FROM tournament_entries WHERE tournament_id = $1 ORDER BY created_at ASC`, tournamentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// AdvanceBracketFromGame is called from match-finish paths (ApplyMoveCore / AbandonGameCore).
func (a *API) AdvanceBracketFromGame(ctx context.Context, gameID, winnerID string, isDraw bool) {
	if a == nil || a.Settings == nil {
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		return
	}
	ppw, ppwErr := store.StandingsPointsPerWin(enums)
	if ppwErr != nil {
		return
	}
	ppd, ppdErr := store.StandingsPointsPerDraw(enums)
	if ppdErr != nil {
		return
	}
	if a.Tournaments != nil {
		if tm, err := a.Tournaments.GetBracketMatchByGameID(ctx, gameID); err == nil && tm != nil {
			finishedBefore := false
			if tour, err := a.Tournaments.Get(ctx, tm.TournamentID); err == nil && tour != nil && tour.FinishedAt != nil {
				finishedBefore = true
			}
			cat := a.Settings.EventsCatalog()
			arenaScore, arenaScoreErr := store.ParseArenaScoreConfig(enums)
			if arenaScoreErr != nil {
				return
			}
			awards, _ := a.Tournaments.AdvanceOnGameFinish(ctx, gameID, winnerID, isDraw, store.HostedBracketStatuses{
				Pending: enums.TournamentBracketPending,
				Ready:   enums.TournamentBracketReady,
				Live:    enums.TournamentBracketLive,
				Done:    enums.TournamentBracketDone,
				Bye:     enums.TournamentBracketBye,
			}, store.HostedFormatIDs{
				Knockout:       enums.HostedEventKnockoutFormat,
				RoundRobin:     enums.HostedEventRoundRobinFormat,
				Swiss:          enums.HostedEventSwissFormat,
				GroupsKnockout: enums.HostedEventGroupsKnockoutFormat,
				Arena:          enums.HostedEventArenaFormat,
			}, store.HostedFormatPhases{
				Knockout:   enums.HostedEventPhaseKnockout,
				RoundRobin: enums.HostedEventPhaseRoundRobin,
				Swiss:      enums.HostedEventPhaseSwiss,
				Group:      enums.HostedEventPhaseGroup,
				Arena:      enums.HostedEventPhaseArena,
			}, cat.SwissRoundsByMaxPlayers, cat.GroupsKnockoutAdvancePerGroup, arenaScore, ppw, ppd)
			if len(awards) > 0 {
				title := ""
				preferArena := false
				if tour, err := a.Tournaments.Get(ctx, tm.TournamentID); err == nil && tour != nil {
					title = tour.Title
					preferArena = strings.TrimSpace(tour.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
				}
				emitCompetitionPointsAwarded(ctx, a.DB, gameID, title, tm.TournamentID, awards, preferArena)
			}
			if !finishedBefore && a.DB != nil && a.DB.Ready() {
				if tour, err := a.Tournaments.Get(ctx, tm.TournamentID); err == nil && tour != nil && tour.FinishedAt != nil {
					a.escrowTournamentFinish(ctx, tour, enums)
					ids, _ := tournamentEntrantIDs(ctx, a.DB, tour.ID)
					for _, uid := range ids {
						notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerTournamentFinished,
							"tournament_finished:"+tour.ID+":"+uid, tour.ID, tour.Title)
					}
				}
			}
			return
		}
	}
	if a.HostedEvents == nil {
		return
	}
	finishedBefore := false
	if m, err := a.HostedEvents.GetBracketMatchByGameID(ctx, gameID); err == nil && m != nil {
		if ev, err := a.HostedEvents.Get(ctx, m.EventID); err == nil && ev != nil {
			finishedBefore = ev.Status == enums.HostedEventFinishedStatus
		}
	}
	cat := a.Settings.EventsCatalog()
	arenaScore, arenaScoreErr := store.ParseArenaScoreConfig(enums)
	if arenaScoreErr != nil {
		return
	}
	awards, _ := a.HostedEvents.AdvanceOnGameFinish(ctx, gameID, winnerID, isDraw, store.HostedBracketStatuses{
		Pending: enums.HostedEventBracketPending,
		Ready:   enums.HostedEventBracketReady,
		Live:    enums.HostedEventBracketLive,
		Done:    enums.HostedEventBracketDone,
		Bye:     enums.HostedEventBracketBye,
	}, store.HostedEventStatuses{
		Open:      enums.HostedEventDefaultStatus,
		Full:      enums.HostedEventFullStatus,
		Live:      enums.HostedEventLiveStatus,
		Finished:  enums.HostedEventFinishedStatus,
		Cancelled: enums.HostedEventCancelledStatus,
	}, enums.HostedEventEntryApproved, store.HostedFormatIDs{
		Knockout:       enums.HostedEventKnockoutFormat,
		RoundRobin:     enums.HostedEventRoundRobinFormat,
		Swiss:          enums.HostedEventSwissFormat,
		GroupsKnockout: enums.HostedEventGroupsKnockoutFormat,
		Arena:          enums.HostedEventArenaFormat,
	}, store.HostedFormatPhases{
		Knockout:   enums.HostedEventPhaseKnockout,
		RoundRobin: enums.HostedEventPhaseRoundRobin,
		Swiss:      enums.HostedEventPhaseSwiss,
		Group:      enums.HostedEventPhaseGroup,
		Arena:      enums.HostedEventPhaseArena,
	}, cat.SwissRoundsByMaxPlayers, cat.GroupsKnockoutAdvancePerGroup, arenaScore, ppw, ppd)
	if len(awards) > 0 {
		if bm, err := a.HostedEvents.GetBracketMatchByGameID(ctx, gameID); err == nil && bm != nil {
			title := ""
			preferArena := false
			if ev, err := a.HostedEvents.Get(ctx, bm.EventID); err == nil && ev != nil {
				title = ev.Title
				preferArena = strings.TrimSpace(ev.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
			}
			emitCompetitionPointsAwarded(ctx, a.DB, gameID, title, bm.EventID, awards, preferArena)
		}
	}
	if finishedBefore || a.DB == nil || !a.DB.Ready() {
		return
	}
	m, err := a.HostedEvents.GetBracketMatchByGameID(ctx, gameID)
	if err != nil || m == nil {
		return
	}
	ev, err := a.HostedEvents.Get(ctx, m.EventID)
	if err != nil || ev == nil || ev.Status != enums.HostedEventFinishedStatus {
		return
	}
	a.escrowEventFinish(ctx, ev, enums)
	ids, _ := a.HostedEvents.ListApprovedUserIDs(ctx, ev.ID, enums.HostedEventEntryApproved, false)
	seen := map[string]struct{}{}
	for _, uid := range ids {
		uid = strings.TrimSpace(uid)
		if uid == "" || uid == ev.OrganizerID {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerEventFinished,
			"event_finished:"+ev.ID+":"+uid, ev.ID, ev.Title)
	}
	// Dedicated auto-close notice for the organizer (bracket completed the cup).
	notifications.EmitPlayer(ctx, a.DB.Pool, ev.OrganizerID, notifications.KindPlayerEventAutoClosed,
		"event_auto_closed:"+ev.ID, ev.ID, ev.Title)
	if a.Settings != nil {
		enums2 := a.Settings.ClientEnums()
		if enums2.Source == "database" && len(enums2.ConsoleRoles) > 0 {
			notifications.EmitAdmins(ctx, a.DB.Pool, enums2.ConsoleRoles, notifications.KindAdminEventAutoClosed,
				"admin_event_auto_closed:"+ev.ID, ev.ID, ev.Title)
		}
	}
}
