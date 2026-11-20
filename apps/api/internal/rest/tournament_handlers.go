package rest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
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

type TournamentAPI struct {
	Tournaments       *store.TournamentStore
	Entries           *store.EntryStore
	Payments          *payments.Service
	Settings          *store.SettingsStore
	Flags             *store.FlagStore
	Avatars           *media.AvatarService
	Cash              *store.CashRmgStore
	Users             *store.UserStore
	Locate            *geo.Resolver
	Games             *gamestore.Store
	OfficialPause     *store.OfficialPauseStore
	Hub               *ws.Hub
	DB                *db.Handle
	CompetitionPrizes *store.CompetitionPrizeStore
}

func parseTournamentEntryFilter(r *http.Request) *bool {
	raw := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("is_free")))
	switch raw {
	case "1", "true", "yes":
		v := true
		return &v
	case "0", "false", "no":
		v := false
		return &v
	default:
		return nil
	}
}

func (a *TournamentAPI) List(w http.ResponseWriter, r *http.Request) {
	// Public player surface: lifecycle + enrollable status from platform_settings.client_enums.
	enrollable := ""
	var allStatuses []string
	if a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			enrollable = strings.TrimSpace(enums.EnrollableTournamentStatus)
			allStatuses = append([]string{}, enums.TournamentStatuses...)
		}
	}
	if enrollable == "" {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_enrollable_status_unavailable")
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	lifecycle := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("lifecycle")))
	if lifecycle == "" {
		lifecycle = "open"
	}
	switch lifecycle {
	case "open", "live", "finished", "all":
	default:
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_load_failed")
		return
	}
	mine := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("mine")), "1") ||
		strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("mine")), "true")
	mineUID := ""
	if mine {
		mineUID = strings.TrimSpace(auth.UserIDFromContext(r.Context()))
		if mineUID == "" {
			writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_load_failed")
			return
		}
	}
	// Open browse: enrollable status only. Live/finished/mine/all: any non-draft status from enums.
	statuses := []string{enrollable}
	if lifecycle != "open" || mine {
		statuses = make([]string, 0, len(allStatuses))
		for _, st := range allStatuses {
			st = strings.TrimSpace(st)
			if st == "" || strings.EqualFold(st, "draft") {
				continue
			}
			statuses = append(statuses, st)
		}
		if len(statuses) == 0 {
			statuses = []string{enrollable}
		}
	}
	filter := store.TournamentListFilter{
		Statuses:   statuses,
		IsFree:     parseTournamentEntryFilter(r),
		Q:          strings.TrimSpace(r.URL.Query().Get("q")),
		Lifecycle:  lifecycle,
		MineUserID: mineUID,
	}
	list, total, err := a.Tournaments.ListPaged(r.Context(), params.Skip, params.Limit, filter)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_load_failed")
		return
	}
	enrolled := a.viewerEnrolledMap(r, list)
	if mine {
		for i := range list {
			enrolled[list[i].ID] = true
		}
	}
	viewerStats := map[string]store.ViewerEntryStats{}
	viewerPrizes := map[string]store.ViewerPrizeAmount{}
	uid := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if uid != "" {
		ids := make([]string, 0, len(list))
		for i := range list {
			if enrolled[list[i].ID] {
				ids = append(ids, list[i].ID)
			}
		}
		if a.Entries != nil {
			if stats, err := a.Entries.ViewerStatsAmong(r.Context(), uid, ids); err == nil && stats != nil {
				viewerStats = stats
			}
		}
		if a.CompetitionPrizes != nil {
			if prizes, err := a.CompetitionPrizes.ViewerPrizesAmong(r.Context(), uid, ids); err == nil && prizes != nil {
				viewerPrizes = prizes
			}
		}
	}
	liveGameByID := map[string]string{}
	if a.Settings != nil && len(list) > 0 {
		enums := a.Settings.ClientEnums()
		liveSt := strings.TrimSpace(enums.TournamentBracketLive)
		if enums.Source == "database" && liveSt != "" {
			ids := make([]string, 0, len(list))
			for i := range list {
				ids = append(ids, list[i].ID)
			}
			if m, err := a.Tournaments.MapLiveGameIDsByTournamentIDs(r.Context(), ids, liveSt); err == nil && m != nil {
				liveGameByID = m
			}
		}
	}
	out := make([]map[string]any, 0, len(list))
	for i := range list {
		m := a.publicTournament(r.Context(), &list[i], enrolled[list[i].ID])
		if gid := strings.TrimSpace(liveGameByID[list[i].ID]); gid != "" {
			m["live_game_id"] = gid
		}
		if st, ok := viewerStats[list[i].ID]; ok {
			if st.Placement != nil {
				m["viewer_placement"] = *st.Placement
			}
			m["viewer_arena_points"] = st.ArenaPoints
			m["viewer_arena_streak"] = st.ArenaStreak
		}
		if pr, ok := viewerPrizes[list[i].ID]; ok {
			m["viewer_prize_amount"] = pr.Amount
			if pr.Currency != "" {
				m["viewer_prize_currency"] = pr.Currency
			}
		}
		out = append(out, m)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"tournaments": out, "meta": meta})
}

