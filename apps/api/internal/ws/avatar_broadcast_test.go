package ws

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"dama/apps/api/internal/auth"

	"github.com/gorilla/websocket"
)

func TestBroadcastAvatarUpdated_reachesMatchmakingClient(t *testing.T) {
	tokens := auth.NewTokenService("avatar-e2e-secret-key-32bytes!!", 1)
	tok, _, err := tokens.Issue("user-e2e-1", "e2e_player", "player")
	if err != nil {
		t.Fatal(err)
	}
	hub := NewHub(tokens, nil)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hub.HandleMatchmaking(w, r)
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + tok
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// Drain welcome
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, _ = conn.ReadMessage()

	thumb := "https://cdn.example/avatars/user-e2e-1/thumb.webp"
	full := "https://cdn.example/avatars/user-e2e-1/full.webp"
	hub.BroadcastAvatarUpdated(map[string]any{
		"type":             "avatar_updated",
		"user_id":          "user-e2e-1",
		"avatar_thumb_url": thumb,
		"avatar_full_url":  full,
	})

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read avatar_updated: %v", err)
	}
	var msg map[string]any
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatal(err)
	}
	if msg["type"] != "avatar_updated" {
		t.Fatalf("type=%v payload=%s", msg["type"], string(data))
	}
	if msg["user_id"] != "user-e2e-1" {
		t.Fatalf("user_id=%v", msg["user_id"])
	}
	if msg["avatar_thumb_url"] != thumb {
		t.Fatalf("thumb=%v", msg["avatar_thumb_url"])
	}
	if msg["avatar_full_url"] != full {
		t.Fatalf("full=%v", msg["avatar_full_url"])
	}
}
