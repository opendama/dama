package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/game/ai"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/redisx"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type API struct {
	Store             *GameStore
	Hub               *ws.Hub
	Flags             *store.FlagStore
	Matches           *store.MatchHistoryStore
	Settings          *store.SettingsStore
	Users             *store.UserStore
	Cash              *store.CashRmgStore
	Redis             *redisx.Client
	DB                *db.Handle
	HostedEvents      *store.HostedEventStore
	Tournaments       *store.TournamentStore
	CompetitionPrizes *store.CompetitionPrizeStore
	Payments          *payments.Service
	RBAC              *store.RBACStore
	OfficialPause     *store.OfficialPauseStore
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeClientError returns a fixed client-safe message (never raw err.Error()).
func writeClientError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func Healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Readyz reports Postgres + Redis connectivity (not liveness alone).
// Use for load-balancer / Docker readiness; GET /healthz stays process-alive only.
func (a *API) Readyz(w http.ResponseWriter, r *http.Request) {
	timeoutSec := 5
	if v := strings.TrimSpace(os.Getenv("DAMA_READYZ_TIMEOUT_SEC")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 && n <= 60 {
			timeoutSec = n
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(timeoutSec)*time.Second)
	defer cancel()

	type checks struct {
		Postgres string `json:"postgres"`
		Redis    string `json:"redis"`
	}
	c := checks{Postgres: "ok", Redis: "ok"}
	ready := true
	if a.DB == nil || !a.DB.Ready() {
		c.Postgres = "error"
		ready = false
	} else if err := a.DB.Pool.Ping(ctx); err != nil {
		c.Postgres = "error"
		ready = false
	}
	if a.Redis == nil || !a.Redis.Ready() {
		c.Redis = "error"
		ready = false
	} else if err := a.Redis.RDB.Ping(ctx).Err(); err != nil {
		c.Redis = "error"
		ready = false
	}

	out := map[string]any{
		"service":   "dama-api",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"checks":    c,
	}
	if !ready {
		out["status"] = "not_ready"
		writeJSON(w, http.StatusServiceUnavailable, out)
		return
	}
	out["status"] = "ok"
	writeJSON(w, http.StatusOK, out)
}

type startRequest struct {
	Mode               string `json:"mode"`
	AISearchDepth      int    `json:"ai_search_depth"`
	TimeControlSeconds int    `json:"time_control_seconds"`
}

func (a *API) StartGame(w http.ResponseWriter, r *http.Request) {
	var req startRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Mode == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "mode required"})
		return
	}
	if req.Mode != "ai" && req.Mode != "pvp" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "mode must be ai or pvp"})
		return
	}
	if claims := auth.ClaimsFromContext(r.Context()); claims != nil && claims.Role == "guest" && req.Mode != "ai" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "guest practice is VS-AI only"})
		return
	}
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "board rules unavailable"})
		return
	}
	rules := a.Settings.BoardRules()
	if rules.Source != "database" || rules.Size != engine.BoardSize || rules.SetupRows <= 0 || rules.Variant == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "board rules unavailable"})
		return
	}
	flags := a.Flags.Get(r.Context())
	if req.Mode == "ai" && !flags.VSAIEnabled {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error": "practice mode unavailable",
		})
		return
	}
	if req.Mode == "ai" {
		if len(flags.AIDepths) == 0 {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "ai depths missing from feature flag store"})
			return
		}
		if req.AISearchDepth <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ai_search_depth required"})
			return
		}
		allowed := false
		for _, d := range flags.AIDepths {
			if d == req.AISearchDepth {
				allowed = true
				break
			}
		}
		if !allowed {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ai depth not permitted"})
			return
		}
		// Same fail-closed preset gate as invites / matchmaking (challenge Time picker).
		clock := a.Settings.MatchClock()
		if clock.Source != "database" || len(clock.Presets) == 0 {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "time controls unavailable"})
			return
		}
		tcOK := false
		for _, p := range clock.Presets {
			if p.Seconds == req.TimeControlSeconds && p.Seconds > 0 {
				tcOK = true
				break
			}
		}
		if !tcOK {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "time_control_seconds must match match_clock.presets"})
			return
		}
	}

	id := uuid.NewString()
	state, err := engine.InitialState(req.Mode, req.AISearchDepth, rules.SetupRows, rules.Variant)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "unable to initialize board"})
		return
	}
	if uid := auth.UserIDFromContext(r.Context()); uid != "" && state.Player1ID == nil {
		state.Player1ID = &uid
	}
	preferredTC := 0
	if req.Mode == "ai" {
		preferredTC = req.TimeControlSeconds
	}
	stampMatchClockFromSettings(a.Settings, state, preferredTC)
	if _, err := a.Store.Create(id, state); err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "unable to start game")
		return
	}
	// Pre-build High-ECC join QR (logo center) so Watch popover is ready immediately.
	WarmJoinQRPNG(a.Settings, id)

	writeJSON(w, http.StatusCreated, a.gamePayload(id, state))
}