// ConsoleList returns all tournament statuses with Trim skip/limit meta (admin OpsDataTable).
func (a *TournamentAPI) ConsoleList(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	filter := store.TournamentListFilter{
		IsFree: parseTournamentEntryFilter(r),
		Q:      strings.TrimSpace(r.URL.Query().Get("q")),
	}
	list, total, err := a.Tournaments.ListPaged(r.Context(), params.Skip, params.Limit, filter)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_load_failed")
		return
	}
	out := make([]map[string]any, 0, len(list))
	for i := range list {
		out = append(out, a.publicTournament(r.Context(), &list[i], false))
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"tournaments": out, "meta": meta})
}

// viewerEnrolledMap: when Bearer JWT is present, mark cups the viewer already entered.
func (a *TournamentAPI) viewerEnrolledMap(r *http.Request, list []store.Tournament) map[string]bool {
	out := map[string]bool{}
	if r == nil || a.Entries == nil || len(list) == 0 {
		return out
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		return out
	}
	ids := make([]string, 0, len(list))
	for i := range list {
		ids = append(ids, list[i].ID)
	}
	enrolled, err := a.Entries.EnrolledAmong(r.Context(), userID, ids)
	if err != nil || enrolled == nil {
		return out
	}
	return enrolled
}

func (a *TournamentAPI) publicTournament(ctx context.Context, t *store.Tournament, viewerEnrolled bool) map[string]any {
	gallery := t.Gallery
	if gallery == nil {
		gallery = []string{}
	}
	playersCount := 0
	countOK := a.Entries != nil
	if a.Entries != nil {
		n, err := a.Entries.CountByTournament(ctx, t.ID)
		if err != nil {
			countOK = false
		} else {
			playersCount = n
		}
	}
	formatID := strings.TrimSpace(t.FormatID)
	if formatID == "" && a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			formatID = strings.TrimSpace(enums.TournamentDefaultFormat)
		}
	}
	out := map[string]any{
		"id":                 t.ID,
		"title":              t.Title,
		"description":        t.Description,
		"is_free":            t.IsFree,
		"entry_fee_amount":   t.EntryFeeAmount,
		"entry_fee_currency": t.EntryFeeCurrency,
		"prize_pool":         t.PrizePool,
		"prize_image_url":    t.PrizeImageURL,
		"gallery":            gallery,
		"players_count":      playersCount,
		"status":             t.Status,
		"created_at":         t.CreatedAt,
	}
	if formatID != "" {
		out["format_id"] = formatID
		if a.Settings != nil {
			if f, ok := a.Settings.FindEventsCatalogFormat(formatID); ok {
				if label := strings.TrimSpace(f.Label); label != "" {
					out["format_label"] = label
				}
			}
		}
	}
	// Fill n/max like hosted events even when prize display is off.
	// Emit present max even when < 2 (invalid orphan) so clients never treat omit as Unlimited.
	if t.MaxPlayers != nil {
		out["max_players"] = *t.MaxPlayers
	}
	if a.Settings != nil {
		swiss := a.Settings.EventsCatalog().SwissRoundsByMaxPlayers
		if store.SeatCapRequiresArenaOnly(t.MaxPlayers, swiss) {
			out["seat_cap_unlimited"] = true
		}
	}
	if t.CheckInOpensAt != nil {
		out["check_in_opens_at"] = t.CheckInOpensAt
	}
	if t.CheckInClosesAt != nil {
		out["check_in_closes_at"] = t.CheckInClosesAt
	}
	if t.StartedAt != nil {
		out["started_at"] = t.StartedAt
	}
	if t.FinishedAt != nil {
		out["finished_at"] = t.FinishedAt
	}
	if t.WinnerID != nil && strings.TrimSpace(*t.WinnerID) != "" {
		out["winner_id"] = strings.TrimSpace(*t.WinnerID)
	}
	if t.PrizeSettledAt != nil {
		out["prize_settled_at"] = t.PrizeSettledAt
	}
	if t.DisputeWindowEndsAt != nil {
		out["dispute_window_ends_at"] = t.DisputeWindowEndsAt
	}
	if t.ArenaEndsAt != nil {
		out["arena_ends_at"] = t.ArenaEndsAt
	}
	if t.ArenaDurationMinutes != nil {
		out["arena_duration_minutes"] = *t.ArenaDurationMinutes
	}
	if viewerEnrolled {
		out["viewer_enrolled"] = true
	}
	if a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			if label := store.StatusLabel(enums.TournamentStatusLabels, t.Status); label != "" {
				out["status_label"] = label
			}
		}
	}
	// Omit pot when enroll count is unknown (never invent a zero-player pot).
	if countOK {
		a.attachTournamentPrizePool(ctx, out, t, playersCount)
	}
	if strings.TrimSpace(t.PrizePayoutMode) != "" || len(t.PrizePlacePercents) > 0 {
		attachPrizePayoutFields(out, t.PrizePayoutMode, t.PrizePlacePercents)
	}
	// Detail/single payloads: stamp live board when cup is in progress.
	if a.Settings != nil && t.StartedAt != nil && t.FinishedAt == nil {
		enums := a.Settings.ClientEnums()
		liveSt := strings.TrimSpace(enums.TournamentBracketLive)
		if enums.Source == "database" && liveSt != "" {
			if m, err := a.Tournaments.MapLiveGameIDsByTournamentIDs(ctx, []string{t.ID}, liveSt); err == nil {
				if gid := strings.TrimSpace(m[t.ID]); gid != "" {
					out["live_game_id"] = gid
				}
			}
		}
	}
	return out
}

