package rest

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"dama/apps/api/internal/db"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

// TelegramBotAPI is the thin bot-facing adapter for Dama manual receipt + payout review.
// Auth: X-Bot-Key must match platform_settings.telegram_ops_bot.bot_api_key.
// Domain fulfillment reuses Payments.ReviewReceipt and Payouts.ReviewRequest.
type TelegramBotAPI struct {
	Payments *payments.Service
	Payouts  *store.PayoutStore
	Users    *store.UserStore
	Settings *store.SettingsStore
	Cash     *store.CashRmgStore
	DB       *db.Handle
}

func (a *TelegramBotAPI) opsCfg() (store.TelegramOpsBotConfig, bool) {
	if a == nil || a.Settings == nil {
		return store.TelegramOpsBotConfig{}, false
	}
	cfg := a.Settings.TelegramOpsBot()
	if cfg.Source != "database" {
		return cfg, false
	}
	return cfg, true
}

func (a *TelegramBotAPI) writeBotErr(w http.ResponseWriter, status int, msg string) {
	const errorKey = "telegram_ops_bot_error"
	msg = strings.TrimSpace(msg)
	if msg == "" && a.Settings != nil {
		cfg := a.Settings.TelegramOpsBot()
		msg = strings.TrimSpace(cfg.ErrBotRequestFailed)
		if msg == "" {
			msg = strings.TrimSpace(cfg.ErrUnavailable)
		}
	}
	// Never emit an empty operator-facing error string (fail closed to machine key).
	if msg == "" {
		msg = errorKey
	}
	writeJSON(w, status, map[string]any{"success": false, "error": msg, "error_key": errorKey})
}

func (a *TelegramBotAPI) requireBotKey(w http.ResponseWriter, r *http.Request) (store.TelegramOpsBotConfig, bool) {
	// Reload on each bot request so migrate/admin changes apply without process restart.
	if a.Settings != nil {
		_ = a.Settings.ReloadTelegramOpsBot(r.Context())
	}
	cfg, ok := a.opsCfg()
	if !ok {
		msg := ""
		if a.Settings != nil {
			msg = strings.TrimSpace(a.Settings.TelegramOpsBot().ErrUnavailable)
		}
		a.writeBotErr(w, http.StatusServiceUnavailable, msg)
		return cfg, false
	}
	if !cfg.Enabled || strings.TrimSpace(cfg.BotAPIKey) == "" {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrBotNotConfigured)
		return cfg, false
	}
	got := strings.TrimSpace(r.Header.Get("X-Bot-Key"))
	want := strings.TrimSpace(cfg.BotAPIKey)
	if got == "" || subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
		a.writeBotErr(w, http.StatusUnauthorized, cfg.ErrUnauthorizedBot)
		return cfg, false
	}
	if strings.TrimSpace(cfg.ReviewerUserID) == "" {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrReviewerMissing)
		return cfg, false
	}
	// Defense in depth: Reload heals dead reviewers, but re-check before fulfillment FK write.
	if a.Settings != nil {
		alive, err := a.Settings.TelegramOpsReviewerAlive(r.Context(), cfg.ReviewerUserID)
		if err != nil || !alive {
			a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrReviewerMissing)
			return cfg, false
		}
	}
	return cfg, true
}

func botTelegramAdminNote(r *http.Request, cfg store.TelegramOpsBotConfig, prefix string) string {
	tid := strings.TrimSpace(r.URL.Query().Get("admin_telegram_id"))
	notes := strings.TrimSpace(r.URL.Query().Get("notes"))
	reason := strings.TrimSpace(r.URL.Query().Get("reason"))
	joiner := strings.TrimSpace(cfg.ReviewNoteJoiner)
	parts := []string{strings.TrimSpace(prefix)}
	if tid != "" {
		parts = append(parts, strings.ReplaceAll(cfg.ReviewNoteTelegramIDTpl, "{telegram_id}", tid))
	}
	if notes != "" {
		parts = append(parts, notes)
	}
	if reason != "" {
		parts = append(parts, strings.ReplaceAll(cfg.ReviewNoteReasonTemplate, "{reason}", reason))
	}
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, joiner)
}

func (a *TelegramBotAPI) userDisplay(r *http.Request, userID string) (name, phone, email string) {
	name = userID
	if a.Users == nil {
		return name, phone, email
	}
	u, err := a.Users.GetByID(r.Context(), userID)
	if err != nil || u == nil {
		return name, phone, email
	}
	if un := strings.TrimSpace(u.Username); un != "" {
		name = un
	}
	if u.Email != nil {
		email = strings.TrimSpace(*u.Email)
	}
	if u.PrimaryPhone != nil {
		phone = strings.TrimSpace(*u.PrimaryPhone)
	}
	return name, phone, email
}

