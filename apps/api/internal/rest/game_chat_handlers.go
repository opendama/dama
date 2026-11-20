package rest

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/media"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"

	"github.com/go-chi/chi/v5"
)

type GameChatAPI struct {
	Chat        *store.GameChatStore
	Games       *gamestore.Store
	Users       *store.UserStore
	Media       *media.AvatarService
	Hub         *ws.Hub
	Settings    *store.SettingsStore
	CanSpectate func(ctx context.Context, userID, gameID string) bool
}

func (a *GameChatAPI) replyPreviewChrome(r *http.Request) store.DMPreviewOpts {
	opts := store.DMPreviewOpts{}
	if a.Settings == nil {
		return opts
	}
	raw, err := a.Settings.PlayRailChromeJSON(r.Context())
	if err != nil || len(raw) == 0 {
		return opts
	}
	var m map[string]any
	if json.Unmarshal(raw, &m) != nil {
		return opts
	}
	if v, ok := m["chat_reply_preview_max_chars"].(string); ok {
		if n, e := strconv.Atoi(strings.TrimSpace(v)); e == nil && n > 0 {
			opts.MaxChars = n
		}
	}
	if v, ok := m["dm_preview_truncate_suffix"].(string); ok && strings.TrimSpace(v) != "" {
		opts.Suffix = strings.TrimSpace(v)
	}
	if v, ok := m["dm_image_preview_label"].(string); ok {
		opts.ImageLabel = strings.TrimSpace(v)
	}
	return opts
}

func (a *GameChatAPI) isSeatedPlayer(gameID, userID string) bool {
	if a.Games == nil || userID == "" {
		return false
	}
	rec, ok := a.Games.Get(gameID)
	if !ok || rec == nil || rec.State == nil {
		return false
	}
	if rec.State.Player1ID != nil && *rec.State.Player1ID == userID {
		return true
	}
	if rec.State.Player2ID != nil && *rec.State.Player2ID == userID {
		return true
	}
	return false
}

// canPostChat: seated players or live WS joiners (game/spectate room) only.
// Private hosted-event cups also require CanSpectate (organizer / approved entry).
func (a *GameChatAPI) canPostChat(ctx context.Context, gameID, userID string) bool {
	if userID == "" || gameID == "" {
		return false
	}
	if a.isSeatedPlayer(gameID, userID) {
		return true
	}
	if a.CanSpectate != nil && !a.CanSpectate(ctx, userID, gameID) {
		return false
	}
	if a.Hub != nil && a.Hub.UserJoinedGame(gameID, userID) {
		return true
	}
	return false
}

func (a *GameChatAPI) List(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	gameID := strings.TrimSpace(chi.URLParam(r, "id"))
	if gameID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "game_id required"})
		return
	}
	// Joined users only (seat or live WS room) - no anonymous scrape by game UUID.
	if !a.canPostChat(r.Context(), gameID, uid) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "join_required"})
		return
	}
	enabled, err := a.Chat.IsEnabled(r.Context(), gameID)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "chat unavailable")
		return
	}
	msgs, err := a.Chat.List(r.Context(), gameID, 100, a.replyPreviewChrome(r))
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "chat unavailable")
		return
	}
	a.Chat.AttachReactions(r.Context(), msgs, uid)
	seenTotal := a.gameChatAudienceSize(r.Context(), gameID)
	a.Chat.AttachSeenCounts(r.Context(), msgs, seenTotal)
	unread, _ := a.Chat.CountUnreadForViewer(r.Context(), gameID, uid)
	seated := a.isSeatedPlayer(gameID, uid)
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":      enabled,
		"can_toggle":   seated,
		"can_post":     enabled && a.canPostChat(r.Context(), gameID, uid),
		"seen_total":   seenTotal,
		"unread_count": unread,
		"messages":     msgs,
	})
}

func (a *GameChatAPI) gameChatAudienceSize(ctx context.Context, gameID string) int {
	seen := map[string]struct{}{}
	add := func(id string) {
		id = strings.TrimSpace(id)
		if id == "" {
			return
		}
		seen[id] = struct{}{}
	}
	if a.Games != nil {
		if rec, ok := a.Games.Get(gameID); ok && rec != nil && rec.State != nil {
			if rec.State.Player1ID != nil {
				add(*rec.State.Player1ID)
			}
			if rec.State.Player2ID != nil {
				add(*rec.State.Player2ID)
			}
		}
	}
	if a.Hub != nil {
		for _, id := range a.Hub.JoinedUserIDs(gameID) {
			add(id)
		}
	}
	if n := a.Chat.DistinctReadersForGame(ctx, gameID); n > len(seen) {
		return n
	}
	return len(seen)
}

type gameChatPostBody struct {
	Body      string `json:"body"`
	ImageURL  string `json:"image_url"`
	ReplyToID string `json:"reply_to_id"`
	ClientID  string `json:"client_id"`
}