// attachTournamentPrizePool: paid + display on + platform flag → now = enrolls x fee (+ declared guarantee);
// if_full when max_players set. Host create fee N/A. Free never shows.
func (a *TournamentAPI) attachTournamentPrizePool(ctx context.Context, out map[string]any, t *store.Tournament, playersCount int) {
	if out == nil || t == nil || t.IsFree || !t.PrizePoolDisplayEnabled || t.EntryFeeAmount <= 0 {
		return
	}
	if a.Flags == nil || !a.Flags.Get(ctx).PrizePoolDisplayEnabled {
		return
	}
	currency := strings.TrimSpace(t.EntryFeeCurrency)
	if currency == "" {
		return
	}
	guarantee := 0.0
	if t.PrizePool != nil {
		switch v := t.PrizePool["total"].(type) {
		case float64:
			guarantee = payments.RoundMoney2(v)
		case int:
			guarantee = payments.RoundMoney2(float64(v))
		}
	}
	out["prize_pool_display_enabled"] = true
	out["prize_pool_currency"] = currency
	if guarantee > 0 {
		out["prize_pool_guarantee_amount"] = guarantee
	}
	entryPot := payments.RoundMoney2(float64(playersCount) * t.EntryFeeAmount)
	if t.PrizePoolFrozenAmount != nil {
		out["prize_pool_frozen"] = true
		out["prize_pool_now"] = payments.RoundMoney2(*t.PrizePoolFrozenAmount)
		if t.PrizePoolFrozenAt != nil {
			out["prize_pool_frozen_at"] = *t.PrizePoolFrozenAt
		}
	} else {
		out["prize_pool_frozen"] = false
		out["prize_pool_now"] = payments.RoundMoney2(entryPot + guarantee)
	}
	var swiss map[string]int
	if a.Settings != nil {
		swiss = a.Settings.EventsCatalog().SwissRoundsByMaxPlayers
	}
	if store.HasPlayerCap(t.MaxPlayers) && !store.SeatCapRequiresArenaOnly(t.MaxPlayers, swiss) {
		out["max_players"] = *t.MaxPlayers
		out["prize_pool_if_full"] = payments.RoundMoney2(float64(*t.MaxPlayers)*t.EntryFeeAmount + guarantee)
	}
}

