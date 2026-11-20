package matchmaking

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/redisx"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"

	"github.com/google/uuid"
)

func allowMemoryMode() bool {
	return os.Getenv("DAMA_ALLOW_MEMORY") == "1"
}

// armMatchClock stamps authoritative clocks from platform_settings.match_clock (DB-only).
func armMatchClock(settings *store.SettingsStore, state *engine.State, preferredTCSeconds int) {
	if settings == nil || state == nil {
		return
	}
	cfg := settings.MatchClock()
	presets := make([]int, 0, len(cfg.Presets))
	for _, p := range cfg.Presets {
		presets = append(presets, p.Seconds)
	}
	engine.ArmMatchClockFromDB(
		state,
		cfg.Source,
		cfg.Enabled,
		cfg.InitialSeconds,
		cfg.IncrementSeconds,
		preferredTCSeconds,
		presets,
	)
}

const queueKey = "dama:matchmaking:queue"

type WaitingPlayer struct {
	UserID         string    `json:"user_id"`
	Username       string    `json:"username"`
	Rating         int       `json:"rating"`
	AvatarThumbURL *string   `json:"avatar_thumb_url,omitempty"`
	CountryCode    *string   `json:"country_code,omitempty"`
	HostTrustTier  string    `json:"host_trust_tier,omitempty"`
	HostTrustBadge string    `json:"host_trust_badge,omitempty"`
	JoinedAt       time.Time `json:"joined_at"`
}

type MatchReady struct {
	GameID    string        `json:"game_id"`
	Player1ID string        `json:"player1_id"`
	Player2ID string        `json:"player2_id"`
	State     *engine.State `json:"state"`
}

type Queue struct {
	mu       sync.Mutex
	local    []WaitingPlayer
	games    *gamestore.Store
	hub      *ws.Hub
	rdb      *redisx.Client
	settings *store.SettingsStore
	db       *db.Handle
	// OnGameCreated is optional (e.g. warm join QR PNG after CreateDirectMatch).
	OnGameCreated func(gameID string)
}

func NewQueue(games *gamestore.Store, hub *ws.Hub, rdb *redisx.Client, settings *store.SettingsStore, database *db.Handle) *Queue {
	return &Queue{games: games, hub: hub, rdb: rdb, settings: settings, db: database}
}

func (q *Queue) redisReady() bool {
	return q.rdb != nil && q.rdb.Ready()
}

func (q *Queue) Enqueue(p WaitingPlayer) (*MatchReady, error) {
	if p.UserID == "" {
		return nil, fmt.Errorf("user required")
	}
	p.JoinedAt = time.Now().UTC()

	if q.redisReady() {
		return q.enqueueRedis(p)
	}
	if allowMemoryMode() {
		return q.enqueueLocal(p)
	}
	return nil, fmt.Errorf("service temporarily unavailable")
}