func (a *API) GetGameState(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	// Prefer Redis so reconnect sees official/player pause from another replica.
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "game not found"})
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if !a.canAccessGameAsViewer(r.Context(), userID, id, rec.State) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	// Persist debit (and flag-fall) so reconnect never rewinds remaining time.
	if finished, flagged, err := a.syncMatchClock(r.Context(), id, rec.State); flagged {
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, finished)
		return
	} else if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	// syncMatchClock may auto-resume an expired player pause in Redis; re-read so
	// the payload cannot keep a stale paused=true board from the first load.
	if fresh, ok := a.Store.GetAuthoritative(id); ok && fresh.State != nil {
		rec = fresh
	}
	writeJSON(w, http.StatusOK, a.gamePayload(rec.ID, rec.State))
}

// ListLiveGames returns unfinished public PvP games for the Watch rail.
// Private hosted-event bracket games are excluded (members use event manage/live board).
// Optional q matches game id or either player's username (case-insensitive substring).
func (a *API) ListLiveGames(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	if a.Store == nil {
		meta := pagination.BuildMeta(params, 0, skipCap, labels)
		writeJSON(w, http.StatusOK, map[string]any{"games": []any{}, "meta": meta})
		return
	}
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	all := a.Store.AllListableLiveIDsNewestFirst()
	filtered := make([]string, 0, len(all))
	for _, id := range all {
		if a.isPrivateHostedEventGame(r.Context(), id) {
			continue
		}
		rec, ok := a.Store.Get(id)
		if !ok || rec.State == nil || engine.GameOutcome(rec.State) != nil {
			continue
		}
		if rec.State.Mode == "ai" || rec.State.Mode == "practice" {
			continue
		}
		if q != "" && !a.liveGameMatchesQuery(r, rec, q) {
			continue
		}
		filtered = append(filtered, id)
	}
	total := len(filtered)
	ids := []string{}
	if params.Skip < total {
		end := params.Skip + params.Limit
		if end > total {
			end = total
		}
		ids = filtered[params.Skip:end]
	}
	out := make([]map[string]any, 0, len(ids))
	for _, id := range ids {
		rec, ok := a.Store.Get(id)
		if !ok || rec.State == nil || engine.GameOutcome(rec.State) != nil {
			continue
		}
		if rec.State.Mode == "ai" || rec.State.Mode == "practice" {
			continue
		}
		row := map[string]any{
			"id":         rec.ID,
			"mode":       rec.State.Mode,
			"move_count": rec.State.MoveCount,
		}
		if rec.State.TimeControlSeconds > 0 {
			row["time_control_seconds"] = rec.State.TimeControlSeconds
		}
		if rec.State.Player1ID != nil {
			row["player1_id"] = *rec.State.Player1ID
			if a.Users != nil {
				if u, err := a.Users.GetByID(r.Context(), *rec.State.Player1ID); err == nil {
					row["player1_username"] = u.Username
					row["player1_rating"] = u.Rating
					row["player1_wins"] = u.Wins
					row["player1_losses"] = u.Losses
					row["player1_draws"] = u.Draws
					if u.AvatarThumbURL != nil {
						row["player1_avatar_thumb_url"] = *u.AvatarThumbURL
					}
					if u.AvatarFullURL != nil {
						row["player1_avatar_full_url"] = *u.AvatarFullURL
					}
					if u.CountryCode != nil {
						row["player1_country_code"] = *u.CountryCode
					}
					trust := map[string]any{}
					stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, trust)
					if tier, ok := trust["host_trust_tier"].(string); ok && tier != "" {
						row["player1_host_trust_tier"] = tier
					}
					if badge, ok := trust["host_trust_badge"].(string); ok && badge != "" {
						row["player1_host_trust_badge"] = badge
					}
				}
			}
		}
		if rec.State.Player2ID != nil {
			row["player2_id"] = *rec.State.Player2ID
			if a.Users != nil {
				if u, err := a.Users.GetByID(r.Context(), *rec.State.Player2ID); err == nil {
					row["player2_username"] = u.Username
					row["player2_rating"] = u.Rating
					row["player2_wins"] = u.Wins
					row["player2_losses"] = u.Losses
					row["player2_draws"] = u.Draws
					if u.AvatarThumbURL != nil {
						row["player2_avatar_thumb_url"] = *u.AvatarThumbURL
					}
					if u.AvatarFullURL != nil {
						row["player2_avatar_full_url"] = *u.AvatarFullURL
					}
					if u.CountryCode != nil {
						row["player2_country_code"] = *u.CountryCode
					}
					trust := map[string]any{}
					stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, trust)
					if tier, ok := trust["host_trust_tier"].(string); ok && tier != "" {
						row["player2_host_trust_tier"] = tier
					}
					if badge, ok := trust["host_trust_badge"].(string); ok && badge != "" {
						row["player2_host_trust_badge"] = badge
					}
				}
			}
		}
		if a.Hub != nil {
			row["spectator_count"] = a.Hub.SpectatorCount(rec.ID)
			// Sample faces for AvatarStack (max 3 faces + overflow chip).
			row["viewers"] = a.hydrateSpectatorRows(r, a.Hub.SpectatorUserIDs(rec.ID, 4))
		} else {
			row["spectator_count"] = 0
			row["viewers"] = []any{}
		}
		out = append(out, row)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"games": out, "meta": meta})
}

