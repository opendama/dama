package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/redisx"

	"github.com/gorilla/websocket"
)

type clientMeta struct {
	GameID  string
	UserID  string
	Role    string
	Room    string // "game" | "matchmaking" | "spectate"
	writeMu *sync.Mutex // one writer per conn (gorilla/websocket requirement)
}

// wsPauseAwareError attaches error_key for pause reject sentinels (clients map DB chrome).
// Pause rejects leave error empty (REST writePlayPausedErr parity); never ship sentinel English.
func wsPauseAwareError(err error) map[string]any {
	msg := ""
	if err != nil {
		msg = err.Error()
	}
	out := map[string]any{"type": "error", "error": msg}
	switch msg {
	case "officially paused":
		out["error"] = ""
		out["error_key"] = "err_officially_paused"
	case "game is paused":
		out["error"] = ""
		out["error_key"] = "err_game_paused"
	}
	return out
}

// MoveHandler applies a board move over the raw game WebSocket (primary move ingress).
type MoveHandler func(ctx context.Context, gameID, userID string, from, to [2]int) (map[string]any, error)

// ClockFlagHandler claims flag-fall when a seat's authoritative clock hits zero.
type ClockFlagHandler func(ctx context.Context, gameID, userID string) (map[string]any, error)

// InviteActionHandler handles accept/decline over the matchmaking WebSocket.
type InviteActionHandler func(ctx context.Context, userID, inviteID, action string) (map[string]any, error)

// SpectateAuthz returns false when the viewer must not open a spectate room (e.g. private event cup).
type SpectateAuthz func(ctx context.Context, userID, gameID string) bool

type Hub struct {
	mu             sync.RWMutex
	clients        map[*websocket.Conn]clientMeta
	tokens         *auth.TokenService
	rdb            *redisx.Client
	originID       string
	allowedOrigins map[string]struct{}
	upgrader       websocket.Upgrader
	onMove         MoveHandler
	onClockFlag    ClockFlagHandler
	onInvite       InviteActionHandler
	spectateAuthz  SpectateAuthz
	flagsSnapshot  func() map[string]any
}

func (h *Hub) SetMoveHandler(fn MoveHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onMove = fn
}

func (h *Hub) SetClockFlagHandler(fn ClockFlagHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onClockFlag = fn
}

func (h *Hub) SetInviteHandler(fn InviteActionHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onInvite = fn
}

// SetSpectateAuthz gates spectate WS upgrades (private hosted-event cups).
func (h *Hub) SetSpectateAuthz(fn SpectateAuthz) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.spectateAuthz = fn
}

// SetFlagsSnapshot supplies a feature-flags payload included on every WS welcome.
func (h *Hub) SetFlagsSnapshot(fn func() map[string]any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.flagsSnapshot = fn
}

func NewHub(tokens *auth.TokenService, allowedOrigins []string) *Hub {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		if o = strings.TrimSpace(o); o != "" {
			allowed[o] = struct{}{}
		}
	}
	h := &Hub{
		clients:        make(map[*websocket.Conn]clientMeta),
		tokens:         tokens,
		allowedOrigins: allowed,
	}
	h.upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			if origin == "" {
				// Native / non-browser clients often omit Origin.
				return true
			}
			if len(h.allowedOrigins) == 0 {
				return false
			}
			_, ok := h.allowedOrigins[origin]
			return ok
		},
	}
	return h
}

func (h *Hub) HandleGame(w http.ResponseWriter, r *http.Request) {
	h.handle(w, r, "game", true)
}

func (h *Hub) HandleMatchmaking(w http.ResponseWriter, r *http.Request) {
	h.handle(w, r, "matchmaking", true)
}

func (h *Hub) HandleSpectate(w http.ResponseWriter, r *http.Request) {
	h.handle(w, r, "spectate", false)
}