func (q *Queue) enqueueRedis(p WaitingPlayer) (*MatchReady, error) {
	ctx := context.Background()
	rawList, err := q.rdb.RDB.LRange(ctx, queueKey, 0, -1).Result()
	if err != nil {
		if allowMemoryMode() {
			return q.enqueueLocal(p)
		}
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	for _, item := range rawList {
		var w WaitingPlayer
		if json.Unmarshal([]byte(item), &w) == nil && w.UserID == p.UserID {
			return nil, nil
		}
	}
	if len(rawList) == 0 {
		b, _ := json.Marshal(p)
		_ = q.rdb.RDB.RPush(ctx, queueKey, b).Err()
		q.hub.BroadcastMatchmaking(map[string]any{
			"type": "queue_joined",
			"size": 1,
		})
		return nil, nil
	}
	oppRaw, err := q.rdb.RDB.LPop(ctx, queueKey).Result()
	if err != nil || oppRaw == "" {
		b, _ := json.Marshal(p)
		_ = q.rdb.RDB.RPush(ctx, queueKey, b).Err()
		return nil, nil
	}
	var opponent WaitingPlayer
	if err := json.Unmarshal([]byte(oppRaw), &opponent); err != nil {
		b, _ := json.Marshal(p)
		_ = q.rdb.RDB.RPush(ctx, queueKey, b).Err()
		return nil, nil
	}
	return q.createMatch(opponent, p)
}

func (q *Queue) enqueueLocal(p WaitingPlayer) (*MatchReady, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	for _, w := range q.local {
		if w.UserID == p.UserID {
			return nil, nil
		}
	}
	if len(q.local) == 0 {
		q.local = append(q.local, p)
		q.hub.BroadcastMatchmaking(map[string]any{
			"type": "queue_joined",
			"size": len(q.local),
		})
		return nil, nil
	}
	opponent := q.local[0]
	q.local = q.local[1:]
	return q.createMatch(opponent, p)
}

func (q *Queue) createMatch(opponent, p WaitingPlayer) (*MatchReady, error) {
	ready, err := q.CreateDirectMatch(opponent, p, 0, true, true)
	if err != nil {
		return nil, err
	}
	go func() {
		q.hub.BroadcastMatchmaking(map[string]any{
			"type": "queue_updated",
			"size": q.Size(),
		})
	}()
	return ready, nil
}

// CreateDirectMatch starts a seated PvP game (matchmaking pair or accepted invite).
// timeControlSeconds / rated are optional per-challenge overrides (0 = platform default).
// broadcastMatchFound: true for queue pairing; false for invites (clients use invite_accepted only).
func (q *Queue) CreateDirectMatch(player1, player2 WaitingPlayer, timeControlSeconds int, rated bool, broadcastMatchFound bool) (*MatchReady, error) {
	if q.settings == nil {
		return nil, fmt.Errorf("board rules unavailable")
	}
	rules := q.settings.BoardRules()
	if rules.Source != "database" || rules.Size != engine.BoardSize || rules.SetupRows <= 0 || rules.Variant == "" {
		return nil, fmt.Errorf("board rules unavailable")
	}
	id := uuid.NewString()
	p1 := player1.UserID
	p2 := player2.UserID
	state, err := engine.InitialState("pvp", 0, rules.SetupRows, rules.Variant)
	if err != nil {
		return nil, err
	}
	state.Player1ID = &p1
	state.Player2ID = &p2
	armMatchClock(q.settings, state, timeControlSeconds)
	state.Rated = rated
	if _, err := q.games.Create(id, state); err != nil {
		return nil, err
	}
	if q.OnGameCreated != nil {
		q.OnGameCreated(id)
	}

	ready := &MatchReady{
		GameID:    id,
		Player1ID: p1,
		Player2ID: p2,
		State:     state,
	}
	if broadcastMatchFound && q.hub != nil {
		payload := map[string]any{
			"type":       "match_found",
			"game_id":    id,
			"player1_id": p1,
			"player2_id": p2,
			"players": []any{
				publicPlayer(player1),
				publicPlayer(player2),
			},
		}
		// Notify only the two matched players - never broadcast identities to the room.
		q.hub.BroadcastToUsers([]string{p1, p2}, payload)
	}
	if broadcastMatchFound && q.db != nil && q.db.Ready() {
		ctx := context.Background()
		notifications.EmitPlayer(ctx, q.db.Pool, p1, notifications.KindPlayerMatchFound,
			"match_found:"+id+":"+p1, id)
		notifications.EmitPlayer(ctx, q.db.Pool, p2, notifications.KindPlayerMatchFound,
			"match_found:"+id+":"+p2, id)
	}
	return ready, nil
}

func (q *Queue) Leave(userID string) {
	if q.redisReady() {
		ctx := context.Background()
		rawList, err := q.rdb.RDB.LRange(ctx, queueKey, 0, -1).Result()
		if err == nil {
			_ = q.rdb.RDB.Del(ctx, queueKey).Err()
			kept := 0
			for _, item := range rawList {
				var w WaitingPlayer
				if json.Unmarshal([]byte(item), &w) != nil || w.UserID == userID {
					continue
				}
				_ = q.rdb.RDB.RPush(ctx, queueKey, item).Err()
				kept++
			}
			q.hub.BroadcastMatchmaking(map[string]any{
				"type": "queue_left",
				"size": kept,
			})
			return
		}
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	next := q.local[:0]
	for _, w := range q.local {
		if w.UserID != userID {
			next = append(next, w)
		}
	}
	q.local = next
	q.hub.BroadcastMatchmaking(map[string]any{
		"type": "queue_left",
		"size": len(q.local),
	})
}

func (q *Queue) Size() int {
	if q.redisReady() {
		n, err := q.rdb.RDB.LLen(context.Background(), queueKey).Result()
		if err == nil {
			return int(n)
		}
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.local)
}

func (q *Queue) Contains(userID string) bool {
	if userID == "" {
		return false
	}
	if q.redisReady() {
		rawList, err := q.rdb.RDB.LRange(context.Background(), queueKey, 0, -1).Result()
		if err == nil {
			for _, item := range rawList {
				var w WaitingPlayer
				if json.Unmarshal([]byte(item), &w) == nil && w.UserID == userID {
					return true
				}
			}
			return false
		}
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	for _, w := range q.local {
		if w.UserID == userID {
			return true
		}
	}
	return false
}

func publicPlayer(p WaitingPlayer) map[string]any {
	out := map[string]any{
		"id":       p.UserID,
		"username": p.Username,
		"rating":   p.Rating,
	}
	if p.AvatarThumbURL != nil && *p.AvatarThumbURL != "" {
		out["avatar_thumb_url"] = *p.AvatarThumbURL
	}
	if p.CountryCode != nil && *p.CountryCode != "" {
		out["country_code"] = *p.CountryCode
	}
	if strings.TrimSpace(p.HostTrustTier) != "" {
		out["host_trust_tier"] = strings.TrimSpace(p.HostTrustTier)
	}
	if strings.TrimSpace(p.HostTrustBadge) != "" {
		out["host_trust_badge"] = strings.TrimSpace(p.HostTrustBadge)
	}
	return out
}
