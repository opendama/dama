package rest

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"

	"github.com/go-chi/chi/v5"
)

func voteStoreUnavailable(err error) bool {
	return err != nil && strings.Contains(err.Error(), "votes unavailable")
}

// VoteAPI handles spectator winner votes (DB-backed).
type VoteAPI struct {
	Votes       *store.VoteStore
	Users       *store.UserStore
	Games       *gamestore.Store
	Matches     *store.MatchHistoryStore
	Hub         *ws.Hub
	Settings    *store.SettingsStore
	Cash        *store.CashRmgStore
	CanSpectate func(ctx context.Context, userID, gameID string) bool
}

func (a *VoteAPI) allowVoteViewer(ctx context.Context, userID, gameID string) bool {
	if a.Games != nil {
		if rec, ok := a.Games.Get(gameID); ok && rec.State != nil {
			if rec.State.Player1ID != nil && *rec.State.Player1ID == userID {
				return true
			}
			if rec.State.Player2ID != nil && *rec.State.Player2ID == userID {
				return true
			}
		}
	}
	if a.CanSpectate == nil {
		return true
	}
	return a.CanSpectate(ctx, userID, gameID)
}

func (a *VoteAPI) requireVoteViewer(w http.ResponseWriter, r *http.Request, gameID string) bool {
	userID := auth.UserIDFromContext(r.Context())
	if a.allowVoteViewer(r.Context(), userID, gameID) {
		return true
	}
	writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
	return false
}

type castVoteRequest struct {
	VotedPlayerID string `json:"voted_player_id"`
}

// CastVote records the authenticated viewer's pick for a live game.
func (a *VoteAPI) CastVote(w http.ResponseWriter, r *http.Request) {
	if a.Votes == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voting unavailable"})
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}
	gameID := chi.URLParam(r, "id")
	if !a.requireVoteViewer(w, r, gameID) {
		return
	}
	var req castVoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	picked := req.VotedPlayerID
	if picked == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "voted_player_id required"})
		return
	}
	if a.Games != nil {
		rec, ok := a.Games.GetAuthoritative(gameID)
		if !ok || rec.State == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "game not found"})
			return
		}
		if engine.GameOutcome(rec.State) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "voting closed"})
			return
		}
		// Freeze casting while the board is paused (player or official; play_chrome keys).
		if rec.State.Paused {
			key := "err_game_paused"
			if strings.TrimSpace(rec.State.PauseKind) == engine.PauseKindOfficial {
				key = "err_officially_paused"
			}
			msg := ""
			if a.Settings != nil {
				msg = strings.TrimSpace(a.Settings.PlayChromeField(r.Context(), key))
			}
			writeJSON(w, http.StatusConflict, map[string]string{"error": msg, "error_key": key})
			return
		}
		p1, p2 := "", ""
		if rec.State.Player1ID != nil {
			p1 = *rec.State.Player1ID
		}
		if rec.State.Player2ID != nil {
			p2 = *rec.State.Player2ID
		}
		if picked != p1 && picked != p2 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid pick"})
			return
		}
		if userID == p1 || userID == p2 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "players cannot vote"})
			return
		}
	}
	if _, err := a.Votes.Cast(r.Context(), gameID, userID, picked); err != nil {
		if voteStoreUnavailable(err) {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voting unavailable"})
			return
		}
		writeClientError(w, http.StatusInternalServerError, "unable to cast vote")
		return
	}
	payload, err := a.votePayload(r, gameID, userID)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voting unavailable"})
		return
	}
	if a.Hub != nil {
		// Room broadcast is public tallies only - never fan out caster my_vote.
		publicPayload, pubErr := a.votePayload(r, gameID, "")
		if pubErr != nil {
			publicPayload = map[string]any{
				"game_id":     payload["game_id"],
				"total":       payload["total"],
				"players":     payload["players"],
				"my_vote":     nil,
				"has_my_vote": false,
			}
		}
		a.Hub.BroadcastGame(gameID, map[string]any{"type": "vote_update", "votes": publicPayload})
	}
	writeJSON(w, http.StatusOK, payload)
}