type tournamentStatusBody struct {
	Status string `json:"status"`
}

// SetStatus is console soft-lifecycle control from platform_settings.client_enums.
type tournamentUpdateBody struct {
	Title                   string   `json:"title"`
	Description             *string  `json:"description"`
	IsFree                  bool     `json:"is_free"`
	EntryFeeAmount          float64  `json:"entry_fee_amount"`
	EntryFeeCurrency        string   `json:"entry_fee_currency"`
	PrizePoolAmount         *float64 `json:"prize_pool_amount"`
	PrizePoolCurrency       *string  `json:"prize_pool_currency"`
	PrizePoolDisplayEnabled *bool    `json:"prize_pool_display_enabled"`
	// Optional place→amount map (keys "1","2","3"...). Sum must not exceed prize_pool_amount.
	PrizePoolPlaces      map[string]float64 `json:"prize_pool_places"`
	PrizePayoutMode      string             `json:"prize_payout_mode"`
	PrizePlacePercents   map[string]float64 `json:"prize_place_percents"`
	MaxPlayers           *int               `json:"max_players"`
	FormatID             string             `json:"format_id"`
	ArenaDurationMinutes *int               `json:"arena_duration_minutes"`
}

// Update applies console edit fields (title, fees, prize pool display).
func (a *TournamentAPI) Update(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_tournament_not_found")
		return
	}
	var body tournamentUpdateBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
		return
	}
	desc := ""
	if body.Description != nil {
		desc = strings.TrimSpace(*body.Description)
	}
	currency := strings.TrimSpace(body.EntryFeeCurrency)
	if currency == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
		return
	}
	prizePool := map[string]any{}
	if body.PrizePoolAmount != nil && *body.PrizePoolAmount > 0 {
		if body.IsFree {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
			return
		}
		prizeCur := ""
		if body.PrizePoolCurrency != nil {
			prizeCur = strings.TrimSpace(*body.PrizePoolCurrency)
		}
		if prizeCur == "" {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
			return
		}
		total := payments.RoundMoney2(*body.PrizePoolAmount)
		prizePool["total"] = total
		prizePool["currency"] = prizeCur
		if err := mergePrizePoolPlaces(prizePool, body.PrizePoolPlaces, total); err != nil {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_prize_places_sum")
			return
		}
	}
	prizeDisplay := false
	if body.PrizePoolDisplayEnabled != nil {
		prizeDisplay = *body.PrizePoolDisplayEnabled
	}
	platformDisplay := a.Flags != nil && a.Flags.Get(r.Context()).PrizePoolDisplayEnabled
	if body.IsFree || !platformDisplay {
		prizeDisplay = false
	}
	// Omit/null → Unlimited (Arena only). Present but < 2 must reject
	// (never coerce invalid lows into open enroll).
	maxPlayers := body.MaxPlayers
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_update_failed")
		return
	}
	formatID, err := a.Settings.ResolveTournamentFormatID(body.FormatID)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
		return
	}
	if errKey := store.ValidateOfficialMaxPlayers(
		formatID,
		a.Settings.ClientEnums().HostedEventArenaFormat,
		maxPlayers,
		a.Settings.EventsCatalog().SwissRoundsByMaxPlayers,
	); errKey != "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, errKey)
		return
	}
	cur, err := a.Tournaments.Get(r.Context(), id)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if cur.StartedAt != nil && strings.TrimSpace(cur.FormatID) != formatID {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_cup_already_started")
		return
	}
	var arenaDuration *int
	if body.ArenaDurationMinutes != nil && *body.ArenaDurationMinutes > 0 {
		arenaDuration = body.ArenaDurationMinutes
	}
	enums := a.Settings.ClientEnums()
	// Engage when client sends mode/percents, or paid+display with no mode yet (apply DB default).
	hasPayoutBody := strings.TrimSpace(body.PrizePayoutMode) != "" || len(body.PrizePlacePercents) > 0
	// Payout mode/% locked after start or freeze (parity with hosted events).
	if hasPayoutBody && cur != nil && (cur.StartedAt != nil || cur.PrizePoolFrozenAmount != nil) {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_cup_already_started")
		return
	}
	needsDefault := prizeDisplay && !body.IsFree && body.EntryFeeAmount > 0 &&
		cur != nil && strings.TrimSpace(cur.PrizePayoutMode) == ""
	if needsDefault && cur != nil && (cur.StartedAt != nil || cur.PrizePoolFrozenAmount != nil) {
		needsDefault = false
	}
	payoutEngage := hasPayoutBody || needsDefault
	var preserve *competitionPayoutResolved
	if cur != nil {
		preserve = &competitionPayoutResolved{
			Mode:     cur.PrizePayoutMode,
			Percents: cur.PrizePlacePercents,
		}
	}
	payout, payoutErrKey := resolveCompetitionPayout(
		enums, formatID, prizeDisplay, body.IsFree, body.EntryFeeAmount,
		competitionPayoutRequest{
			Mode:     body.PrizePayoutMode,
			Percents: body.PrizePlacePercents,
			Engage:   payoutEngage,
		},
		preserve,
	)
	if payoutErrKey != "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, payoutErrKey)
		return
	}
	t, err := a.Tournaments.Update(r.Context(), id, store.UpdateTournamentInput{
		Title:                   title,
		Description:             desc,
		IsFree:                  body.IsFree,
		EntryFeeAmount:          body.EntryFeeAmount,
		EntryFeeCurrency:        currency,
		PrizePool:               prizePool,
		PrizePoolDisplayEnabled: prizeDisplay,
		MaxPlayers:              maxPlayers,
		FormatID:                formatID,
		ArenaDurationMinutes:    arenaDuration,
		PrizePayoutMode:         payout.Mode,
		PrizePlacePercents:      payout.Percents,
	})
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
		return
	}
	writeJSON(w, http.StatusOK, a.publicTournament(r.Context(), t, false))
}

