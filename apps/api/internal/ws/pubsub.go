package ws

import (
	"context"
	"encoding/json"
	"log"

	"dama/apps/api/internal/redisx"

	"github.com/google/uuid"
)

const (
	channelGame         = "dama:ws:game"
	channelMatchmaking  = "dama:ws:matchmaking"
	channelFeatureFlags = "dama:ws:feature_flags"
)

type redisEnvelope struct {
	Origin  string          `json:"origin"`
	Kind    string          `json:"kind"`
	GameID  string          `json:"game_id,omitempty"`
	Payload json.RawMessage `json:"payload"`
}

func (h *Hub) AttachRedis(rdb *redisx.Client) {
	h.rdb = rdb
	if h.originID == "" {
		h.originID = uuid.NewString()
	}
}

func (h *Hub) StartRedisFanout(ctx context.Context) {
	if h.rdb == nil || !h.rdb.Ready() {
		return
	}
	pubsub := h.rdb.RDB.Subscribe(ctx, channelGame, channelMatchmaking, channelFeatureFlags)
	go func() {
		defer pubsub.Close()
		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				var env redisEnvelope
				if err := json.Unmarshal([]byte(msg.Payload), &env); err != nil {
					continue
				}
				if env.Origin != "" && env.Origin == h.originID {
					continue
				}
				var payload any
				if err := json.Unmarshal(env.Payload, &payload); err != nil {
					continue
				}
				switch msg.Channel {
				case channelGame:
					h.localBroadcastGame(env.GameID, payload)
				case channelMatchmaking:
					h.localBroadcastMatchmaking(payload)
				case channelFeatureFlags:
					h.localBroadcastFeatureFlags(payload)
				}
			}
		}
	}()
	log.Println("ws: redis pub/sub fanout started")
}

func (h *Hub) publish(channel, kind, gameID string, payload any) {
	if h.rdb == nil || !h.rdb.Ready() {
		return
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	env, err := json.Marshal(redisEnvelope{Origin: h.originID, Kind: kind, GameID: gameID, Payload: raw})
	if err != nil {
		return
	}
	if err := h.rdb.RDB.Publish(context.Background(), channel, env).Err(); err != nil {
		log.Printf("ws redis publish: %v", err)
	}
}
