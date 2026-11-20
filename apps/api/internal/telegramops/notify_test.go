package telegramops

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"dama/apps/api/internal/store"
)

func TestPostNotifySkipsEmptyBase(t *testing.T) {
	// Should not panic when URL empty.
	postNotify(context.Background(), store.TelegramOpsBotConfig{NotifyTimeoutMS: 1}, map[string]any{"type": "x"})
}

func TestNotifyReceiptPendingRequiresReady(t *testing.T) {
	// nil settings / not ready → no-op
	NotifyReceiptPending(context.Background(), nil, ReceiptPendingPayload{RelatedEntityID: "x"})
}

func TestPostNotifySendsBotKeyAndJSON(t *testing.T) {
	var gotKey atomic.Value
	var gotPath atomic.Value
	var gotBody atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey.Store(r.Header.Get("X-Bot-Key"))
		gotPath.Store(r.URL.Path)
		b, _ := io.ReadAll(r.Body)
		gotBody.Store(string(b))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer srv.Close()

	cfg := store.TelegramOpsBotConfig{
		BotServiceURL:   srv.URL,
		BotAPIKey:       "test-dama-bot-key",
		NotifyTimeoutMS: 2000,
	}
	payload := ReceiptPendingPayload{
		Type:            "dama_receipt_pending",
		Amount:          12.5,
		Currency:        "ETB",
		SenderName:      "player1",
		RelatedEntityID: "rid-1",
		ScreenshotURL:   "https://example.test/r.png",
		NotificationData: map[string]any{
			"product_label": "Dama",
			"notify_title":  "New Dama manual receipt",
		},
	}
	postNotify(context.Background(), cfg, payload)

	if gotPath.Load() != "/api/v1/notify" {
		t.Fatalf("path=%v", gotPath.Load())
	}
	if gotKey.Load() != "test-dama-bot-key" {
		t.Fatalf("key=%v", gotKey.Load())
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(gotBody.Load().(string)), &m); err != nil {
		t.Fatal(err)
	}
	if m["type"] != "dama_receipt_pending" || m["related_entity_id"] != "rid-1" {
		t.Fatalf("body=%v", m)
	}
	if m["currency"] != "ETB" {
		t.Fatalf("currency=%v", m["currency"])
	}
}

func TestPostNotifyFailsClosedWithoutTimeout(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	postNotify(context.Background(), store.TelegramOpsBotConfig{
		BotServiceURL:   srv.URL,
		BotAPIKey:       "k",
		NotifyTimeoutMS: 0,
	}, map[string]any{"type": "x"})
	if hits.Load() != 0 {
		t.Fatalf("expected skip when timeout missing, hits=%d", hits.Load())
	}
}

func TestPostNotifyFailsClosedWithoutBotKey(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	postNotify(context.Background(), store.TelegramOpsBotConfig{
		BotServiceURL:   srv.URL,
		BotAPIKey:       "",
		NotifyTimeoutMS: 2000,
	}, map[string]any{"type": "x"})
	if hits.Load() != 0 {
		t.Fatalf("expected skip when bot_api_key missing, hits=%d", hits.Load())
	}
}
