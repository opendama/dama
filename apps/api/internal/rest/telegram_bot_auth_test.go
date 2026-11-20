package rest

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"dama/apps/api/internal/config"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

func withChiURLParam(req *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestRequireBotKeyUnauthorized(t *testing.T) {
	settings := &store.SettingsStore{}
	// Inject via TelegramOpsBot cache using Set is hard without DB; exercise writeBotErr path via opsCfg fail.
	api := &TelegramBotAPI{Settings: settings}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/telegram-bot/admin/dama/chrome", nil)
	_, ok := api.requireBotKey(rr, req)
	if ok {
		t.Fatalf("expected requireBotKey to fail when settings unavailable")
	}
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d want 503", rr.Code)
	}
}

func TestRequireBotKeyWrongKey(t *testing.T) {
	const key = "dama-test-bot-key"
	api := &TelegramBotAPI{Settings: testOpsSettings(key)}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/telegram-bot/admin/dama/chrome", nil)
	req.Header.Set("X-Bot-Key", "wrong-key")
	_, ok := api.requireBotKey(rr, req)
	if ok {
		t.Fatalf("expected requireBotKey to fail on wrong X-Bot-Key")
	}
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d want 401", rr.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_unauthorized_bot_chrome" {
		t.Fatalf("error=%v want err_unauthorized_bot_chrome", body["error"])
	}
}

func TestRequireBotKeyMissing(t *testing.T) {
	const key = "dama-test-bot-key"
	api := &TelegramBotAPI{Settings: testOpsSettings(key)}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/telegram-bot/admin/dama/chrome", nil)
	_, ok := api.requireBotKey(rr, req)
	if ok {
		t.Fatalf("expected requireBotKey to fail when X-Bot-Key missing")
	}
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d want 401", rr.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_unauthorized_bot_chrome" {
		t.Fatalf("error=%v want err_unauthorized_bot_chrome", body["error"])
	}
}

func testOpsSettings(key string) *store.SettingsStore {
	s := store.NewSettingsStore(nil)
	s.ReplaceTelegramOpsBotMemory(store.TelegramOpsBotConfig{
		Enabled:                 true,
		BotAPIKey:               key,
		ReviewerUserID:          "00000000-0000-0000-0000-000000000001",
		ErrRejectReasonRequired: "err_reject_reason_required_chrome",
		ErrBotNotConfigured:     "err_bot_not_configured_chrome",
		ErrUnauthorizedBot:      "err_unauthorized_bot_chrome",
		ErrReviewerMissing:      "err_reviewer_missing_chrome",
		ErrUnavailable:          "err_unavailable_chrome",
		ErrPaymentsUnavailable:  "err_payments_unavailable_chrome",
		ErrPayoutsUnavailable:   "err_payouts_unavailable_chrome",
	})
	return s
}

func TestRejectReceiptRequiresNonEmptyReason(t *testing.T) {
	const key = "dama-test-bot-key"
	api := &TelegramBotAPI{Settings: testOpsSettings(key)}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/telegram-bot/admin/dama/receipts/rcpt-1/reject", nil)
	req.Header.Set("X-Bot-Key", key)
	api.RejectReceipt(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status=%d want 400", rr.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_reject_reason_required_chrome" {
		t.Fatalf("error=%v want err_reject_reason_required_chrome", body["error"])
	}
}

func TestRejectReceiptWithReasonPassesGate(t *testing.T) {
	const key = "dama-test-bot-key"
	// Payments nil → after reason check, review fails closed as payments unavailable (not 400).
	api := &TelegramBotAPI{Settings: testOpsSettings(key)}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/telegram-bot/admin/dama/receipts/rcpt-1/reject?reason=not+valid", nil)
	req.Header.Set("X-Bot-Key", key)
	api.RejectReceipt(rr, req)
	if rr.Code == http.StatusBadRequest {
		t.Fatalf("did not expect 400 when reason present; body=%s", rr.Body.String())
	}
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d want 503 payments unavailable; body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_payments_unavailable_chrome" {
		t.Fatalf("error=%v want err_payments_unavailable_chrome", body["error"])
	}
}

func TestGetChromeFailsClosedWhenCashNil(t *testing.T) {
	const key = "dama-test-bot-key"
	api := &TelegramBotAPI{Settings: testOpsSettings(key), Cash: nil}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/telegram-bot/admin/dama/chrome", nil)
	req.Header.Set("X-Bot-Key", key)
	api.GetChrome(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d want 503; body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_payments_unavailable_chrome" {
		t.Fatalf("error=%v want err_payments_unavailable_chrome", body["error"])
	}
	if _, has := body["payout_approvable_status"]; has {
		t.Fatalf("must not export payout status gates when Cash nil")
	}
}

