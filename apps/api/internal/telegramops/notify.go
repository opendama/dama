// Package telegramops notifies the shared telegram_bot of pending Dama money reviews.
package telegramops

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"dama/apps/api/internal/store"
)

// ReceiptPendingPayload mirrors the shared bot notify contract for dama_receipt_pending.
type ReceiptPendingPayload struct {
	Type             string         `json:"type"`
	Amount           float64        `json:"amount"`
	Currency         string         `json:"currency"`
	SenderName       string         `json:"sender_name"`
	SenderPhone      string         `json:"sender_phone"`
	ScreenshotURL    string         `json:"screenshot_url"`
	RelatedEntityID  string         `json:"related_entity_id"`
	NotificationData map[string]any `json:"notification_data"`
}

// PayoutPendingPayload mirrors the shared bot notify contract for dama_payout_pending.
type PayoutPendingPayload struct {
	Type             string         `json:"type"`
	Amount           float64        `json:"amount"`
	Currency         string         `json:"currency"`
	SenderName       string         `json:"sender_name"`
	SenderPhone      string         `json:"sender_phone"`
	PayoutMethod     string         `json:"payout_method"`
	RelatedEntityID  string         `json:"related_entity_id"`
	NotificationData map[string]any `json:"notification_data"`
}

// NotifyReceiptPending POSTs to {bot_service_url}/api/v1/notify (fail-open).
func NotifyReceiptPending(ctx context.Context, settings *store.SettingsStore, payload ReceiptPendingPayload) {
	if settings == nil || !settings.TelegramOpsBotReady() {
		return
	}
	cfg := settings.TelegramOpsBot()
	payload.Type = strings.TrimSpace(cfg.NotifyReceiptType)
	if payload.Type == "" || strings.TrimSpace(payload.RelatedEntityID) == "" {
		return
	}
	postNotify(ctx, cfg, payload)
}

// NotifyPayoutPending POSTs to {bot_service_url}/api/v1/notify (fail-open).
func NotifyPayoutPending(ctx context.Context, settings *store.SettingsStore, payload PayoutPendingPayload) {
	if settings == nil || !settings.TelegramOpsBotReady() {
		return
	}
	cfg := settings.TelegramOpsBot()
	payload.Type = strings.TrimSpace(cfg.NotifyPayoutType)
	if payload.Type == "" || strings.TrimSpace(payload.RelatedEntityID) == "" {
		return
	}
	postNotify(ctx, cfg, payload)
}

func postNotify(ctx context.Context, cfg store.TelegramOpsBotConfig, payload any) {
	base := strings.TrimRight(strings.TrimSpace(cfg.BotServiceURL), "/")
	if base == "" {
		return
	}
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("telegramops: marshal notify: %v", err)
		return
	}
	if cfg.NotifyTimeoutMS <= 0 {
		log.Printf("telegramops: notify skipped: notify_timeout_ms missing")
		return
	}
	timeout := time.Duration(cfg.NotifyTimeoutMS) * time.Millisecond
	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, base+"/api/v1/notify", bytes.NewReader(body))
	if err != nil {
		log.Printf("telegramops: build notify request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	key := strings.TrimSpace(cfg.BotAPIKey)
	if key == "" {
		// Fail closed: never POST unauthenticated Dama payloads to the shared bot.
		log.Printf("telegramops: notify skipped: bot_api_key missing")
		return
	}
	req.Header.Set("X-Bot-Key", key)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("telegramops: notify failed: %v", err)
		return
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		log.Printf("telegramops: notify status %d", res.StatusCode)
	}
}