func (a *GameChatAPI) Post(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	gameID := strings.TrimSpace(chi.URLParam(r, "id"))
	if gameID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "game_id required"})
		return
	}
	enabled, err := a.Chat.IsEnabled(r.Context(), gameID)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "chat unavailable")
		return
	}
	if !enabled {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "chat_disabled"})
		return
	}
	if !a.canPostChat(r.Context(), gameID, uid) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "join_required"})
		return
	}
	var body gameChatPostBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	var bodyPtr, imgPtr, replyPtr *string
	if t := strings.TrimSpace(body.Body); t != "" {
		bodyPtr = &t
	}
	if t := strings.TrimSpace(body.ImageURL); t != "" {
		if a.Media == nil || !a.Media.IsAllowedChatImageURL(t) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid image_url"})
			return
		}
		imgPtr = &t
	}
	if t := strings.TrimSpace(body.ReplyToID); t != "" {
		replyPtr = &t
	}
	msg, err := a.Chat.Insert(
		r.Context(), gameID, uid, bodyPtr, imgPtr, replyPtr, strings.TrimSpace(body.ClientID), a.replyPreviewChrome(r),
	)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to send")
		return
	}
	if msg.Reactions == nil {
		msg.Reactions = []store.ChatReactionAgg{}
	}
	if a.Hub != nil {
		a.Hub.BroadcastGame(gameID, map[string]any{
			"type":    "game_chat_message",
			"game_id": gameID,
			"message": msg,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": msg})
}

type gameChatReactBody struct {
	Emoji string `json:"emoji"`
}

func (a *GameChatAPI) React(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	gameID := strings.TrimSpace(chi.URLParam(r, "id"))
	msgID := strings.TrimSpace(chi.URLParam(r, "messageId"))
	if gameID == "" || msgID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ids required"})
		return
	}
	if !a.canPostChat(r.Context(), gameID, uid) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "join_required"})
		return
	}
	var body gameChatReactBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	reactions, err := a.Chat.ToggleReaction(r.Context(), msgID, gameID, uid, body.Emoji)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to react")
		return
	}
	if a.Hub != nil {
		a.Hub.BroadcastGame(gameID, map[string]any{
			"type":       "game_chat_reaction",
			"game_id":    gameID,
			"message_id": msgID,
			"reactions":  reactions,
			"user_id":    uid,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message_id": msgID,
		"reactions":  reactions,
	})
}

type gameChatReadBody struct {
	MessageID string `json:"message_id"`
}

func (a *GameChatAPI) MarkRead(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	gameID := strings.TrimSpace(chi.URLParam(r, "id"))
	if gameID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "game_id required"})
		return
	}
	if !a.canPostChat(r.Context(), gameID, uid) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "join_required"})
		return
	}
	var body gameChatReadBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	n, err := a.Chat.MarkGameRead(r.Context(), gameID, uid, body.MessageID)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to mark read")
		return
	}
	seenTotal := a.gameChatAudienceSize(r.Context(), gameID)
	if a.Hub != nil {
		a.Hub.BroadcastGame(gameID, map[string]any{
			"type":       "game_chat_read",
			"game_id":    gameID,
			"user_id":    uid,
			"message_id": strings.TrimSpace(body.MessageID),
			"seen_total": seenTotal,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"marked":     n,
		"seen_total": seenTotal,
	})
}

type gameChatToggleBody struct {
	Enabled *bool `json:"enabled"`
}

func (a *GameChatAPI) Toggle(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	gameID := strings.TrimSpace(chi.URLParam(r, "id"))
	if gameID == "" || !a.isSeatedPlayer(gameID, uid) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "players_only"})
		return
	}
	var body gameChatToggleBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Enabled == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "enabled required"})
		return
	}
	if err := a.Chat.SetEnabled(r.Context(), gameID, uid, *body.Enabled); err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "chat unavailable")
		return
	}
	if a.Hub != nil {
		a.Hub.BroadcastGame(gameID, map[string]any{
			"type":    "game_chat_toggle",
			"game_id": gameID,
			"enabled": *body.Enabled,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"enabled": *body.Enabled})
}

func (a *GameChatAPI) UploadImage(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" || a.Media == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	gameID := strings.TrimSpace(chi.URLParam(r, "id"))
	if gameID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "game_id required"})
		return
	}
	enabled, err := a.Chat.IsEnabled(r.Context(), gameID)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "chat unavailable")
		return
	}
	if !enabled {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "chat_disabled"})
		return
	}
	if !a.canPostChat(r.Context(), gameID, uid) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "join_required"})
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeClientError(w, http.StatusBadRequest, "invalid upload")
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "file required")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 8<<20))
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "read failed")
		return
	}
	ct := hdr.Header.Get("Content-Type")
	url, err := a.Media.UploadChatImage(uid, hdr.Filename, ct, data)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "upload failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"image_url": url})
}
