package rest

import (
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/presence"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

type FriendsAPI struct {
	Friends  *store.FriendsStore
	Users    *store.UserStore
	Settings *store.SettingsStore
	Presence *presence.Service
	Games    *gamestore.Store
	Cash     *store.CashRmgStore
	DB       *db.Handle
}

func (a *FriendsAPI) playerRow(r *http.Request, id string) (map[string]any, bool) {
	u, err := a.Users.GetByID(r.Context(), id)
	if err != nil || !u.IsActive {
		return nil, false
	}
	if a.Settings != nil && a.Settings.IsConsoleRole(u.Role) {
		return nil, false
	}
	row := map[string]any{
		"id":               u.ID,
		"username":         u.Username,
		"rating":           u.Rating,
		"xp":               u.XP,
		"wins":             u.Wins,
		"losses":           u.Losses,
		"draws":            u.Draws,
		"region":           u.Region,
		"country_code":     u.CountryCode,
		"avatar_thumb_url": u.AvatarThumbURL,
		"avatar_full_url":  u.AvatarFullURL,
		"online":           false,
		"playing":          false,
	}
	if a.Presence != nil {
		row["online"] = a.Presence.Online(r.Context(), id)
	}
	if a.Games != nil {
		if gid, ok := a.Games.PlayingGameID(id); ok {
			row["playing"] = true
			row["playing_game_id"] = gid
		}
	}
	if a.Settings != nil {
		if label := a.Settings.LevelLabelForXP(u.XP); label != "" {
			row["level_label"] = label
		}
	}
	stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, row)
	return row, true
}

func (a *FriendsAPI) List(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	// Membership callers omit skip/limit and need the full id set hydrated.
	// Rail friends tab sends Trim skip/limit for infinite scroll pages.
	if r.URL.Query().Get("skip") == "" || r.URL.Query().Get("limit") == "" {
		ids, err := a.Friends.ListFriendIDs(r.Context(), uid)
		if err != nil {
			writeClientError(w, http.StatusServiceUnavailable, "unable to load friends")
			return
		}
		out := make([]map[string]any, 0, len(ids))
		for _, id := range ids {
			if row, ok := a.playerRow(r, id); ok {
				out = append(out, row)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"friends": out})
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	ids, total, err := a.Friends.ListFriendIDsPaged(r.Context(), uid, params.Skip, params.Limit, q)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "unable to load friends")
		return
	}
	out := make([]map[string]any, 0, len(ids))
	for _, id := range ids {
		if row, ok := a.playerRow(r, id); ok {
			out = append(out, row)
		}
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"friends": out, "meta": meta})
}

// Add creates a pending friend request (no longer instant friendship).
func (a *FriendsAPI) Add(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	friendID := chi.URLParam(r, "id")
	if friendID == "" || friendID == uid {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid friend"})
		return
	}
	u, err := a.Users.GetByID(r.Context(), friendID)
	if err != nil || !u.IsActive {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "player not found"})
		return
	}
	if a.Settings != nil && a.Settings.IsConsoleRole(u.Role) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "player not found"})
		return
	}
	fr, err := a.Friends.CreateRequest(r.Context(), uid, friendID)
	if err != nil {
		if err.Error() == "already friends" {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "already_friends"})
			return
		}
		writeClientError(w, http.StatusBadRequest, "unable to send friend request")
		return
	}
	if a.DB != nil && a.DB.Ready() {
		fromName := uid
		if me, err := a.Users.GetByID(r.Context(), uid); err == nil && me != nil {
			fromName = me.Username
		}
		notifications.EmitPlayer(r.Context(), a.DB.Pool, friendID, notifications.KindPlayerFriendRequest,
			"friend_request:"+fr.ID, uid, fromName)
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true, "request": fr})
}

