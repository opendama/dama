package rest

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (a *HostedEventsAPI) eventBracketStatuses(enums store.ClientEnumsConfig) store.HostedBracketStatuses {
	return store.HostedBracketStatuses{
		Pending: enums.HostedEventBracketPending,
		Ready:   enums.HostedEventBracketReady,
		Live:    enums.HostedEventBracketLive,
		Done:    enums.HostedEventBracketDone,
		Bye:     enums.HostedEventBracketBye,
	}
}

func (a *HostedEventsAPI) CheckIn(w http.ResponseWriter, r *http.Request) {
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
	id := chi.URLParam(r, "id")
	if err := a.Events.CheckIn(r.Context(), id, userID, enums.HostedEventEntryApproved); err != nil {
		if errors.Is(err, store.ErrHostedEventCheckIn) {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "check_in_not_open")
			return
		}
		if strings.Contains(err.Error(), "not enrolled") {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_forbidden")
			return
		}
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *HostedEventsAPI) MarkMatchReady(w http.ResponseWriter, r *http.Request) {
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
	eventID := chi.URLParam(r, "id")
	matchID := chi.URLParam(r, "matchId")
	ev, err := a.Events.Get(r.Context(), eventID)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if ev.Status != enums.HostedEventLiveStatus || ev.StartedAt == nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_event_not_live")
		return
	}
	bst := a.eventBracketStatuses(enums)
	m, err := a.Events.MarkPlayerReady(r.Context(), eventID, matchID, userID)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_match_not_ready")
		return
	}
	if m.PlayerAReadyAt != nil && m.PlayerBReadyAt != nil && m.Status == bst.Ready {
		resp, startErr := a.startEventMatchGame(r.Context(), ev, m, bst, enums, false)
		if startErr != nil {
			writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_game_failed")
			return
		}
		writeJSON(w, http.StatusOK, resp)
		return
	}
	m.StatusLabel = store.StatusLabel(enums.HostedEventBracketStatusLabels, m.Status)
	writeJSON(w, http.StatusOK, map[string]any{"match": m})
}

func (a *HostedEventsAPI) startEventMatchGame(
	ctx context.Context,
	ev *store.HostedEvent,
	m *store.HostedBracketMatch,
	bst store.HostedBracketStatuses,
	enums store.ClientEnumsConfig,
	force bool,
) (map[string]any, error) {
	if m == nil || ev == nil {
		return nil, errors.New("match required")
	}
	if m.Status != bst.Ready {
		return nil, errors.New("not ready")
	}
	if m.PlayerAID == nil || m.PlayerBID == nil || *m.PlayerAID == "" || *m.PlayerBID == "" {
		return nil, errors.New("players missing")
	}
	if !force {
		if m.PlayerAReadyAt == nil || m.PlayerBReadyAt == nil {
			return nil, errors.New("not ready")
		}
	}
	if a.Games == nil || a.Settings == nil {
		return nil, errors.New("games unavailable")
	}
	rules := a.Settings.BoardRules()
	if rules.Source != "database" || rules.Size != engine.BoardSize || rules.SetupRows <= 0 || rules.Variant == "" {
		return nil, errors.New("board rules unavailable")
	}
	gameID := uuid.NewString()
	state, err := engine.InitialState("pvp", 0, rules.SetupRows, rules.Variant)
	if err != nil {
		return nil, err
	}
	p1, p2 := *m.PlayerAID, *m.PlayerBID
	state.Player1ID = &p1
	state.Player2ID = &p2
	publicVis := strings.TrimSpace(enums.HostedEventPublicVisibility)
	state.Rated = publicVis != "" && strings.EqualFold(strings.TrimSpace(ev.Visibility), publicVis) &&
		a.Flags != nil && a.Flags.Get(ctx).PublicEventMatchesRated
	stampMatchClockFromSettings(a.Settings, state, 0)
	if _, err := a.Games.Create(gameID, state); err != nil {
		return nil, err
	}
	WarmJoinQRPNG(a.Settings, gameID)
	updated, err := a.Events.AttachGame(ctx, m.ID, gameID, bst.Live)
	if err != nil {
		return nil, err
	}
	if a.emitPool() {
		notifications.EmitPlayer(ctx, a.DB.Pool, p1, notifications.KindPlayerEventMatchReady,
			"event_match_ready:"+m.ID+":"+p1, gameID, ev.Title)
		notifications.EmitPlayer(ctx, a.DB.Pool, p2, notifications.KindPlayerEventMatchReady,
			"event_match_ready:"+m.ID+":"+p2, gameID, ev.Title)
	}
	if a.Hub != nil {
		a.Hub.BroadcastToUsers([]string{p1, p2}, map[string]any{
			"type":       "match_found",
			"game_id":    gameID,
			"player1_id": p1,
			"player2_id": p2,
			"event_id":   ev.ID,
			"match_id":   m.ID,
		})
	}
	updated.StatusLabel = store.StatusLabel(enums.HostedEventBracketStatusLabels, updated.Status)
	return map[string]any{
		"match":      updated,
		"game_id":    gameID,
		"player1_id": p1,
		"player2_id": p2,
	}, nil
}