func (a *API) liveGameMatchesQuery(r *http.Request, rec *GameRecord, qLower string) bool {
	if rec == nil {
		return false
	}
	if strings.Contains(strings.ToLower(rec.ID), qLower) {
		return true
	}
	if a.Users == nil || rec.State == nil {
		return false
	}
	matchUser := func(id *string) bool {
		if id == nil || *id == "" {
			return false
		}
		u, err := a.Users.GetByID(r.Context(), *id)
		if err != nil || u == nil {
			return false
		}
		return strings.Contains(strings.ToLower(u.Username), qLower)
	}
	return matchUser(rec.State.Player1ID) || matchUser(rec.State.Player2ID)
}

func (a *API) hydrateSpectatorRows(r *http.Request, viewerIDs []string) []map[string]any {
	viewers := make([]map[string]any, 0, len(viewerIDs))
	if a.Users == nil {
		return viewers
	}
	for _, vid := range viewerIDs {
		u, err := a.Users.GetByID(r.Context(), vid)
		if err != nil || u == nil || !u.IsActive {
			continue
		}
		if a.Settings != nil && a.Settings.IsConsoleRole(u.Role) {
			continue
		}
		vrow := map[string]any{
			"id":       u.ID,
			"username": u.Username,
			"wins":     u.Wins,
			"losses":   u.Losses,
			"draws":    u.Draws,
			"rating":   u.Rating,
			"xp":       u.XP,
			"region":   u.Region,
			"playing":  false,
		}
		if u.AvatarThumbURL != nil {
			vrow["avatar_thumb_url"] = *u.AvatarThumbURL
		}
		if u.AvatarFullURL != nil {
			vrow["avatar_full_url"] = *u.AvatarFullURL
		}
		if u.CountryCode != nil {
			vrow["country_code"] = *u.CountryCode
		}
		if a.Store != nil {
			if gid, ok := a.Store.PlayingGameID(vid); ok {
				vrow["playing"] = true
				vrow["playing_game_id"] = gid
			}
		}
		if a.Settings != nil {
			if label := a.Settings.LevelLabelForXP(u.XP); label != "" {
				vrow["level_label"] = label
			}
		}
		stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, vrow)
		viewers = append(viewers, vrow)
	}
	return viewers
}

// ListGameSpectators returns the live spectator roster for a game id (Games rail drill-in).
func (a *API) ListGameSpectators(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "game id required"})
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if !a.canSpectateHostedEventGame(r.Context(), userID, id) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	if a.Hub == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "spectators unavailable"})
		return
	}
	count := a.Hub.SpectatorCount(id)
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	// Rail drill-in: Trim skip/limit infinite scroll.
	if r.URL.Query().Get("skip") != "" && r.URL.Query().Get("limit") != "" {
		params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
		if !ok {
			return
		}
		var ids []string
		var total int
		if q != "" {
			// Search must span the full spectator roster, not only the current page.
			_, rosterTotal := a.Hub.SpectatorUserIDsPaged(id, 0, 1)
			allIDs, _ := a.Hub.SpectatorUserIDsPaged(id, 0, max(1, rosterTotal))
			matched := a.filterSpectatorIDsByQuery(r, allIDs, q)
			total = len(matched)
			if params.Skip < total {
				end := params.Skip + params.Limit
				if end > total {
					end = total
				}
				ids = matched[params.Skip:end]
			}
		} else {
			ids, total = a.Hub.SpectatorUserIDsPaged(id, params.Skip, params.Limit)
		}
		meta := pagination.BuildMeta(params, total, skipCap, labels)
		writeJSON(w, http.StatusOK, map[string]any{
			"spectator_count": count,
			"viewers":         a.hydrateSpectatorRows(r, ids),
			"meta":            meta,
		})
		return
	}
	// Legacy unpaged callers (cap keeps payload bounded).
	ids := a.Hub.SpectatorUserIDs(id, 80)
	if q != "" {
		ids = a.filterSpectatorIDsByQuery(r, ids, q)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"spectator_count": count,
		"viewers":         a.hydrateSpectatorRows(r, ids),
	})
}

