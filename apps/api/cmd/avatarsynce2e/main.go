// Live E2E: UpdateAvatar in Postgres → redis PUBLISH avatar_updated → matchmaking WS receives it.
// Run on host with compose env, or: docker compose exec backend-api /app/server is wrong binary.
// Prefer: go run ./cmd/avatarsynce2e (from apps/api) with DAMA_* env pointing at compose.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/store"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

func main() {
	dsn := mustEnv("DAMA_DATABASE_URL")
	jwtSecret := mustEnv("DAMA_JWT_SECRET")
	redisURL := mustEnv("DAMA_REDIS_URL")
	wsHTTP := env("DAMA_E2E_WS_HTTP", "http://127.0.0.1:18080")

	ctx := context.Background()
	handle, err := db.Connect(dsn)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer handle.Pool.Close()
	users := store.NewUserStore(handle)

	var id, username, role string
	if err := handle.Pool.QueryRow(ctx, `
		SELECT id, username, role FROM users
		WHERE is_active = true AND role = 'player'
		ORDER BY updated_at DESC NULLS LAST
		LIMIT 1
	`).Scan(&id, &username, &role); err != nil {
		log.Fatalf("pick user: %v", err)
	}

	tokens := auth.NewTokenService(jwtSecret, 24)
	tok, _, err := tokens.Issue(id, username, role)
	if err != nil {
		log.Fatalf("issue: %v", err)
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("redis url: %v", err)
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	u, err := url.Parse(wsHTTP)
	if err != nil {
		log.Fatal(err)
	}
	u.Scheme = strings.Replace(u.Scheme, "http", "ws", 1)
	u.Path = "/ws/matchmaking"
	u.RawQuery = "token=" + url.QueryEscape(tok)
	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatalf("ws dial %s: %v", u.String(), err)
	}
	defer conn.Close()

	got := make(chan map[string]any, 2)
	go func() {
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var msg map[string]any
			if json.Unmarshal(data, &msg) != nil {
				continue
			}
			if msg["type"] == "avatar_updated" {
				got <- msg
			}
		}
	}()
	time.Sleep(400 * time.Millisecond)

	thumb := fmt.Sprintf("https://e2e.invalid/avatars/%s/%d_thumb.webp", id, time.Now().UnixNano())
	full := fmt.Sprintf("https://e2e.invalid/avatars/%s/%d_full.webp", id, time.Now().UnixNano())
	user, err := users.UpdateAvatar(ctx, id, thumb, full, fmt.Sprintf("e2e-%d", time.Now().UnixNano()))
	if err != nil {
		log.Fatalf("UpdateAvatar: %v", err)
	}
	if user == nil || user.AvatarThumbURL == nil || *user.AvatarThumbURL != thumb {
		log.Fatalf("db thumb mismatch got=%v want=%s", user, thumb)
	}

	payload, _ := json.Marshal(map[string]any{
		"type":             "avatar_updated",
		"user_id":          id,
		"avatar_thumb_url": thumb,
		"avatar_full_url":  full,
	})
	env, _ := json.Marshal(map[string]any{
		"origin":  "avatarsynce2e",
		"kind":    "avatar_updated",
		"payload": json.RawMessage(payload),
	})
	if err := rdb.Publish(ctx, "dama:ws:feature_flags", env).Err(); err != nil {
		log.Fatalf("redis publish: %v", err)
	}

	select {
	case msg := <-got:
		if fmt.Sprint(msg["user_id"]) != id {
			log.Fatalf("ws user_id=%v want=%s", msg["user_id"], id)
		}
		if fmt.Sprint(msg["avatar_thumb_url"]) != thumb {
			log.Fatalf("ws thumb=%v want=%s", msg["avatar_thumb_url"], thumb)
		}
		fmt.Println("PASS live e2e: DB UpdateAvatar + redis fanout + matchmaking WS avatar_updated")
	case <-time.After(5 * time.Second):
		log.Fatal("FAIL timeout waiting for avatar_updated on matchmaking WS")
	}
}

func mustEnv(k string) string {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		log.Fatalf("%s required", k)
	}
	return v
}

func env(k, def string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return def
}