func (h *Hub) handle(w http.ResponseWriter, r *http.Request, room string, requireAuth bool) {
	userID := ""
	role := ""
	if token := r.URL.Query().Get("token"); token != "" && h.tokens != nil {
		claims, err := h.tokens.Parse(token)
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		userID = claims.UserID
		role = claims.Role
	}
	if requireAuth && userID == "" {
		http.Error(w, `{"error":"token required for this room"}`, http.StatusUnauthorized)
		return
	}
	if room == "matchmaking" && role == "guest" {
		http.Error(w, `{"error":"sign in required"}`, http.StatusForbidden)
		return
	}

	gameID := r.URL.Query().Get("game_id")
	if room == "spectate" && gameID == "" {
		http.Error(w, `{"error":"game_id required for spectate"}`, http.StatusBadRequest)
		return
	}
	if room == "game" && gameID == "" {
		http.Error(w, `{"error":"game_id required for game room"}`, http.StatusBadRequest)
		return
	}
	if room == "spectate" {
		h.mu.RLock()
		authz := h.spectateAuthz
		h.mu.RUnlock()
		if authz != nil && !authz(r.Context(), userID, gameID) {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}

	h.mu.Lock()
	h.clients[conn] = clientMeta{
		GameID:  gameID,
		UserID:  userID,
		Role:    role,
		Room:    room,
		writeMu: &sync.Mutex{},
	}
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.clients, conn)
		h.mu.Unlock()
		_ = conn.Close()
	}()

	welcome := map[string]any{
		"type":    "welcome",
		"room":    room,
		"game_id": gameID,
		"user_id": userID,
		"auth":    userID != "",
	}
	h.mu.RLock()
	snapFn := h.flagsSnapshot
	h.mu.RUnlock()
	if snapFn != nil {
		if flags := snapFn(); flags != nil {
			welcome["feature_flags"] = flags
		}
	}
	_ = h.writeJSON(conn, welcome)

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		if string(msg) == "ping" {
			_ = h.writeJSON(conn, map[string]any{"type": "pong"})
			continue
		}
		var payload map[string]any
		if err := json.Unmarshal(msg, &payload); err != nil {
			continue
		}
		msgType, _ := payload["type"].(string)
		switch msgType {
		case "join":
			if gid, ok := payload["game_id"].(string); ok && gid != "" {
				if room == "spectate" {
					h.mu.RLock()
					authz := h.spectateAuthz
					h.mu.RUnlock()
					if authz != nil && !authz(r.Context(), userID, gid) {
						_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "forbidden"})
						continue
					}
				}
				h.mu.Lock()
				meta := h.clients[conn]
				meta.GameID = gid
				h.clients[conn] = meta
				h.mu.Unlock()
				_ = h.writeJSON(conn, map[string]any{"type": "joined", "game_id": gid, "room": room})
			}
		case "move":
			if room != "game" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "moves only on game room"})
				continue
			}
			h.mu.RLock()
			meta := h.clients[conn]
			handler := h.onMove
			h.mu.RUnlock()
			if handler == nil {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "move handler unavailable"})
				continue
			}
			gid, gidErr := resolveJoinedGameID(meta.GameID, payload)
			if gidErr != "" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": gidErr})
				continue
			}
			if gid == "" || meta.UserID == "" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "game_id and auth required"})
				continue
			}
			from, to, ok := parseCoordPair(payload)
			if !ok {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "from and to required"})
				continue
			}
			moveCtx := context.Background()
			if meta.UserID != "" {
				moveCtx = context.WithValue(moveCtx, auth.ClaimsKey, &auth.Claims{
					UserID:   meta.UserID,
					Role:     meta.Role,
					Username: "",
				})
				moveCtx = context.WithValue(moveCtx, auth.UserIDKey, meta.UserID)
			}
			// Run off the read loop so pings stay alive while ApplyMoveCore (incl. AI) works.
			go func(ctx context.Context, gameID, uid string, fromC, toC [2]int) {
				result, err := handler(ctx, gameID, uid, fromC, toC)
				if err != nil {
					_ = h.writeJSON(conn, wsPauseAwareError(err))
					return
				}
				_ = h.writeJSON(conn, map[string]any{"type": "move_ack", "game": result})
			}(moveCtx, gid, meta.UserID, from, to)
		case "clock_flag":
			if room != "game" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "clock flag only on game room"})
				continue
			}
			h.mu.RLock()
			meta := h.clients[conn]
			handler := h.onClockFlag
			h.mu.RUnlock()
			if handler == nil {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "clock flag handler unavailable"})
				continue
			}
			gid, gidErr := resolveJoinedGameID(meta.GameID, payload)
			if gidErr != "" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": gidErr})
				continue
			}
			if gid == "" || meta.UserID == "" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "game_id and auth required"})
				continue
			}
			flagCtx := context.Background()
			flagCtx = context.WithValue(flagCtx, auth.ClaimsKey, &auth.Claims{
				UserID:   meta.UserID,
				Role:     meta.Role,
				Username: "",
			})
			flagCtx = context.WithValue(flagCtx, auth.UserIDKey, meta.UserID)
			go func(ctx context.Context, gameID, uid string) {
				result, err := handler(ctx, gameID, uid)
				if err != nil {
					_ = h.writeJSON(conn, wsPauseAwareError(err))
					return
				}
				_ = h.writeJSON(conn, map[string]any{"type": "move_ack", "game": result})
			}(flagCtx, gid, meta.UserID)
		case "invite_accept", "invite_decline", "invite_cancel":
			if room != "matchmaking" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "invites only on matchmaking room"})
				continue
			}
			h.mu.RLock()
			meta := h.clients[conn]
			handler := h.onInvite
			h.mu.RUnlock()
			if handler == nil || meta.UserID == "" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "invite handler unavailable"})
				continue
			}
			inviteID, _ := payload["invite_id"].(string)
			if inviteID == "" {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": "invite_id required"})
				continue
			}
			action := "accept"
			if msgType == "invite_decline" {
				action = "decline"
			} else if msgType == "invite_cancel" {
				action = "cancel"
			}
			inviteCtx := context.Background()
			inviteCtx = context.WithValue(inviteCtx, auth.UserIDKey, meta.UserID)
			inviteCtx = context.WithValue(inviteCtx, auth.ClaimsKey, &auth.Claims{
				UserID: meta.UserID,
				Role:   meta.Role,
			})
			result, err := handler(inviteCtx, meta.UserID, inviteID, action)
			if err != nil {
				_ = h.writeJSON(conn, map[string]any{"type": "error", "error": err.Error()})
				continue
			}
			_ = h.writeJSON(conn, result)
		default:
			// Never echo client payloads (may contain tokens or PII).
			_ = h.writeJSON(conn, map[string]any{"type": "ack"})
		}
	}
}