// Delete removes a tournament (entries cascade).
func (a *TournamentAPI) Delete(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_tournament_not_found")
		return
	}
	if err := a.Tournaments.Delete(r.Context(), id); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_delete_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *TournamentAPI) refundTournamentEntriesBeforeClose(ctx context.Context, tournamentID string) error {
	if a == nil || a.Entries == nil {
		return fmt.Errorf("entries unavailable")
	}
	entries, err := a.Entries.ListByTournament(ctx, tournamentID)
	if err != nil {
		return err
	}
	for i := range entries {
		en := entries[i]
		if en.IsFree || en.EntryFeeCharged <= 0 {
			continue
		}
		if a.Payments == nil {
			return fmt.Errorf("payments unavailable for tournament entry refund")
		}
		if err := a.Payments.RefundTournamentEntryFee(ctx, en.UserID, en.EntryFeeCharged, en.Currency, en.ID); err != nil {
			return err
		}
		if err := a.Entries.ClearEntryFeeCharged(ctx, en.ID); err != nil {
			return err
		}
	}
	return nil
}

func (a *TournamentAPI) SetStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body tournamentStatusBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_status_required")
		return
	}
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" || !a.Settings.IsAllowedTournamentStatus(body.Status) {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_status")
		return
	}
	enums := a.Settings.ClientEnums()
	prevStatus := ""
	var prev *store.Tournament
	if p, err := a.Tournaments.Get(r.Context(), id); err == nil && p != nil {
		prev = p
		prevStatus = p.Status
	}
	enrollable := strings.TrimSpace(enums.EnrollableTournamentStatus)
	archivedStatus := "archived"
	for _, st := range enums.TournamentStatuses {
		if strings.TrimSpace(st) == "archived" {
			archivedStatus = st
			break
		}
	}
	// Soft lifecycle:
	// - After start/finish: only Archive (or no-op) - never draft/open flip; no seat refund.
	// - open → archived before start: refund seats + clear pre-start freeze.
	if prev != nil && prev.StartedAt != nil {
		if body.Status != archivedStatus && body.Status != prevStatus {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_cup_already_started")
			return
		}
	} else if prev != nil && enrollable != "" && prevStatus == enrollable && body.Status == archivedStatus {
		if err := a.refundTournamentEntriesBeforeClose(r.Context(), id); err != nil {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
			return
		}
		if _, err := a.Tournaments.ClearPrizePoolFreeze(r.Context(), id); err != nil {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_refund_failed")
			return
		}
	}
	// Freeze live pot when leaving enrollable status (first transition only; fail closed).
	if prev != nil && prev.PrizePoolDisplayEnabled && !prev.IsFree && prev.PrizePoolFrozenAmount == nil {
		enrollable := ""
		if a.Settings != nil {
			enums := a.Settings.ClientEnums()
			if enums.Source == "database" {
				enrollable = enums.EnrollableTournamentStatus
			}
		}
		if enrollable != "" && prevStatus == enrollable && body.Status != enrollable &&
			body.Status != archivedStatus {
			if a.Entries == nil {
				writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_status_update_failed")
				return
			}
			playersCount, countErr := a.Entries.CountByTournament(r.Context(), id)
			if countErr != nil {
				writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_status_update_failed")
				return
			}
			guarantee := 0.0
			if prev.PrizePool != nil {
				switch v := prev.PrizePool["total"].(type) {
				case float64:
					guarantee = payments.RoundMoney2(v)
				case int:
					guarantee = payments.RoundMoney2(float64(v))
				}
			}
			amt := payments.RoundMoney2(float64(playersCount)*prev.EntryFeeAmount + guarantee)
			if _, err := a.Tournaments.FreezePrizePool(r.Context(), id, amt); err != nil {
				writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_status_update_failed")
				return
			}
		}
	}
	t, err := a.Tournaments.SetStatus(r.Context(), id, body.Status)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_status_update_failed")
		return
	}
	a.emitTournamentLifecycle(r.Context(), t, prevStatus)
	writeJSON(w, http.StatusOK, a.publicTournament(r.Context(), t, false))
}