// GetChrome GET /telegram-bot/admin/dama/chrome - DB chrome for bot UI (no secrets).
func (a *TelegramBotAPI) GetChrome(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	chrome := a.Settings.TelegramOpsBotChromePublic()
	if chrome == nil {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrUnavailable)
		return
	}
	// Payout status gates come from cash_rmg_policy (same machine as console review).
	// Fail closed when Cash is not Ready - never return 200 chrome the bot would cache
	// without payout_approvable/approved/rejected/paid (bot invents nothing).
	if a.Cash == nil || !a.Cash.Ready() {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPaymentsUnavailable)
		return
	}
	policy := a.Cash.Policy()
	chrome["payout_approvable_status"] = policy.ApprovablePayoutStatus
	chrome["payout_approved_status"] = policy.ApprovedPayoutStatus
	chrome["payout_rejected_status"] = policy.RejectedPayoutStatus
	chrome["payout_paid_status"] = policy.PaidPayoutStatus
	writeJSON(w, http.StatusOK, chrome)
}

// ListPendingReceipts GET /telegram-bot/admin/dama/receipts/pending
func (a *TelegramBotAPI) ListPendingReceipts(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	if a.Payments == nil {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPaymentsUnavailable)
		return
	}
	raw, _, listErr := a.Payments.ListPendingReceiptsPaged(r.Context(), 0, cfg.HubListLimit, "", "pending")
	if listErr != nil {
		a.writeBotErr(w, http.StatusInternalServerError, cfg.ErrFetchFailed)
		return
	}
	items := make([]map[string]any, 0, len(raw))
	for _, rec := range raw {
		name, phone, email := a.userDisplay(r, rec.UserID)
		row := map[string]any{
			"id":           rec.ID,
			"user_id":      rec.UserID,
			"display_name": name,
			"amount":       rec.Amount,
			"currency":     rec.Currency,
			"provider":     payments.PublicChannel(rec.Provider),
			"receipt_url":  rec.ReceiptURL,
			"status":       rec.Status,
			"created_at":   rec.CreatedAt,
		}
		if phone != "" {
			row["sender_phone"] = phone
		}
		if email != "" {
			row["email"] = email
		}
		items = append(items, row)
	}
	writeJSON(w, http.StatusOK, map[string]any{"total": len(items), "items": items})
}

// GetReceipt GET /telegram-bot/admin/dama/receipts/{id}
func (a *TelegramBotAPI) GetReceipt(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	if a.Payments == nil {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPaymentsUnavailable)
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	rec, err := a.Payments.GetReceipt(r.Context(), id)
	if err != nil {
		if errors.Is(err, payments.ErrReceiptNotFound) {
			a.writeBotErr(w, http.StatusNotFound, cfg.ErrReceiptNotFound)
			return
		}
		a.writeBotErr(w, http.StatusInternalServerError, cfg.ErrFetchFailed)
		return
	}
	if rec == nil {
		a.writeBotErr(w, http.StatusNotFound, cfg.ErrReceiptNotFound)
		return
	}
	name, phone, email := a.userDisplay(r, rec.UserID)
	out := map[string]any{
		"id":           rec.ID,
		"user_id":      rec.UserID,
		"display_name": name,
		"amount":       rec.Amount,
		"currency":     rec.Currency,
		"provider":     payments.PublicChannel(rec.Provider),
		"reference":    rec.Reference,
		"receipt_url":  rec.ReceiptURL,
		"status":       rec.Status,
		"created_at":   rec.CreatedAt,
	}
	if phone != "" {
		out["sender_phone"] = phone
	}
	if email != "" {
		out["email"] = email
	}
	if id := strings.TrimSpace(rec.IntentID); id != "" {
		out["intent_id"] = id
	}
	if n := strings.TrimSpace(rec.ReviewNote); n != "" {
		out["review_note"] = n
	}
	if rec.ReviewedAt != nil {
		out["reviewed_at"] = *rec.ReviewedAt
	}
	writeJSON(w, http.StatusOK, out)
}

// ApproveReceipt POST /telegram-bot/admin/dama/receipts/{id}/approve
func (a *TelegramBotAPI) ApproveReceipt(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	a.reviewReceipt(w, r, cfg, true)
}