// writeJSON serializes writes per connection. Concurrent Broadcast* + move_ack without
// this corrupted frames and dropped /ws/game sockets (false "Move failed" on live).
func (h *Hub) writeJSON(conn *websocket.Conn, payload any) error {
	h.mu.RLock()
	meta, ok := h.clients[conn]
	h.mu.RUnlock()
	if !ok {
		return websocket.ErrCloseSent
	}
	if meta.writeMu != nil {
		meta.writeMu.Lock()
		defer meta.writeMu.Unlock()
	}
	return conn.WriteJSON(payload)
}

// resolveJoinedGameID prefers payload game_id but fail-closes when it disagrees with the joined room.
// Returns ("", "game_id mismatch") on cross-game grief attempts.
func resolveJoinedGameID(joined string, payload map[string]any) (gid string, errMsg string) {
	gid = strings.TrimSpace(joined)
	raw, ok := payload["game_id"].(string)
	if !ok {
		return gid, ""
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return gid, ""
	}
	if gid != "" && raw != gid {
		return "", "game_id mismatch"
	}
	return raw, ""
}

func parseCoordPair(payload map[string]any) (from, to [2]int, ok bool) {
	fromRaw, fromOK := payload["from"].([]any)
	toRaw, toOK := payload["to"].([]any)
	if !fromOK || !toOK || len(fromRaw) != 2 || len(toRaw) != 2 {
		return [2]int{}, [2]int{}, false
	}
	fr, fok := asInt(fromRaw[0])
	fc, cok := asInt(fromRaw[1])
	tr, tok := asInt(toRaw[0])
	tc, tck := asInt(toRaw[1])
	if !fok || !cok || !tok || !tck {
		return [2]int{}, [2]int{}, false
	}
	return [2]int{fr, fc}, [2]int{tr, tc}, true
}

func asInt(v any) (int, bool) {
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	case json.Number:
		i, err := n.Int64()
		return int(i), err == nil
	default:
		return 0, false
	}
}

func (h *Hub) BroadcastGame(gameID string, payload any) {
	h.localBroadcastGame(gameID, payload)
	h.publish(channelGame, "game_state", gameID, payload)
}

func (h *Hub) localBroadcastGame(gameID string, payload any) {
	h.mu.RLock()
	targets := make([]*websocket.Conn, 0, len(h.clients))
	for conn, meta := range h.clients {
		if meta.Room != "game" && meta.Room != "spectate" {
			continue
		}
		if gameID != "" && meta.GameID != "" && meta.GameID != gameID {
			continue
		}
		targets = append(targets, conn)
	}
	h.mu.RUnlock()
	for _, conn := range targets {
		if err := h.writeJSON(conn, payload); err != nil {
			log.Printf("ws write: %v", err)
		}
	}
}

func (h *Hub) BroadcastMatchmaking(payload any) {
	h.localBroadcastMatchmaking(payload)
	h.publish(channelMatchmaking, "matchmaking", "", payload)
}

