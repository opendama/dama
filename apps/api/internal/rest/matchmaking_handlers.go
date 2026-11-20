package rest

import (
	"net/http"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/matchmaking"
	"dama/apps/api/internal/store"
)

type MatchmakingAPI struct {
	Queue *matchmaking.Queue
	Users *store.UserStore
	Cash  *store.CashRmgStore
}

func (a *MatchmakingAPI) Join(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromContext(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if claims.Role == "guest" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "sign in required"})
		return
	}
	user, err := a.Users.GetByID(r.Context(), claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	var trustTier, trustBadge string
	if a.Cash != nil && a.Cash.Ready() {
		trustTier, trustBadge = a.Cash.HostTrust(user.PhoneKycVerifiedAt != nil, user.DocumentKycVerifiedAt != nil)
	}
	ready, err := a.Queue.Enqueue(matchmaking.WaitingPlayer{
		UserID:         user.ID,
		Username:       user.Username,
		Rating:         user.Rating,
		AvatarThumbURL: user.AvatarThumbURL,
		CountryCode:    user.CountryCode,
		HostTrustTier:  trustTier,
		HostTrustBadge: trustBadge,
	})
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unable to join queue"})
		return
	}
	self := map[string]any{
		"id":               user.ID,
		"username":         user.Username,
		"rating":           user.Rating,
		"avatar_thumb_url": user.AvatarThumbURL,
		"country_code":     user.CountryCode,
	}
	stampHostTrustFields(a.Cash, user.PhoneKycVerifiedAt != nil, user.DocumentKycVerifiedAt != nil, self)
	out := map[string]any{
		"queued":     ready == nil,
		"queue_size": a.Queue.Size(),
		"self":       self,
	}
	if ready != nil {
		out["match"] = map[string]any{
			"game_id":    ready.GameID,
			"player1_id": ready.Player1ID,
			"player2_id": ready.Player2ID,
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *MatchmakingAPI) Leave(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromContext(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	a.Queue.Leave(claims.UserID)
	writeJSON(w, http.StatusOK, map[string]any{
		"left":       true,
		"queue_size": a.Queue.Size(),
	})
}

func (a *MatchmakingAPI) Status(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromContext(r.Context())
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	// Never list waiting players (user ids / usernames) to clients.
	writeJSON(w, http.StatusOK, map[string]any{
		"size":   a.Queue.Size(),
		"queued": a.Queue.Contains(claims.UserID),
	})
}