func (a *TournamentAPI) emitTournamentLifecycle(ctx context.Context, t *store.Tournament, previousStatus string) {
	if a.DB == nil || !a.DB.Ready() || t == nil || a.Settings == nil {
		return
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		return
	}
	var entrants []string
	if a.Entries != nil {
		if ids, err := a.Entries.ListUserIDsByTournament(ctx, t.ID, false); err == nil {
			entrants = ids
		}
	}
	notifications.NotifyTournamentLifecycle(
		ctx,
		a.DB.Pool,
		enums.DefaultRole,
		enums.EnrollableTournamentStatus,
		t.ID,
		t.Title,
		t.Status,
		previousStatus,
		entrants,
	)
}

func (a *TournamentAPI) uploadTournamentImage(w http.ResponseWriter, r *http.Request) (url string, ok bool) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return "", false
	}
	if a.Avatars == nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_media_unavailable")
		return "", false
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_multipart")
		return "", false
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_file_required")
		return "", false
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_read_failed")
		return "", false
	}
	url, err = a.Avatars.UploadTournamentPrizeImage(userID, header.Filename, header.Header.Get("Content-Type"), data)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_upload_failed")
		return "", false
	}
	return url, true
}

// UploadPrizeImage accepts multipart file upload and sets prize_image_url.
func (a *TournamentAPI) UploadPrizeImage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	url, ok := a.uploadTournamentImage(w, r)
	if !ok {
		return
	}
	t, err := a.Tournaments.SetPrizeImage(r.Context(), id, url)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	writeJSON(w, http.StatusOK, a.publicTournament(r.Context(), t, false))
}

