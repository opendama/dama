package rest

import (
	"encoding/json"
	"errors"
	"net/http"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/invites"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

type InviteAPI struct {
	Invites  *invites.Service
	Settings *store.SettingsStore
}

type createInviteBody struct {
	ToUser             string `json:"to_user"`
	Rated              *bool  `json:"rated"`
	PreferredColor     string `json:"preferred_color"`
	TimeControlSeconds int    `json:"time_control_seconds"`
	OpenLink           bool   `json:"open_link"`
}

func (a *InviteAPI) Create(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	var body createInviteBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if !body.OpenLink && body.ToUser == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to_user required"})
		return
	}
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "time controls unavailable"})
		return
	}
	clock := a.Settings.MatchClock()
	if clock.Source != "database" || len(clock.Presets) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "time controls unavailable"})
		return
	}
	allowed := false
	for _, p := range clock.Presets {
		if p.Seconds == body.TimeControlSeconds && p.Seconds > 0 {
			allowed = true
			break
		}
	}
	if !allowed {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "time_control_seconds must match match_clock.presets"})
		return
	}
	// Fail-closed: clients must send rated + preferred_color (no invent defaults).
	if body.Rated == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "rated required"})
		return
	}
	color := body.PreferredColor
	switch color {
	case "white", "black", "random":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "preferred_color must be white, black, or random"})
		return
	}
	inv, err := a.Invites.Create(r.Context(), uid, body.ToUser, invites.CreateOptions{
		Rated:              *body.Rated,
		PreferredColor:     color,
		TimeControlSeconds: body.TimeControlSeconds,
		OpenLink:           body.OpenLink,
	})
	if err != nil {
		if errors.Is(err, invites.ErrCannotInviteYourself) {
			msg := inviteChromeString(a.Settings, r.Context(), "toast_invite_yourself")
			if msg == "" {
				writeClientError(w, http.StatusServiceUnavailable, "play rail chrome unavailable")
				return
			}
			writeClientError(w, http.StatusBadRequest, msg)
			return
		}
		writeClientError(w, http.StatusBadRequest, "unable to create invite")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"invite": inv})
}

func (a *InviteAPI) Accept(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	inv, ready, err := a.Invites.Accept(r.Context(), id, uid)
	if err != nil {
		writeClientError(w, http.StatusConflict, "unable to accept invite")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"invite": inv,
		"match": map[string]any{
			"game_id":    ready.GameID,
			"player1_id": ready.Player1ID,
			"player2_id": ready.Player2ID,
		},
	})
}

func (a *InviteAPI) AcceptByToken(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	token := chi.URLParam(r, "token")
	inv, ready, err := a.Invites.AcceptByToken(r.Context(), token, uid)
	if err != nil {
		writeClientError(w, http.StatusConflict, "unable to accept challenge link")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"invite": inv,
		"match": map[string]any{
			"game_id":    ready.GameID,
			"player1_id": ready.Player1ID,
			"player2_id": ready.Player2ID,
		},
	})
}

func (a *InviteAPI) Decline(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	inv, err := a.Invites.Decline(r.Context(), id, uid)
	if err != nil {
		writeClientError(w, http.StatusConflict, "unable to decline invite")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invite": inv})
}

func (a *InviteAPI) ListPending(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	list, err := a.Invites.ListPendingFor(r.Context(), uid)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "unable to load invites")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invites": list})
}

// Get returns one invite for a participant (from or to). Used by outgoing wait
// reconcile when invite_accepted WS is missed (challenge-link flow).
func (a *InviteAPI) Get(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	inv, err := a.Invites.GetForParticipant(r.Context(), id, uid)
	if err != nil {
		writeClientError(w, http.StatusNotFound, "invite not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invite": inv})
}