func (a *FriendsAPI) ListRequests(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	// Rail tab sends Trim skip/limit for infinite scroll; membership/badge omit them.
	if r.URL.Query().Get("skip") != "" && r.URL.Query().Get("limit") != "" {
		params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
		if !ok {
			return
		}
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		list, total, err := a.Friends.ListRequestsPaged(r.Context(), uid, params.Skip, params.Limit, q)
		if err != nil {
			writeClientError(w, http.StatusServiceUnavailable, "unable to load friend requests")
			return
		}
		out := make([]map[string]any, 0, len(list))
		for _, fr := range list {
			side := "out"
			peerID := fr.ToUserID
			if fr.ToUserID == uid {
				side = "in"
				peerID = fr.FromUserID
			}
			row := map[string]any{
				"id":           fr.ID,
				"status":       fr.Status,
				"side":         side,
				"from_user_id": fr.FromUserID,
				"to_user_id":   fr.ToUserID,
				"created_at":   fr.CreatedAt,
				"updated_at":   fr.UpdatedAt,
			}
			if peer, ok := a.playerRow(r, peerID); ok {
				row["player"] = peer
			}
			out = append(out, row)
		}
		meta := pagination.BuildMeta(params, total, skipCap, labels)
		writeJSON(w, http.StatusOK, map[string]any{"requests": out, "meta": meta})
		return
	}
	incoming, outgoing, err := a.Friends.ListRequestsForUser(r.Context(), uid)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "unable to load friend requests")
		return
	}
	mapSide := func(list []store.FriendRequest, peerFrom bool) []map[string]any {
		out := make([]map[string]any, 0, len(list))
		for _, fr := range list {
			peerID := fr.FromUserID
			if !peerFrom {
				peerID = fr.ToUserID
			}
			row := map[string]any{
				"id":           fr.ID,
				"status":       fr.Status,
				"from_user_id": fr.FromUserID,
				"to_user_id":   fr.ToUserID,
				"created_at":   fr.CreatedAt,
				"updated_at":   fr.UpdatedAt,
			}
			if peer, ok := a.playerRow(r, peerID); ok {
				row["player"] = peer
			}
			out = append(out, row)
		}
		return out
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"incoming": mapSide(incoming, true),
		"outgoing": mapSide(outgoing, false),
	})
}

func (a *FriendsAPI) AcceptRequest(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	requestID := chi.URLParam(r, "id")
	fr, err := a.Friends.GetRequest(r.Context(), requestID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "request not found"})
		return
	}
	if err := a.Friends.AcceptRequest(r.Context(), requestID, uid); err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to accept friend request")
		return
	}
	if a.DB != nil && a.DB.Ready() {
		// Clear the recipient's pending "friend request" row so unread stays accurate.
		_ = notifications.MarkReadByDedupe(r.Context(), a.DB.Pool, fr.ToUserID, notifications.AudiencePlayer,
			"friend_request:"+requestID)
		fromName := uid
		if me, err := a.Users.GetByID(r.Context(), uid); err == nil && me != nil {
			fromName = me.Username
		}
		notifications.EmitPlayer(r.Context(), a.DB.Pool, fr.FromUserID, notifications.KindPlayerFriendRequestAccepted,
			"friend_request_accepted:"+requestID, uid, fromName)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *FriendsAPI) DenyRequest(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	requestID := chi.URLParam(r, "id")
	fr, err := a.Friends.GetRequest(r.Context(), requestID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "request not found"})
		return
	}
	if err := a.Friends.DenyRequest(r.Context(), requestID, uid); err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to deny friend request")
		return
	}
	if a.DB != nil && a.DB.Ready() {
		_ = notifications.MarkReadByDedupe(r.Context(), a.DB.Pool, fr.ToUserID, notifications.AudiencePlayer,
			"friend_request:"+requestID)
		fromName := uid
		if me, err := a.Users.GetByID(r.Context(), uid); err == nil && me != nil {
			fromName = me.Username
		}
		notifications.EmitPlayer(r.Context(), a.DB.Pool, fr.FromUserID, notifications.KindPlayerFriendRequestDenied,
			"friend_request_denied:"+requestID, uid, fromName)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *FriendsAPI) CancelRequest(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	requestID := chi.URLParam(r, "id")
	fr, err := a.Friends.GetRequest(r.Context(), requestID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "request not found"})
		return
	}
	if err := a.Friends.CancelRequest(r.Context(), requestID, uid); err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to cancel friend request")
		return
	}
	if a.DB != nil && a.DB.Ready() {
		_ = notifications.MarkReadByDedupe(r.Context(), a.DB.Pool, fr.ToUserID, notifications.AudiencePlayer,
			"friend_request:"+requestID)
		fromName := uid
		if me, err := a.Users.GetByID(r.Context(), uid); err == nil && me != nil {
			fromName = me.Username
		}
		notifications.EmitPlayer(r.Context(), a.DB.Pool, fr.ToUserID, notifications.KindPlayerFriendRequestCancelled,
			"friend_request_cancelled:"+requestID, uid, fromName)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *FriendsAPI) Remove(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	friendID := chi.URLParam(r, "id")
	if err := a.Friends.Remove(r.Context(), uid, friendID); err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to remove friend")
		return
	}
	// Also remove reverse edge when present.
	_ = a.Friends.Remove(r.Context(), friendID, uid)
	if a.DB != nil && a.DB.Ready() {
		fromName := uid
		if me, err := a.Users.GetByID(r.Context(), uid); err == nil && me != nil {
			fromName = me.Username
		}
		notifications.EmitPlayer(r.Context(), a.DB.Pool, friendID, notifications.KindPlayerFriendRemoved,
			"friend_removed:"+uid+":"+friendID, uid, fromName)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