// RejectReceipt POST /telegram-bot/admin/dama/receipts/{id}/reject
func (a *TelegramBotAPI) RejectReceipt(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	if strings.TrimSpace(r.URL.Query().Get("reason")) == "" {
		a.writeBotErr(w, http.StatusBadRequest, cfg.ErrRejectReasonRequired)
		return
	}
	a.reviewReceipt(w, r, cfg, false)
}

func (a *TelegramBotAPI) reviewReceipt(w http.ResponseWriter, r *http.Request, cfg store.TelegramOpsBotConfig, approve bool) {
	if a.Payments == nil {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPaymentsUnavailable)
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	prefix := cfg.ReviewNoteRejectedPrefix
	if approve {
		prefix = cfg.ReviewNoteApprovedPrefix
	}
	note := botTelegramAdminNote(r, cfg, prefix)
	rec, err := a.Payments.ReviewReceipt(r.Context(), id, cfg.ReviewerUserID, approve, note)
	if err != nil {
		if errors.Is(err, payments.ErrReceiptNotFound) {
			a.writeBotErr(w, http.StatusNotFound, cfg.ErrReceiptNotFound)
			return
		}
		if errors.Is(err, payments.ErrReceiptAlreadyReviewed) {
			a.writeBotErr(w, http.StatusConflict, cfg.ErrReceiptReviewFailed)
			return
		}
		a.writeBotErr(w, http.StatusInternalServerError, cfg.ErrReceiptReviewFailed)
		return
	}
	displayStatus := payments.ReceiptDisplayStatus(rec.Status)
	if a.DB != nil && a.DB.Ready() {
		// Notif body uses display status (approved → paid) so players see Paid, not Approved.
		if statusLabel := walletListStatusLabel(r.Context(), a.Settings, displayStatus); statusLabel != "" {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, rec.UserID, notifications.KindPlayerReceiptReviewed,
				"receipt_reviewed:"+rec.ID, rec.ID, statusLabel)
		}
		if approve {
			args := notifications.MoneyArgs(rec.Amount, rec.Currency)
			notifications.EmitPlayer(r.Context(), a.DB.Pool, rec.UserID, notifications.KindPlayerWalletCredited,
				"wallet_credited:receipt:"+rec.ID, "", args...)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success":        true,
		"receipt_id":     rec.ID,
		"status":         rec.Status,
		"display_status": displayStatus,
		"amount":         rec.Amount,
		"currency":       rec.Currency,
	})
}

// ListPendingPayouts GET /telegram-bot/admin/dama/payouts/pending
func (a *TelegramBotAPI) ListPendingPayouts(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	if a.Payouts == nil || a.Cash == nil || !a.Cash.Ready() {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPayoutsUnavailable)
		return
	}
	policy := a.Cash.Policy()
	limit := cfg.HubListLimit
	// Hub includes pending (approve/reject) and approved (mark paid) so Mark paid stays reachable.
	pending, _, err := a.Payouts.ListRequestsPaged(r.Context(), policy.ApprovablePayoutStatus, 0, limit, "")
	if err != nil {
		a.writeBotErr(w, http.StatusInternalServerError, cfg.ErrFetchFailed)
		return
	}
	approved, _, err := a.Payouts.ListRequestsPaged(r.Context(), policy.ApprovedPayoutStatus, 0, limit, "")
	if err != nil {
		a.writeBotErr(w, http.StatusInternalServerError, cfg.ErrFetchFailed)
		return
	}
	list := append(pending, approved...)
	items := make([]map[string]any, 0, len(list))
	for _, p := range list {
		name, phone, email := a.userDisplay(r, p.UserID)
		if phone == "" {
			phone = strings.TrimSpace(p.Phone)
		}
		row := map[string]any{
			"id":            p.ID,
			"user_id":       p.UserID,
			"display_name":  name,
			"amount":        p.Amount,
			"currency":      p.Currency,
			"payout_method": p.Provider,
			"phone":         phone,
			"status":        p.Status,
			"created_at":    p.CreatedAt,
		}
		if email != "" {
			row["email"] = email
		}
		items = append(items, row)
	}
	writeJSON(w, http.StatusOK, map[string]any{"total": len(items), "items": items})
}