// UploadGalleryImage accepts multipart file upload and appends the URL to gallery.
func (a *TournamentAPI) UploadGalleryImage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	url, ok := a.uploadTournamentImage(w, r)
	if !ok {
		return
	}
	t, err := a.Tournaments.AppendGallery(r.Context(), id, url)
	if err != nil {
		if errors.Is(err, store.ErrGalleryFull) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "gallery_limit_reached")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	writeJSON(w, http.StatusOK, a.publicTournament(r.Context(), t, false))
}

// ClearPrizeImage clears the tournament prize thumbnail.
func (a *TournamentAPI) ClearPrizeImage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	t, err := a.Tournaments.ClearPrizeImage(r.Context(), id)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	writeJSON(w, http.StatusOK, a.publicTournament(r.Context(), t, false))
}

// RemoveGalleryImage removes one gallery slot by 0-based index.
func (a *TournamentAPI) RemoveGalleryImage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	idxRaw := strings.TrimSpace(chi.URLParam(r, "index"))
	index, err := strconv.Atoi(idxRaw)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
		return
	}
	t, err := a.Tournaments.RemoveGalleryAt(r.Context(), id, index)
	if err != nil {
		if errors.Is(err, store.ErrGalleryIndex) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_update_failed")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	writeJSON(w, http.StatusOK, a.publicTournament(r.Context(), t, false))
}