func (h *Hub) localBroadcastMatchmaking(payload any) {
	h.mu.RLock()
	targets := make([]*websocket.Conn, 0, len(h.clients))
	for conn, meta := range h.clients {
		if meta.Room != "matchmaking" {
			continue
		}
		targets = append(targets, conn)
	}
	h.mu.RUnlock()
	for _, conn := range targets {
		if err := h.writeJSON(conn, payload); err != nil {
			log.Printf("ws write: %v", err)
		}
	}
}

func (h *Hub) BroadcastToUsers(userIDs []string, payload any) {
	want := map[string]struct{}{}
	for _, id := range userIDs {
		want[id] = struct{}{}
	}
	h.mu.RLock()
	targets := make([]*websocket.Conn, 0, len(h.clients))
	for conn, meta := range h.clients {
		if meta.UserID == "" {
			continue
		}
		if _, ok := want[meta.UserID]; !ok {
			continue
		}
		targets = append(targets, conn)
	}
	h.mu.RUnlock()
	for _, conn := range targets {
		if err := h.writeJSON(conn, payload); err != nil {
			log.Printf("ws write: %v", err)
		}
	}
}

// BroadcastFeatureFlags pushes flag updates to all sockets (instant UI hide/show).
func (h *Hub) BroadcastFeatureFlags(payload any) {
	h.localBroadcastFeatureFlags(payload)
	h.publish(channelFeatureFlags, "feature_flags", "", payload)
}

// BroadcastAvatarUpdated pushes a new avatar URL set to every connected client
// (game / matchmaking / spectate) so lists and seats refresh without waiting for polls.
func (h *Hub) BroadcastAvatarUpdated(payload any) {
	h.localBroadcastFeatureFlags(payload)
	h.publish(channelFeatureFlags, "avatar_updated", "", payload)
}

func (h *Hub) localBroadcastFeatureFlags(payload any) {
	h.mu.RLock()
	targets := make([]*websocket.Conn, 0, len(h.clients))
	for conn := range h.clients {
		targets = append(targets, conn)
	}
	h.mu.RUnlock()
	for _, conn := range targets {
		_ = h.writeJSON(conn, payload)
	}
}

func (h *Hub) SpectatorCount(gameID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	n := 0
	for _, meta := range h.clients {
		if meta.Room == "spectate" && (gameID == "" || meta.GameID == gameID) {
			n++
		}
	}
	return n
}

// JoinedUserIDs returns distinct authenticated users in game or spectate rooms for a game.
func (h *Hub) JoinedUserIDs(gameID string) []string {
	gid := strings.TrimSpace(gameID)
	if h == nil || gid == "" {
		return nil
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	seen := map[string]struct{}{}
	out := make([]string, 0, 16)
	for _, meta := range h.clients {
		if strings.TrimSpace(meta.GameID) != gid {
			continue
		}
		if meta.Room != "game" && meta.Room != "spectate" {
			continue
		}
		uid := strings.TrimSpace(meta.UserID)
		if uid == "" {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		out = append(out, uid)
	}
	return out
}

// UserJoinedGame reports whether userID is actively connected to this game
// (player game room or spectate room). Used to gate per-game chat posts.
func (h *Hub) UserJoinedGame(gameID, userID string) bool {
	gid := strings.TrimSpace(gameID)
	uid := strings.TrimSpace(userID)
	if h == nil || gid == "" || uid == "" {
		return false
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, meta := range h.clients {
		if strings.TrimSpace(meta.UserID) != uid {
			continue
		}
		if strings.TrimSpace(meta.GameID) != gid {
			continue
		}
		if meta.Room == "game" || meta.Room == "spectate" {
			return true
		}
	}
	return false
}

// SpectatorUserIDs returns distinct authenticated spectator user ids for a game (max limit).
func (h *Hub) SpectatorUserIDs(gameID string, limit int) []string {
	ids, _ := h.SpectatorUserIDsPaged(gameID, 0, limit)
	return ids
}

// SpectatorUserIDsPaged returns a skip/limit page of spectator ids plus total distinct count.
func (h *Hub) SpectatorUserIDsPaged(gameID string, skip, limit int) ([]string, int) {
	if skip < 0 {
		skip = 0
	}
	if limit <= 0 {
		limit = 8
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	seen := map[string]struct{}{}
	all := make([]string, 0, 32)
	for _, meta := range h.clients {
		if meta.Room != "spectate" {
			continue
		}
		if gameID != "" && meta.GameID != gameID {
			continue
		}
		uid := strings.TrimSpace(meta.UserID)
		if uid == "" {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		all = append(all, uid)
	}
	total := len(all)
	if skip >= total {
		return []string{}, total
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return all[skip:end], total
}