// GetPayout GET /telegram-bot/admin/dama/payouts/{id}
func (a *TelegramBotAPI) GetPayout(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	if a.Payouts == nil {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPayoutsUnavailable)
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	p, err := a.Payouts.GetRequest(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrPayoutNotFound) {
			a.writeBotErr(w, http.StatusNotFound, cfg.ErrPayoutNotFound)
			return
		}
		a.writeBotErr(w, http.StatusInternalServerError, cfg.ErrFetchFailed)
		return
	}
	if p == nil {
		a.writeBotErr(w, http.StatusNotFound, cfg.ErrPayoutNotFound)
		return
	}
	name, phone, email := a.userDisplay(r, p.UserID)
	if phone == "" {
		phone = strings.TrimSpace(p.Phone)
	}
	out := map[string]any{
		"id":            p.ID,
		"user_id":       p.UserID,
		"display_name":  name,
		"amount":        p.Amount,
		"currency":      p.Currency,
		"payout_method": p.Provider,
		"phone":         phone,
		"status":        p.Status,
		"created_at":    p.CreatedAt,
		"review_note":   p.ReviewNote,
	}
	if email != "" {
		out["email"] = email
	}
	if p.ReviewedAt != nil {
		out["reviewed_at"] = *p.ReviewedAt
	}
	writeJSON(w, http.StatusOK, out)
}

// ApprovePayout POST .../approve
func (a *TelegramBotAPI) ApprovePayout(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	if a.Cash == nil || !a.Cash.Ready() {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPayoutsUnavailable)
		return
	}
	a.reviewPayout(w, r, cfg, a.Cash.Policy().ApprovedPayoutStatus)
}

// RejectPayout POST .../reject
func (a *TelegramBotAPI) RejectPayout(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	if a.Cash == nil || !a.Cash.Ready() {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPayoutsUnavailable)
		return
	}
	if strings.TrimSpace(r.URL.Query().Get("reason")) == "" {
		a.writeBotErr(w, http.StatusBadRequest, cfg.ErrRejectReasonRequired)
		return
	}
	a.reviewPayout(w, r, cfg, a.Cash.Policy().RejectedPayoutStatus)
}

// MarkPayoutPaid POST .../paid
func (a *TelegramBotAPI) MarkPayoutPaid(w http.ResponseWriter, r *http.Request) {
	cfg, ok := a.requireBotKey(w, r)
	if !ok {
		return
	}
	if a.Cash == nil || !a.Cash.Ready() {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPayoutsUnavailable)
		return
	}
	a.reviewPayout(w, r, cfg, a.Cash.Policy().PaidPayoutStatus)
}

func (a *TelegramBotAPI) reviewPayout(w http.ResponseWriter, r *http.Request, cfg store.TelegramOpsBotConfig, status string) {
	if a.Payouts == nil || a.Cash == nil || !a.Cash.Ready() {
		a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPayoutsUnavailable)
		return
	}
	policy := a.Cash.Policy()
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	current, err := a.Payouts.GetRequest(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrPayoutNotFound) {
			a.writeBotErr(w, http.StatusNotFound, cfg.ErrPayoutNotFound)
			return
		}
		a.writeBotErr(w, http.StatusInternalServerError, cfg.ErrFetchFailed)
		return
	}
	if current == nil {
		a.writeBotErr(w, http.StatusNotFound, cfg.ErrPayoutNotFound)
		return
	}
	switch status {
	case policy.ApprovedPayoutStatus, policy.RejectedPayoutStatus:
		if current.Status != policy.ApprovablePayoutStatus {
			a.writeBotErr(w, http.StatusConflict, cfg.ErrInvalidPayoutTransition)
			return
		}
	case policy.PaidPayoutStatus:
		if current.Status != policy.ApprovedPayoutStatus {
			a.writeBotErr(w, http.StatusConflict, cfg.ErrInvalidPayoutTransition)
			return
		}
	default:
		a.writeBotErr(w, http.StatusBadRequest, cfg.ErrInvalidPayoutStatus)
		return
	}
	prefix := status
	switch status {
	case policy.ApprovedPayoutStatus:
		prefix = cfg.ReviewNoteApprovedPrefix
	case policy.RejectedPayoutStatus:
		prefix = cfg.ReviewNoteRejectedPrefix
	case policy.PaidPayoutStatus:
		prefix = cfg.ReviewNotePaidPrefix
	}
	note := botTelegramAdminNote(r, cfg, prefix)
	fromStatus := policy.ApprovablePayoutStatus
	if status == policy.PaidPayoutStatus {
		fromStatus = policy.ApprovedPayoutStatus
	}
	var req *store.PayoutRequest
	if status == policy.RejectedPayoutStatus {
		if a.Payments == nil {
			a.writeBotErr(w, http.StatusServiceUnavailable, cfg.ErrPaymentsUnavailable)
			return
		}
		// Atomic reject+refund (parity with ReviewReceipt) - no orphan rejected-without-credit.
		req, err = a.Payments.RejectPayoutAndRefund(r.Context(), id, fromStatus, status, note, cfg.ReviewerUserID)
		if err != nil {
			if errors.Is(err, store.ErrPayoutNotFound) {
				a.writeBotErr(w, http.StatusNotFound, cfg.ErrPayoutNotFound)
				return
			}
			if errors.Is(err, store.ErrPayoutTransitionConflict) {
				a.writeBotErr(w, http.StatusConflict, cfg.ErrInvalidPayoutTransition)
				return
			}
			a.writeBotErr(w, http.StatusInternalServerError, strings.TrimSpace(cfg.ErrRefundFailedPrefix))
			return
		}
		if a.DB != nil && a.DB.Ready() {
			args := notifications.MoneyArgs(req.Amount, req.Currency)
			notifications.EmitPlayer(r.Context(), a.DB.Pool, req.UserID, notifications.KindPlayerWalletCredited,
				"wallet_credited:payout_reject:"+req.ID, req.ID, args...)
		}
	} else {
		req, err = a.Payouts.ReviewRequest(r.Context(), id, fromStatus, status, note, cfg.ReviewerUserID)
		if err != nil {
			if errors.Is(err, store.ErrPayoutNotFound) {
				a.writeBotErr(w, http.StatusNotFound, cfg.ErrPayoutNotFound)
				return
			}
			if errors.Is(err, store.ErrPayoutTransitionConflict) {
				a.writeBotErr(w, http.StatusConflict, cfg.ErrInvalidPayoutTransition)
				return
			}
			a.writeBotErr(w, http.StatusInternalServerError, cfg.ErrPayoutReviewFailed)
			return
		}
	}
	if a.DB != nil && a.DB.Ready() {
		if statusLabel := walletListStatusLabel(r.Context(), a.Settings, status); statusLabel != "" {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, req.UserID, notifications.KindPlayerPayoutUpdated,
				"payout_updated:"+req.ID+":"+status, req.ID, statusLabel)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success":   true,
		"payout_id": req.ID,
		"status":    req.Status,
		"amount":    req.Amount,
		"currency":  req.Currency,
	})
}