func (a *TournamentAPI) Enroll(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	t, err := a.Tournaments.Get(r.Context(), id)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	enums := store.ClientEnumsConfig{}
	enrollable := ""
	if a.Settings != nil {
		enums = a.Settings.ClientEnums()
		if enums.Source == "database" {
			enrollable = enums.EnrollableTournamentStatus
		}
	}
	if enrollable == "" || enums.Source != "database" || t.Status != enrollable {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_not_open_for_enrollment")
		return
	}
	// After start: classic cups stay closed; Arena may late-join while the clock runs (DB flag).
	if t.FinishedAt != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_not_open_for_enrollment")
		return
	}
	if t.StartedAt != nil && !tournamentArenaLiveJoinAllowed(t, enums, time.Now().UTC()) {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_not_open_for_enrollment")
		return
	}
	// PlayerCapOrZero: nil Unlimited uncapped; valid >=2; lt2 orphan fail-closed hard cap.
	if seatCap := store.PlayerCapOrZero(t.MaxPlayers); seatCap > 0 && a.Entries != nil {
		n, cerr := a.Entries.CountByTournament(r.Context(), t.ID)
		if cerr != nil {
			msg := tournamentChromeString(a.Settings, r.Context(), "enroll_failed")
			if msg == "" {
				writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_not_open_for_enrollment")
				return
			}
			writeClientError(w, http.StatusInternalServerError, msg)
			return
		}
		if n >= seatCap {
			writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_not_open_for_enrollment")
			return
		}
	}

	// Paid enroll requires cash/RMG compliance (age, jurisdiction, locate, phone KYC).
	if !t.IsFree {
		payerCC := resolvePayerCountryFromRequest(r, a.Locate, a.Settings, 0, 0)
		if payerCC == "" {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "country_required_checkout")
			return
		}
		if !requireCashGate(w, r, a.Cash, a.Users, a.Settings, payerCC) {
			return
		}
	}

	exists, err := a.Entries.Exists(r.Context(), t.ID, userID)
	if err != nil {
		msg := tournamentChromeString(a.Settings, r.Context(), "enroll_failed")
		if msg == "" {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "wallet_chrome_unavailable")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	if exists {
		msg := tournamentChromeString(a.Settings, r.Context(), "already_enrolled")
		if msg == "" {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusConflict, "wallet_chrome_unavailable")
			return
		}
		writeJSON(w, http.StatusConflict, map[string]string{
			"error":     msg,
			"error_key": "already_enrolled",
		})
		return
	}

	fee := t.EntryFeeAmount
	// Free access is only the explicit is_free flag. Never invent free from a zero fee on a paid row.
	isFree := t.IsFree
	debited := false
	enrollFailed := tournamentChromeString(a.Settings, r.Context(), "enroll_failed")
	if isFree {
		fee = 0
	} else {
		if fee <= 0 {
			if enrollFailed == "" {
				writeWalletChromeError(w, a.Settings, r.Context(), http.StatusConflict, "wallet_chrome_unavailable")
				return
			}
			writeClientError(w, http.StatusConflict, enrollFailed)
			return
		}
		if err := a.Payments.DebitWallet(r.Context(), userID, fee, t.EntryFeeCurrency); err != nil {
			msg := walletChromeString(a.Settings, r.Context(), "wallet_insufficient_balance")
			if msg == "" {
				writeWalletChromeError(w, a.Settings, r.Context(), http.StatusPaymentRequired, "wallet_chrome_unavailable")
				return
			}
			writeJSON(w, http.StatusPaymentRequired, map[string]any{
				"error":    msg,
				"balance":  a.Payments.WalletBalance(r.Context(), userID, t.EntryFeeCurrency),
				"currency": t.EntryFeeCurrency,
			})
			return
		}
		debited = true
	}

	// Locked seat-cap insert (JoinWithCapacity parity). Soft pre-check above is UX only.
	seatCap := store.PlayerCapOrZero(t.MaxPlayers)
	entry, err := a.Entries.RegisterWithCapacity(
		r.Context(), t.ID, userID, fee, t.EntryFeeCurrency, isFree, seatCap,
	)
	if err != nil {
		if debited {
			if creditErr := a.Payments.CreditWallet(r.Context(), userID, fee, t.EntryFeeCurrency); creditErr != nil {
				if enrollFailed == "" {
					writeWalletChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "wallet_debit_failed")
					return
				}
				writeClientError(w, http.StatusInternalServerError, enrollFailed)
				return
			}
			if a.DB != nil && a.DB.Ready() {
				args := notifications.MoneyArgs(fee, t.EntryFeeCurrency)
				// No ledger/txn row for this credit; bare /transactions (empty entity).
				notifications.EmitPlayer(r.Context(), a.DB.Pool, userID, notifications.KindPlayerWalletCredited,
					"wallet_credited:tournament_enroll_fail:"+t.ID+":"+userID, "", args...)
			}
		}
		if errors.Is(err, store.ErrTournamentEntryFull) {
			writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_not_open_for_enrollment")
			return
		}
		if enrollFailed == "" {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusConflict, "wallet_chrome_unavailable")
			return
		}
		writeClientError(w, http.StatusConflict, enrollFailed)
		return
	}
	out := map[string]any{
		"entry":      entry,
		"tournament": a.publicTournament(r.Context(), t, true),
		"charged":    fee,
		"is_free":    isFree,
	}
	if !isFree {
		if cur := strings.TrimSpace(t.EntryFeeCurrency); cur != "" {
			out["charged_currency"] = cur
		}
	}
	writeJSON(w, http.StatusCreated, out)
}

// mergePrizePoolPlaces writes numeric place keys into prize_pool (skips total/currency).
// Sum of positive place amounts must not exceed total.
func mergePrizePoolPlaces(pool map[string]any, places map[string]float64, total float64) error {
	if pool == nil || len(places) == 0 {
		return nil
	}
	sum := 0.0
	for raw, amt := range places {
		place, err := strconv.Atoi(strings.TrimSpace(raw))
		if err != nil || place < 1 {
			continue
		}
		v := payments.RoundMoney2(amt)
		if v <= 0 {
			continue
		}
		pool[strconv.Itoa(place)] = v
		sum = payments.RoundMoney2(sum + v)
	}
	if sum > payments.RoundMoney2(total)+0.001 {
		return fmt.Errorf("prize place amounts exceed total")
	}
	return nil
}