func TestGetChromeFailsClosedWhenCashNotReady(t *testing.T) {
	const key = "dama-test-bot-key"
	// Empty CashRmgStore → Ready() false (policy/chrome Source not database).
	api := &TelegramBotAPI{Settings: testOpsSettings(key), Cash: &store.CashRmgStore{}}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/telegram-bot/admin/dama/chrome", nil)
	req.Header.Set("X-Bot-Key", key)
	api.GetChrome(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d want 503; body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_payments_unavailable_chrome" {
		t.Fatalf("error=%v want err_payments_unavailable_chrome", body["error"])
	}
}

func testOpsSettingsReviewTaxonomy(key string) *store.SettingsStore {
	s := store.NewSettingsStore(nil)
	s.ReplaceTelegramOpsBotMemory(store.TelegramOpsBotConfig{
		Enabled:                  true,
		BotAPIKey:                key,
		ReviewerUserID:           "00000000-0000-0000-0000-000000000001",
		ErrReceiptNotFound:       "err_receipt_not_found_chrome",
		ErrReceiptReviewFailed:   "err_receipt_review_failed_chrome",
		ErrPaymentsUnavailable:   "err_payments_unavailable_chrome",
		ErrUnauthorizedBot:       "err_unauthorized_bot_chrome",
		ErrBotNotConfigured:      "err_bot_not_configured_chrome",
		ErrReviewerMissing:       "err_reviewer_missing_chrome",
		ErrUnavailable:           "err_unavailable_chrome",
		ErrFetchFailed:           "err_fetch_failed_chrome",
		ReviewNoteApprovedPrefix: "approved:",
		ReviewNoteRejectedPrefix: "rejected:",
	})
	return s
}

func TestApproveReceiptMissingIDReturns404(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	const key = "dama-test-bot-key"
	svc := payments.NewService(config.Config{}, nil, nil, nil, nil)
	api := &TelegramBotAPI{Settings: testOpsSettingsReviewTaxonomy(key), Payments: svc}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/telegram-bot/admin/dama/receipts/missing-id/approve", nil)
	req.Header.Set("X-Bot-Key", key)
	req = withChiURLParam(req, "id", "missing-id")
	api.ApproveReceipt(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status=%d want 404; body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_receipt_not_found_chrome" {
		t.Fatalf("error=%v want err_receipt_not_found_chrome", body["error"])
	}
}

func TestApproveReceiptAlreadyReviewedReturns409(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	const key = "dama-test-bot-key"
	svc := payments.NewService(config.Config{}, nil, nil, nil, nil)
	rec, err := svc.SubmitManualReceipt(t.Context(), "user-1", 10, "ETB", "ref-1", "https://example.test/r.png", "")
	if err != nil {
		t.Fatalf("SubmitManualReceipt: %v", err)
	}
	if _, err := svc.ReviewReceipt(t.Context(), rec.ID, "admin-1", true, "first"); err != nil {
		t.Fatalf("first ReviewReceipt: %v", err)
	}
	api := &TelegramBotAPI{Settings: testOpsSettingsReviewTaxonomy(key), Payments: svc}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/telegram-bot/admin/dama/receipts/"+rec.ID+"/approve", nil)
	req.Header.Set("X-Bot-Key", key)
	req = withChiURLParam(req, "id", rec.ID)
	api.ApproveReceipt(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("status=%d want 409; body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_receipt_review_failed_chrome" {
		t.Fatalf("error=%v want err_receipt_review_failed_chrome", body["error"])
	}
}

func TestGetReceiptMissingIDReturns404(t *testing.T) {
	t.Setenv("DAMA_ALLOW_MEMORY", "1")
	const key = "dama-test-bot-key"
	svc := payments.NewService(config.Config{}, nil, nil, nil, nil)
	api := &TelegramBotAPI{Settings: testOpsSettingsReviewTaxonomy(key), Payments: svc}
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/telegram-bot/admin/dama/receipts/missing-id", nil)
	req.Header.Set("X-Bot-Key", key)
	req = withChiURLParam(req, "id", "missing-id")
	api.GetReceipt(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status=%d want 404; body=%s", rr.Code, rr.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("json: %v", err)
	}
	if body["error"] != "err_receipt_not_found_chrome" {
		t.Fatalf("error=%v want err_receipt_not_found_chrome", body["error"])
	}
}
