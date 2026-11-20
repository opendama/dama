package rest

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/media"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/presence"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"

	"github.com/go-chi/chi/v5"
)

type DMAPI struct {
	DMs      *store.DMStore
	Users    *store.UserStore
	Settings *store.SettingsStore
	Presence *presence.Service
	Media    *media.AvatarService
	Hub      *ws.Hub
	Cash     *store.CashRmgStore
	DB       *db.Handle
}

func (a *DMAPI) playRailChromeMap(r *http.Request) map[string]any {
	if a.Settings == nil {
		return nil
	}
	raw, err := a.Settings.PlayRailChromeJSON(r.Context())
	if err != nil || len(raw) == 0 {
		return nil
	}
	var m map[string]any
	if json.Unmarshal(raw, &m) != nil {
		return nil
	}
	return m
}

func (a *DMAPI) previewChrome(r *http.Request) store.DMPreviewOpts {
	opts := store.DMPreviewOpts{}
	m := a.playRailChromeMap(r)
	if m == nil {
		return opts
	}
	if v, ok := m["dm_preview_max_chars"].(string); ok {
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

// replyPreviewChrome: quote truncation for in-thread replies (DB chrome only).
func (a *DMAPI) replyPreviewChrome(r *http.Request) store.DMPreviewOpts {
	opts := store.DMPreviewOpts{}
	m := a.playRailChromeMap(r)
	if m == nil {
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

func (a *DMAPI) playerCard(r *http.Request, id string) map[string]any {
	u, err := a.Users.GetByID(r.Context(), id)
	if err != nil || u == nil {
		return map[string]any{"id": id}
	}
	row := map[string]any{
		"id":               u.ID,
		"username":         u.Username,
		"rating":           u.Rating,
		"avatar_thumb_url": u.AvatarThumbURL,
		"avatar_full_url":  u.AvatarFullURL,
		"country_code":     u.CountryCode,
		"online":           false,
	}
	if a.Presence != nil {
		row["online"] = a.Presence.Online(r.Context(), id)
	}
	stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, row)
	return row
}

func (a *DMAPI) ListRequests(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	preview := a.previewChrome(r)
	enrichOne := func(req store.DMRequest) map[string]any {
		other := req.FromUserID
		if req.Side == "out" {
			other = req.ToUserID
		}
		row := map[string]any{
			"id":           req.ID,
			"status":       req.Status,
			"side":         req.Side,
			"preview":      req.Preview,
			"body":         req.Body,
			"image_url":    req.ImageURL,
			"thread_id":    req.ThreadID,
			"created_at":   req.CreatedAt,
			"unread_count": req.UnreadCount,
			"player":       a.playerCard(r, other),
		}
		if req.LastMessageAt != nil {
			row["last_message_at"] = *req.LastMessageAt
		}
		return row
	}
	// Full pending count (not capped by list LIMIT) - friend-request badge parity.
	pending, err := a.DMs.CountPendingIncoming(r.Context(), uid)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	unreadTotal, err := a.DMs.CountUnreadMessages(r.Context(), uid)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	// Rail tab: Trim skip/limit infinite scroll.
	if r.URL.Query().Get("skip") != "" && r.URL.Query().Get("limit") != "" {
		params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
		if !ok {
			return
		}
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		list, total, err := a.DMs.ListRequestsPaged(r.Context(), uid, params.Skip, params.Limit, preview, q)
		if err != nil {
			writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
			return
		}
		out := make([]map[string]any, 0, len(list))
		for _, req := range list {
			out = append(out, enrichOne(req))
		}
		meta := pagination.BuildMeta(params, total, skipCap, labels)
		writeJSON(w, http.StatusOK, map[string]any{
			"requests":         out,
			"meta":             meta,
			"pending_incoming": pending,
			"unread_total":     unreadTotal,
		})
		return
	}
	incoming, outgoing, err := a.DMs.ListRequests(r.Context(), uid, preview)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	enrich := func(list []store.DMRequest) []map[string]any {
		out := make([]map[string]any, 0, len(list))
		for _, req := range list {
			out = append(out, enrichOne(req))
		}
		return out
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"incoming":         enrich(incoming),
		"outgoing":         enrich(outgoing),
		"pending_incoming": pending,
		"unread_total":     unreadTotal,
	})
}

type dmSendBody struct {
	ToUserID  string `json:"to_user_id"`
	Body      string `json:"body"`
	ImageURL  string `json:"image_url"`
	ReplyToID string `json:"reply_to_id"`
	ThreadID  string `json:"thread_id"`
	ClientID  string `json:"client_id"`
}

func (a *DMAPI) Send(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	var body dmSendBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	toID := strings.TrimSpace(body.ToUserID)
	threadID := strings.TrimSpace(body.ThreadID)

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

	// First message to a user: open a DM request, unless an accepted thread already exists.
	if threadID == "" && toID != "" {
		if toID == uid {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid recipient"})
			return
		}
		u, err := a.Users.GetByID(r.Context(), toID)
		if err != nil || u == nil || !u.IsActive {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "player not found"})
			return
		}
		if existing, e := a.DMs.AcceptedThreadForUsers(r.Context(), uid, toID); e == nil && existing != "" {
			threadID = existing
		} else {
			preview := a.previewChrome(r)
			clientID := strings.TrimSpace(body.ClientID)
			req, created, err := a.DMs.CreateRequest(r.Context(), uid, toID, bodyPtr, imgPtr, clientID, preview)
			if err != nil {
				writeClientError(w, http.StatusBadRequest, "unable to send")
				return
			}
			if created {
				fromName := ""
				if me, e := a.Users.GetByID(r.Context(), uid); e == nil && me != nil {
					fromName = me.Username
				}
				if a.DB != nil && a.DB.Ready() {
					notifications.EmitPlayer(r.Context(), a.DB.Pool, toID, notifications.KindPlayerDMRequest,
						"dm_request:"+req.ID, req.ID, fromName)
				}
				if a.Hub != nil {
					a.Hub.BroadcastToUsers([]string{toID}, map[string]any{
						"type":    "dm_request",
						"request": req,
					})
				}
			}
			resp := map[string]any{"request": req, "thread_id": req.ThreadID}
			// Echo the request seed message (incl. client_id) so outbox can commit without a second round-trip.
			if clientID != "" && req.ThreadID != nil && strings.TrimSpace(*req.ThreadID) != "" {
				if msg, e := a.DMs.MessageByClientID(
					r.Context(), strings.TrimSpace(*req.ThreadID), uid, clientID, a.replyPreviewChrome(r),
				); e == nil && msg != nil {
					msg.Receipt = store.ReceiptSent
					resp["message"] = msg
				}
			}
			writeJSON(w, http.StatusOK, resp)
			return
		}
	}

	if threadID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "thread_id or to_user_id required"})
		return
	}
	ok, err := a.DMs.UserInThread(r.Context(), threadID, uid)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	if !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	accepted, err := a.DMs.ThreadIsAccepted(r.Context(), threadID)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	if !accepted {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "dm_not_accepted"})
		return
	}
	msg, err := a.DMs.InsertMessage(
		r.Context(), threadID, uid, bodyPtr, imgPtr, replyPtr, strings.TrimSpace(body.ClientID), a.replyPreviewChrome(r),
	)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to send")
		return
	}
	// Author always sees sent ticks on create (list-time AttachDMReceipts may upgrade later).
	msg.Receipt = store.ReceiptSent
	otherID, _ := a.DMs.OtherUserInThread(r.Context(), threadID, uid)
	fromName := ""
	if me, e := a.Users.GetByID(r.Context(), uid); e == nil && me != nil {
		fromName = me.Username
	}
	if otherID != "" && a.DB != nil && a.DB.Ready() {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, otherID, notifications.KindPlayerDMMessage,
			"dm_message:"+msg.ID, threadID, fromName)
	}
	if otherID != "" && a.Hub != nil {
		a.Hub.BroadcastToUsers([]string{otherID, uid}, map[string]any{
			"type":      "dm_message",
			"thread_id": threadID,
			"message":   msg,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": msg})
}

func (a *DMAPI) Accept(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	req, err := a.DMs.Accept(r.Context(), id, uid)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to accept")
		return
	}
	fromName := ""
	if me, e := a.Users.GetByID(r.Context(), uid); e == nil && me != nil {
		fromName = me.Username
	}
	if a.DB != nil && a.DB.Ready() {
		_ = notifications.MarkReadByDedupe(r.Context(), a.DB.Pool, uid, notifications.AudiencePlayer,
			"dm_request:"+req.ID)
		notifications.EmitPlayer(r.Context(), a.DB.Pool, req.FromUserID, notifications.KindPlayerDMRequestAccepted,
			"dm_request_accepted:"+req.ID, req.ID, fromName)
	}
	if a.Hub != nil {
		a.Hub.BroadcastToUsers([]string{req.FromUserID, uid}, map[string]any{
			"type":    "dm_request_updated",
			"request": req,
			"action":  "accepted",
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"request": req})
}

func (a *DMAPI) Deny(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	req, err := a.DMs.Deny(r.Context(), id, uid)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to deny")
		return
	}
	fromName := ""
	if me, e := a.Users.GetByID(r.Context(), uid); e == nil && me != nil {
		fromName = me.Username
	}
	if a.DB != nil && a.DB.Ready() {
		_ = notifications.MarkReadByDedupe(r.Context(), a.DB.Pool, uid, notifications.AudiencePlayer,
			"dm_request:"+req.ID)
		notifications.EmitPlayer(r.Context(), a.DB.Pool, req.FromUserID, notifications.KindPlayerDMRequestDenied,
			"dm_request_denied:"+req.ID, uid, fromName)
	}
	if a.Hub != nil {
		a.Hub.BroadcastToUsers([]string{req.FromUserID, uid}, map[string]any{
			"type":    "dm_request_updated",
			"request": req,
			"action":  "denied",
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"request": req})
}

func (a *DMAPI) Cancel(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	req, err := a.DMs.Cancel(r.Context(), id, uid)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to cancel")
		return
	}
	fromName := ""
	if me, e := a.Users.GetByID(r.Context(), uid); e == nil && me != nil {
		fromName = me.Username
	}
	if a.DB != nil && a.DB.Ready() {
		_ = notifications.MarkReadByDedupe(r.Context(), a.DB.Pool, req.ToUserID, notifications.AudiencePlayer,
			"dm_request:"+req.ID)
		notifications.EmitPlayer(r.Context(), a.DB.Pool, req.ToUserID, notifications.KindPlayerDMRequestCancelled,
			"dm_request_cancelled:"+req.ID, uid, fromName)
	}
	if a.Hub != nil {
		a.Hub.BroadcastToUsers([]string{req.ToUserID, uid}, map[string]any{
			"type":    "dm_request_updated",
			"request": req,
			"action":  "cancelled",
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"request": req})
}

func (a *DMAPI) ListMessages(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	threadID := strings.TrimSpace(chi.URLParam(r, "id"))
	ok, err := a.DMs.UserInThread(r.Context(), threadID, uid)
	if err != nil {
		// DB/pool blips must not look like "forbidden" to clients (maps to load-failed UI).
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	if !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	preview := a.replyPreviewChrome(r)
	if r.URL.Query().Get("skip") != "" && r.URL.Query().Get("limit") != "" {
		params, labels, skipCap, okPag := parseListPagination(w, r, a.Settings)
		if !okPag {
			return
		}
		msgs, total, err := a.DMs.ListMessagesPaged(r.Context(), threadID, params.Skip, params.Limit, preview)
		if err != nil {
			writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
			return
		}
		a.DMs.AttachReactions(r.Context(), msgs, uid)
		a.DMs.AttachDMReceipts(r.Context(), msgs, threadID, uid)
		meta := pagination.BuildMeta(params, total, skipCap, labels)
		writeJSON(w, http.StatusOK, map[string]any{"messages": msgs, "thread_id": threadID, "meta": meta})
		return
	}
	msgs, err := a.DMs.ListMessages(r.Context(), threadID, 100, preview)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	a.DMs.AttachReactions(r.Context(), msgs, uid)
	a.DMs.AttachDMReceipts(r.Context(), msgs, threadID, uid)
	writeJSON(w, http.StatusOK, map[string]any{"messages": msgs, "thread_id": threadID})
}

type dmReactBody struct {
	Emoji string `json:"emoji"`
}

func (a *DMAPI) React(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	threadID := strings.TrimSpace(chi.URLParam(r, "id"))
	msgID := strings.TrimSpace(chi.URLParam(r, "messageId"))
	ok, err := a.DMs.UserInThread(r.Context(), threadID, uid)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	if !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	var body dmReactBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	reactions, err := a.DMs.ToggleReaction(r.Context(), msgID, threadID, uid, body.Emoji)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to react")
		return
	}
	if a.Hub != nil {
		otherID, _ := a.DMs.OtherUserInThread(r.Context(), threadID, uid)
		targets := []string{uid}
		if otherID != "" {
			targets = append(targets, otherID)
		}
		a.Hub.BroadcastToUsers(targets, map[string]any{
			"type":       "dm_reaction",
			"thread_id":  threadID,
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

type dmReadBody struct {
	MessageID string `json:"message_id"`
}

func (a *DMAPI) MarkRead(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	threadID := strings.TrimSpace(chi.URLParam(r, "id"))
	ok, err := a.DMs.UserInThread(r.Context(), threadID, uid)
	if err != nil {
		writeClientError(w, http.StatusServiceUnavailable, "dms unavailable")
		return
	}
	if !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	var body dmReadBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	if err := a.DMs.MarkThreadRead(r.Context(), threadID, uid, body.MessageID); err != nil {
		writeClientError(w, http.StatusBadRequest, "unable to mark read")
		return
	}
	if a.Hub != nil {
		otherID, _ := a.DMs.OtherUserInThread(r.Context(), threadID, uid)
		targets := []string{uid}
		if otherID != "" {
			targets = append(targets, otherID)
		}
		a.Hub.BroadcastToUsers(targets, map[string]any{
			"type":       "dm_read",
			"thread_id":  threadID,
			"user_id":    uid,
			"message_id": strings.TrimSpace(body.MessageID),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *DMAPI) GetRequest(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	preview := a.previewChrome(r)
	req, err := a.DMs.GetRequest(r.Context(), id, preview)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if req.FromUserID != uid && req.ToUserID != uid {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	other := req.FromUserID
	if other == uid {
		other = req.ToUserID
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"request": req,
		"player":  a.playerCard(r, other),
	})
}

func (a *DMAPI) UploadImage(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" || a.Media == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
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