// GetVotes returns live tallies and percentages for a game.
func (a *VoteAPI) GetVotes(w http.ResponseWriter, r *http.Request) {
	if a.Votes == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voting unavailable"})
		return
	}
	gameID := chi.URLParam(r, "id")
	if !a.requireVoteViewer(w, r, gameID) {
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	payload, err := a.votePayload(r, gameID, userID)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voting unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// CorrectVoters returns up to 10 random voters who picked the match winner.
func (a *VoteAPI) CorrectVoters(w http.ResponseWriter, r *http.Request) {
	if a.Votes == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voting unavailable"})
		return
	}
	gameID := chi.URLParam(r, "id")
	if !a.requireVoteViewer(w, r, gameID) {
		return
	}
	winnerID := ""
	if a.Games != nil {
		if rec, ok := a.Games.Get(gameID); ok && rec.State != nil {
			if outcome := engine.GameOutcome(rec.State); outcome != nil && *outcome != engine.Draw {
				p1, p2 := "", ""
				if rec.State.Player1ID != nil {
					p1 = *rec.State.Player1ID
				}
				if rec.State.Player2ID != nil {
					p2 = *rec.State.Player2ID
				}
				switch *outcome {
				case engine.PlayerOne:
					winnerID = p1
				case engine.PlayerTwo:
					winnerID = p2
				}
			}
		}
	}
	if winnerID == "" && a.Matches != nil {
		if m, err := a.Matches.ByGameID(r.Context(), gameID); err == nil && m != nil && !m.IsDraw {
			winnerID = m.WinnerID
		}
	}
	if winnerID == "" {
		writeJSON(w, http.StatusOK, map[string]any{"voters": []any{}, "winner_id": ""})
		return
	}
	ids, err := a.Votes.CorrectVotersRandom(r.Context(), gameID, winnerID, 10)
	if err != nil {
		if voteStoreUnavailable(err) {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voting unavailable"})
			return
		}
		writeClientError(w, http.StatusInternalServerError, "unable to load voters")
		return
	}
	voters := make([]map[string]any, 0, len(ids))
	for _, id := range ids {
		if a.Users == nil {
			break
		}
		u, err := a.Users.GetByID(r.Context(), id)
		if err != nil || u == nil {
			continue
		}
		row := map[string]any{
			"id":       u.ID,
			"username": u.Username,
			"rating":   u.Rating,
			"wins":     u.Wins,
			"losses":   u.Losses,
			"draws":    u.Draws,
		}
		if u.AvatarThumbURL != nil {
			row["avatar_thumb_url"] = *u.AvatarThumbURL
		}
		if u.CountryCode != nil {
			row["country_code"] = *u.CountryCode
		}
		stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, row)
		voters = append(voters, row)
	}
	writeJSON(w, http.StatusOK, map[string]any{"voters": voters, "winner_id": winnerID})
}

func (a *VoteAPI) votePayload(r *http.Request, gameID, viewerID string) (map[string]any, error) {
	tallies, err := a.Votes.Tallies(r.Context(), gameID)
	if err != nil {
		return nil, err
	}
	total := 0
	for _, t := range tallies {
		total += t.Count
	}
	players := make([]map[string]any, 0, len(tallies))
	for _, t := range tallies {
		pct := 0.0
		if total > 0 {
			pct = float64(t.Count) * 100.0 / float64(total)
		}
		row := map[string]any{
			"player_id": t.PlayerID,
			"count":     t.Count,
			"percent":   pct,
		}
		if a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), t.PlayerID); err == nil && u != nil {
				row["username"] = u.Username
				if u.AvatarThumbURL != nil {
					row["avatar_thumb_url"] = *u.AvatarThumbURL
				}
				stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, row)
			}
		}
		players = append(players, row)
	}
	out := map[string]any{
		"game_id":     gameID,
		"total":       total,
		"players":     players,
		"my_vote":     nil,
		"has_my_vote": false,
	}
	if viewerID != "" {
		if picked, ok, myErr := a.Votes.MyVote(r.Context(), gameID, viewerID); myErr != nil {
			return nil, myErr
		} else if ok {
			out["my_vote"] = picked
			out["has_my_vote"] = true
		}
	}
	return out, nil
}