func (a *API) filterSpectatorIDsByQuery(r *http.Request, ids []string, q string) []string {
	needle := strings.ToLower(strings.TrimSpace(q))
	if needle == "" || len(ids) == 0 {
		return ids
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if a.Users == nil {
			continue
		}
		u, err := a.Users.GetByID(r.Context(), id)
		if err != nil || u == nil || !u.IsActive {
			continue
		}
		if strings.Contains(strings.ToLower(u.Username), needle) {
			out = append(out, id)
		}
	}
	return out
}

type moveRequest struct {
	From [2]int `json:"from"`
	To   [2]int `json:"to"`
}

func (a *API) ApplyMove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req moveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	payload, err := a.ApplyMoveCore(r.Context(), id, auth.UserIDFromContext(r.Context()), req.From, req.To)
	if err != nil {
		if a.writePlayPausedErr(w, r, err) {
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// AbandonGame resigns the authenticated seat (opponent wins; VS-AI counts as a loss for the human).
func (a *API) AbandonGame(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	payload, err := a.AbandonGameCore(r.Context(), id, auth.UserIDFromContext(r.Context()))
	if err != nil {
		if a.writePlayPausedErr(w, r, err) {
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *API) AbandonGameCore(ctx context.Context, id, userID string) (map[string]any, error) {
	if userID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	if err := a.requireOTPVerified(ctx, userID); err != nil {
		return nil, err
	}
	// Prefer Redis so official pause on another replica cannot be bypassed by resign.
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok {
		return nil, fmt.Errorf("game not found")
	}
	seat := 0
	if rec.State.Player1ID != nil && *rec.State.Player1ID == userID {
		seat = engine.PlayerOne
	} else if rec.State.Player2ID != nil && *rec.State.Player2ID == userID {
		seat = engine.PlayerTwo
	} else if rec.State.Mode == "ai" && (rec.State.Player1ID == nil || *rec.State.Player1ID == "") {
		// Practice bootstrap: bind human as P1 then resign.
		uid := userID
		rec.State.Player1ID = &uid
		seat = engine.PlayerOne
	} else {
		return nil, fmt.Errorf("not a seat in this game")
	}
	// Idempotent stop: board already finished (double-click / clock race) → same success payload.
	if outcome := engine.GameOutcome(rec.State); outcome != nil {
		return a.gamePayload(id, rec.State), nil
	}
	// Official pause locks resign; admin force-result stays a separate privileged path.
	if rec.State.Paused && strings.TrimSpace(rec.State.PauseKind) == engine.PauseKindOfficial {
		return nil, fmt.Errorf("officially paused")
	}
	winner := engine.PlayerTwo
	if seat == engine.PlayerTwo {
		winner = engine.PlayerOne
	}
	next := *rec.State
	next.ForcedOutcome = &winner
	next.MustContinue = nil
	next.EndReason = "resign"
	clearPauseFields(&next)
	// Concurrent official pause must win over Stop. Player pause still allows resign.
	if a.applyStorePauseOnto(id, &next) {
		if strings.TrimSpace(next.PauseKind) == engine.PauseKindOfficial {
			return nil, fmt.Errorf("officially paused")
		}
		clearPauseFields(&next)
	}
	if err := a.Store.Update(id, &next); err != nil {
		return nil, fmt.Errorf("unable to abandon game")
	}
	// Ack/broadcast first. History must never gate Stop - guest practice JWTs have no
	// users row, so sync match_history INSERT failed FK and surfaced "Failed to load match".
	payload := a.gamePayload(id, &next)
	if a.Hub != nil {
		a.Hub.BroadcastGame(id, map[string]any{"type": "game_state", "game": payload})
	}
	a.scheduleMatchFinalize(id, &next, winner)
	return payload, nil
}

// ApplyMoveCore is shared by REST and raw game WebSocket move ingress.
func (a *API) ApplyMoveCore(ctx context.Context, id, userID string, from, to [2]int) (map[string]any, error) {
	if userID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	if err := a.requireOTPVerified(ctx, userID); err != nil {
		return nil, err
	}
	// Prefer Redis so a concurrent official pause on another replica blocks the move.
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok {
		return nil, fmt.Errorf("game not found")
	}

	if outcome := engine.GameOutcome(rec.State); outcome != nil {
		return nil, fmt.Errorf("game already finished")
	}
	// Expired pause must auto-resume before rejecting moves (same path as GET/sweeper).
	if rec.State.Paused {
		if finished, flagged, err := a.syncMatchClock(ctx, id, rec.State); flagged {
			return finished, err
		} else if err != nil {
			return nil, err
		}
		rec, ok = a.Store.GetAuthoritative(id)
		if !ok || rec.State == nil {
			return nil, fmt.Errorf("game not found")
		}
		if rec.State.Paused {
			return nil, pausedRejectErr(rec.State)
		}
	}

	// Seat check before clock debit so Watch-rail / non-turn callers cannot burn or flag a clock.
	if err := assertSeatMayMove(rec.State, userID); err != nil {
		return nil, err
	}

	nowMs := time.Now().UnixMilli()
	flagged, advanced := engine.DebitActiveClock(rec.State, nowMs)
	if flagged {
		return a.finishClockFlag(ctx, id, rec.State)
	}
	// Persist tick immediately so a rejected move / crash cannot rewind remaining.
	if advanced {
		// Concurrent official/player pause must win over this debit persist.
		_ = a.applyStorePauseOnto(id, rec.State)
		if err := a.Store.Update(id, rec.State); err != nil {
			return nil, fmt.Errorf("unable to save clock")
		}
	}
	// Pause may have landed between GetAuthoritative and the debit persist.
	if a.applyStorePauseOnto(id, rec.State) || rec.State.Paused {
		return nil, pausedRejectErr(rec.State)
	}

	move := engine.FindMove(rec.State, from[0], from[1], to[0], to[1])
	if move == nil {
		return nil, fmt.Errorf("illegal move")
	}

	mover := rec.State.Turn
	next, err := engine.ApplyMove(rec.State, *move)
	if err != nil {
		return nil, fmt.Errorf("illegal move")
	}
	if next.MustContinue == nil {
		engine.GrantClockIncrement(next, mover)
	}

	// Non-monetary VS-AI reply when it is the computer's turn.
	if next.Mode == "ai" && next.AIPlayer != nil && a.Flags.Get(ctx).VSAIEnabled {
		if a.Hub != nil {
			a.Hub.BroadcastGame(id, map[string]any{"type": "ai_thinking", "thinking": true})
		}
		for engine.GameOutcome(next) == nil && next.MustContinue == nil && next.Turn == *next.AIPlayer {
			// Concurrent pause (other tab / seat) wins: keep human ply, stop AI replies.
			if a.applyStorePauseOnto(id, next) {
				break
			}
			nowMs = time.Now().UnixMilli()
			if flagged, _ := engine.DebitActiveClock(next, nowMs); flagged {
				if a.Hub != nil {
					a.Hub.BroadcastGame(id, map[string]any{"type": "ai_thinking", "thinking": false})
				}
				return a.finishClockFlag(ctx, id, next)
			}
			// Pause may land after debit; do not spend an AI ply under freeze.
			if a.applyStorePauseOnto(id, next) {
				break
			}
			aiMover := next.Turn
			aiMove := ai.ChooseMove(next, next.AISearchDepth)
			if aiMove == nil {
				break
			}
			if a.applyStorePauseOnto(id, next) {
				break
			}
			aiNext, err := engine.ApplyMove(next, *aiMove)
			if err != nil {
				break
			}
			next = aiNext
			if next.MustContinue == nil {
				engine.GrantClockIncrement(next, aiMover)
			}
			if next.MustContinue != nil {
				for next.MustContinue != nil && engine.GameOutcome(next) == nil {
					if a.applyStorePauseOnto(id, next) {
						break
					}
					nowMs = time.Now().UnixMilli()
					if flagged, _ := engine.DebitActiveClock(next, nowMs); flagged {
						if a.Hub != nil {
							a.Hub.BroadcastGame(id, map[string]any{"type": "ai_thinking", "thinking": false})
						}
						return a.finishClockFlag(ctx, id, next)
					}
					if a.applyStorePauseOnto(id, next) {
						break
					}
					contMover := next.Turn
					cont := ai.ChooseMove(next, next.AISearchDepth)
					if cont == nil {
						break
					}
					if a.applyStorePauseOnto(id, next) {
						break
					}
					contNext, err := engine.ApplyMove(next, *cont)
					if err != nil {
						break
					}
					next = contNext
					if next.MustContinue == nil {
						engine.GrantClockIncrement(next, contMover)
					}
				}
			}
		}
		if a.Hub != nil {
			a.Hub.BroadcastGame(id, map[string]any{"type": "ai_thinking", "thinking": false})
		}
	}

	// Last look: do not wipe a pause that landed while this move was in flight.
	_ = a.applyStorePauseOnto(id, next)

	if err := a.Store.Update(id, next); err != nil {
		return nil, fmt.Errorf("unable to save move")
	}

	// Ack/broadcast the board first. History, career, notifs, and bracket must never
	// gate the move ACK - that produced false "Move failed" toasts on winning plies.
	payload := a.gamePayload(id, next)
	if a.Hub != nil {
		a.Hub.BroadcastGame(id, map[string]any{"type": "game_state", "game": payload})
	}
	if outcome := engine.GameOutcome(next); outcome != nil {
		a.scheduleMatchFinalize(id, next, *outcome)
	}
	return payload, nil
}

// scheduleMatchFinalize records history / career / bracket after the board is already persisted.
func (a *API) scheduleMatchFinalize(gameID string, state *engine.State, outcome int) {
	if a.Matches == nil || state == nil {
		return
	}
	p1, p2 := "", ""
	if state.Player1ID != nil {
		p1 = *state.Player1ID
	}
	if state.Player2ID != nil {
		p2 = *state.Player2ID
	}
	if p1 == "" && p2 == "" {
		return
	}
	winnerID := ""
	isDraw := state.Draw || outcome == engine.Draw
	if !isDraw {
		switch outcome {
		case engine.PlayerOne:
			winnerID = p1
		case engine.PlayerTwo:
			winnerID = p2
		}
	}
	in := store.RecordMatchInput{
		GameID:        gameID,
		Mode:          state.Mode,
		Player1ID:     p1,
		Player2ID:     p2,
		WinnerID:      winnerID,
		IsDraw:        isDraw,
		MoveCount:     state.MoveCount,
		AISearchDepth: state.AISearchDepth,
		IsFree:        true,
		Rated:         state.Mode != "ai" && state.Rated,
	}
	isAI := state.Mode == "ai"
	rated := state.Rated
	endReason := strings.TrimSpace(state.EndReason)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		a.finalizeRecordedMatch(ctx, in, isAI, rated, endReason)
	}()
}

func (a *API) finalizeRecordedMatch(ctx context.Context, in store.RecordMatchInput, isAI bool, rated bool, endReason string) {
	if a.Matches == nil {
		return
	}
	// Guest practice seats are JWT-only (no users row). Null non-DB ids before INSERT so
	// AI history still records without FK failures (abandon / natural AI end).
	if isAI && a.Users != nil {
		resolveDBUser := func(uid string) string {
			if uid == "" {
				return ""
			}
			u, err := a.Users.GetByID(ctx, uid)
			if err != nil || u == nil {
				return ""
			}
			return uid
		}
		in.Player1ID = resolveDBUser(in.Player1ID)
		in.Player2ID = resolveDBUser(in.Player2ID)
		in.WinnerID = resolveDBUser(in.WinnerID)
	}
	_, created, err := a.Matches.Record(ctx, in)
	if err != nil {
		log.Printf("match finalize: Record game=%s: %v", in.GameID, err)
		return
	}
	// Duplicate finalize (clock claim + sweeper race): history row already owns side effects.
	if !created {
		return
	}
	p1, p2, winnerID, isDraw := in.Player1ID, in.Player2ID, in.WinnerID, in.IsDraw
	id := in.GameID
	if !isAI && a.DB != nil && a.DB.Ready() && p1 != "" && p2 != "" {
		onTime := endReason == "clock_flag" || endReason == "clock_draw"
		// Non-clock finishes use stable result tokens. Clock finishes are DB-only (no invent / no "finished").
		winLabel, lossLabel, drawLabel := "win", "loss", "draw"
		if onTime {
			winLabel, lossLabel, drawLabel = "", "", ""
			if a.Settings != nil {
				winLabel = strings.TrimSpace(a.Settings.PlayChromeField(ctx, "notif_result_win_on_time"))
				lossLabel = strings.TrimSpace(a.Settings.PlayChromeField(ctx, "notif_result_loss_on_time"))
				drawLabel = strings.TrimSpace(a.Settings.PlayChromeField(ctx, "notif_result_draw_on_time"))
			}
		}
		p1Name, p2Name := p1, p2
		if a.Users != nil {
			if u, err := a.Users.GetByID(ctx, p1); err == nil && u != nil {
				p1Name = u.Username
			}
			if u, err := a.Users.GetByID(ctx, p2); err == nil && u != nil {
				p2Name = u.Username
			}
		}
		resultLabel := drawLabel
		p2Result := drawLabel
		if !isDraw {
			if onTime {
				// Fail closed: empty string if chrome missing (never invent "finished"/"win").
				resultLabel = ""
				p2Result = ""
				if winnerID == p1 {
					resultLabel = winLabel
					p2Result = lossLabel
				} else if winnerID == p2 {
					resultLabel = lossLabel
					p2Result = winLabel
				}
			} else {
				resultLabel = "finished"
				p2Result = "finished"
				if winnerID == p1 {
					resultLabel = winLabel
					p2Result = lossLabel
				} else if winnerID == p2 {
					resultLabel = lossLabel
					p2Result = winLabel
				}
			}
		}
		// On-time: skip emit when DB chrome labels are empty (never blank "%s ended ()").
		if !onTime || strings.TrimSpace(resultLabel) != "" {
			notifications.EmitPlayer(ctx, a.DB.Pool, p1, notifications.KindPlayerGameFinished,
				"game_finished:"+id+":"+p1, id, p2Name, resultLabel)
		}
		if !onTime || strings.TrimSpace(p2Result) != "" {
			notifications.EmitPlayer(ctx, a.DB.Pool, p2, notifications.KindPlayerGameFinished,
				"game_finished:"+id+":"+p2, id, p1Name, p2Result)
		}
	}
	if !isAI && a.shouldApplyCareerForGame(ctx, id, rated) && a.Users != nil && a.Settings != nil {
		rewards := a.Settings.MatchRewards()
		if rewards.Source == "database" {
			applySeat := func(uid string) {
				if uid == "" {
					return
				}
				result := "draw"
				if !isDraw {
					if uid == winnerID {
						result = "win"
					} else {
						result = "loss"
					}
				}
				if err := a.Users.ApplyCareerResult(ctx, uid, result, rewards); err != nil {
					log.Printf("career: ApplyCareerResult game=%s user=%s result=%s: %v", id, uid, result, err)
				}
			}
			applySeat(p1)
			applySeat(p2)
		}
	}
	if !isAI {
		a.AdvanceBracketFromGame(ctx, id, winnerID, isDraw)
	}
}

// assertSeatMayMove enforces turn ownership when seats are bound to users.
func assertSeatMayMove(state *engine.State, userID string) error {
	var seat *string
	switch state.Turn {
	case engine.PlayerOne:
		seat = state.Player1ID
	case engine.PlayerTwo:
		seat = state.Player2ID
	default:
		return fmt.Errorf("invalid turn")
	}
	if seat == nil || *seat == "" {
		// Practice bootstrap: seat not bound yet; authenticated actor may move.
		return nil
	}
	if *seat != userID {
		return fmt.Errorf("not your turn")
	}
	return nil
}

func (a *API) FeatureFlags(w http.ResponseWriter, r *http.Request) {
	// Public client payload only. Payment-mode / store source stay on console GraphQL.
	f := a.Flags.Get(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{
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
	})
}

type setFlagRequest struct {
	Key               string         `json:"key"`
	Enabled           bool           `json:"enabled"`
	Mode              string         `json:"mode"`
	Depths            []int          `json:"depths"`
	DisabledCountries []string       `json:"disabled_countries"`
	Payload           map[string]any `json:"payload"`
}

func (a *API) SetFeatureFlag(w http.ResponseWriter, r *http.Request) {
	var req setFlagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "key required"})
		return
	}
	if a.Settings == nil || a.Settings.FeatureFlagCatalog().Source != "database" || !a.Settings.IsCatalogFlagKey(req.Key) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown feature flag key"})
		return
	}
	catalog := a.Settings.FeatureFlagCatalog()
	// Preserve existing payload (e.g. disabled_countries) unless explicitly replaced.
	payload := map[string]any{}
	if cur := a.Flags.Get(r.Context()); cur.Raw != nil {
		if raw, ok := cur.Raw[req.Key].(map[string]any); ok {
			if prev, ok := raw["payload"].(map[string]any); ok {
				for k, v := range prev {
					payload[k] = v
				}
			}
		}
	}
	if req.Payload != nil {
		if dc, ok := req.Payload["disabled_countries"]; ok {
			payload["disabled_countries"] = dc
		}
	}
	if req.DisabledCountries != nil {
		out := make([]any, 0, len(req.DisabledCountries))
		for _, c := range req.DisabledCountries {
			c = strings.ToUpper(strings.TrimSpace(c))
			if c != "" {
				out = append(out, c)
			}
		}
		payload["disabled_countries"] = out
	}
	if req.Key == catalog.AIDepthsFlagKey {
		depths := make([]any, 0)
		if len(req.Depths) > 0 {
			for _, d := range req.Depths {
				if d < 1 || d > 20 {
					writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ai depth out of range (1-20)"})
					return
				}
				depths = append(depths, d)
			}
		} else {
			current := a.Flags.Get(r.Context())
			for _, d := range current.AIDepths {
				depths = append(depths, d)
			}
		}
		if len(depths) == 0 {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "ai depths required in database feature flag payload"})
			return
		}
		payload["depths"] = depths
	}
	for _, t := range catalog.Toggles {
		if t.Key == req.Key && t.Kind == "mode" {
			if a.Settings.ClientEnums().Source != "database" || !a.Settings.IsAllowedEthiopiaPaymentMode(req.Mode) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payment mode"})
				return
			}
			mode := payments.InternalChannel(req.Mode)
			if mode == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payment mode"})
				return
			}
			payload["mode"] = mode
			break
		}
	}
	if err := a.Flags.Set(r.Context(), req.Key, req.Enabled, payload); err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to update flag")
		return
	}
	f := a.Flags.Get(r.Context())
	if a.Hub != nil {
		// Public WS payload only (same fields as GET /feature-flags).
		a.Hub.BroadcastFeatureFlags(map[string]any{
			"type": "feature_flags",
			"flags": map[string]any{
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
			},
		})
	}
	a.FeatureFlags(w, r)
}