func writeAdminPaymentsChromeError(w http.ResponseWriter, settings *store.SettingsStore, ctx context.Context, status int, key string) {
	msg := adminPaymentsChromeString(settings, ctx, key)
	writeJSON(w, status, map[string]string{"error": msg, "error_key": strings.TrimSpace(key)})
}

// ConsoleTelegramOpsGet GET /console/telegram-ops-bot (JWT console + payments.review).
func (a *PaymentsAPI) ConsoleTelegramOpsGet(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeAdminPaymentsChromeError(w, nil, r.Context(), http.StatusServiceUnavailable, "telegram_ops_settings_unavailable")
		return
	}
	_ = a.Settings.ReloadTelegramOpsBot(r.Context())
	cfg := a.Settings.TelegramOpsBot()
	if cfg.Source != "database" {
		writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "telegram_ops_config_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":             cfg.Enabled,
		"bot_service_url":     cfg.BotServiceURL,
		"reviewer_user_id":    cfg.ReviewerUserID,
		"notify_timeout_ms":   cfg.NotifyTimeoutMS,
		"notify_receipt_type": cfg.NotifyReceiptType,
		"notify_payout_type":  cfg.NotifyPayoutType,
		"product_label":       cfg.ProductLabel,
		"has_bot_api_key":     strings.TrimSpace(cfg.BotAPIKey) != "",
		"ready":               a.Settings.TelegramOpsBotReady(),
	})
}

// ConsoleTelegramOpsPut PUT /console/telegram-ops-bot.
func (a *PaymentsAPI) ConsoleTelegramOpsPut(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeAdminPaymentsChromeError(w, nil, r.Context(), http.StatusServiceUnavailable, "telegram_ops_settings_unavailable")
		return
	}
	var body struct {
		Enabled         bool   `json:"enabled"`
		BotServiceURL   string `json:"bot_service_url"`
		BotAPIKey       string `json:"bot_api_key"`
		ReviewerUserID  string `json:"reviewer_user_id"`
		NotifyTimeoutMS int    `json:"notify_timeout_ms"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	err := a.Settings.SetTelegramOpsBot(r.Context(), store.TelegramOpsBotConfig{
		Enabled:         body.Enabled,
		BotServiceURL:   body.BotServiceURL,
		BotAPIKey:       body.BotAPIKey,
		ReviewerUserID:  body.ReviewerUserID,
		NotifyTimeoutMS: body.NotifyTimeoutMS,
	})
	if err != nil {
		writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "telegram_ops_save_invalid")
		return
	}
	a.ConsoleTelegramOpsGet(w, r)
}