// requireOTPVerified enforces the same Redis OTP window as RequireOTPWhenEnabled for WSS moves.
func (a *API) requireOTPVerified(ctx context.Context, userID string) error {
	return MapOTPVerifiedError(a.Settings, EnsureOTPVerified(ctx, a.Flags, a.Redis, userID))
}

func (a *API) gamePayload(id string, state *engine.State) map[string]any {
	return buildGamePayload(id, state)
}

// buildGamePayload is shared by play API and bracket forfeit Redis sync.
func buildGamePayload(id string, state *engine.State) map[string]any {
	if state == nil {
		return map[string]any{"id": id}
	}
	outcome := engine.GameOutcome(state)
	var outcomeVal any
	if outcome != nil {
		outcomeVal = *outcome
	}
	nowMs := time.Now().UnixMilli()
	p1Ms, p2Ms := engine.ClockSnapshot(state, nowMs)
	return map[string]any{
		"id":                       id,
		"variant":                  state.Variant,
		"size":                     state.Size,
		"board":                    engine.PublicBoard(&state.Board),
		"turn":                     state.Turn,
		"mode":                     state.Mode,
		"must_continue":            state.MustContinue,
		"move_count":               state.MoveCount,
		"halfmove_clock":           state.HalfmoveClock,
		"draw":                     state.Draw,
		"draw_reason":              state.DrawReason,
		"legal_moves":              engine.LegalMoves(state),
		"move_history":             state.MoveHistory,
		"outcome":                  outcomeVal,
		"ai_player":                state.AIPlayer,
		"ai_search_depth":          state.AISearchDepth,
		"player1_id":               state.Player1ID,
		"player2_id":               state.Player2ID,
		"time_control_seconds":     state.TimeControlSeconds,
		"rated":                    state.Rated,
		"end_reason":               state.EndReason,
		"clock_active":             state.ClockActive,
		"clock_increment_seconds":  state.ClockIncrementSeconds,
		"clock_p1_remaining_ms":    p1Ms,
		"clock_p2_remaining_ms":    p2Ms,
		"clock_server_now_ms":      nowMs,
		"clock_last_tick_unix_ms":  state.ClockLastTickUnixMs,
		"paused":                   state.Paused,
		"paused_at_unix_ms":        state.PausedAtUnixMs,
		"pause_expires_at_unix_ms": state.PauseExpiresAtUnixMs,
		"paused_by_user_id":        state.PausedByUserID,
		"pause_remaining_ms":       pauseRemainingMs(state, nowMs),
		"pause_kind":               state.PauseKind,
		"pause_reason_key":         state.PauseReasonKey,
		"pause_reason_label":       state.PauseReasonLabel,
		"pause_note":               state.PauseNote,
		"pause_actor_role":         state.PauseActorRole,
		"pause_actor_display_name": state.PauseActorDisplayName,
	}
}
