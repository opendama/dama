package rest

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/telegramops"
	"github.com/go-chi/chi/v5"
)

type PaymentsAPI struct {
	Payments *payments.Service
	Users    *store.UserStore
	Settings *store.SettingsStore
	Cash     *store.CashRmgStore
	Locate   *geo.Resolver
	DB       *db.Handle
	Avatars  interface {
		UploadReceiptImage(userID, filename, contentType string, data []byte) (string, error)
	}
}

func (a *PaymentsAPI) payerCountry(r *http.Request) string {
	return resolvePayerCountryFromRequest(r, a.Locate, a.Settings, 0, 0)
}

type checkoutBody struct {
	Amount      float64 `json:"amount"`
	Purpose     string  `json:"purpose"`
	CountryCode string  `json:"country_code"`
	Email       string  `json:"email"`
	ReturnURL   string  `json:"return_url"`
}

func (a *PaymentsAPI) Checkout(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	var body checkoutBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	payerCC := a.payerCountry(r)
	if payerCC == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "country_required_checkout")
		return
	}
	if !requireCashGate(w, r, a.Cash, a.Users, a.Settings, payerCC) {
		return
	}
	email := strings.TrimSpace(body.Email)
	if email == "" && a.Users != nil {
		if u, err := a.Users.GetByID(r.Context(), userID); err == nil && u.Email != nil {
			email = strings.TrimSpace(*u.Email)
		}
	}
	result, err := a.Payments.StartCheckout(r.Context(), payments.CheckoutRequest{
		UserID:      userID,
		Amount:      body.Amount,
		Purpose:     body.Purpose,
		CountryCode: payerCC,
		Email:       email,
		ReturnURL:   body.ReturnURL,
	})
	if err != nil {
		msg := err.Error()
		switch msg {
		case "amount must be positive":
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "invalid_top_up_amount")
		case "country_code required":
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "country_required_checkout")
		case "payment route incomplete":
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payment_route_unavailable")
		case "currency config unavailable":
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "location_currency_unresolved")
		default:
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadGateway, "checkout_unavailable")
		}
		return
	}
	// Sanitize vendor ids before they leave the API boundary.
	out := map[string]any{
		"route": payments.PublicRouteJSON(result.Route),
	}
	if result.Intent != nil {
		out["intent"] = map[string]any{
			"id":           result.Intent.ID,
			"amount":       result.Intent.Amount,
			"currency":     result.Intent.Currency,
			"provider":     payments.PublicChannel(result.Intent.Provider),
			"tx_ref":       result.Intent.TxRef,
			"checkout_url": result.Intent.CheckoutURL,
			"status":       result.Intent.Status,
		}
	}
	if len(result.Banks) > 0 {
		out["banks"] = payments.PublicBanks(result.Banks)
	}
	writeJSON(w, http.StatusCreated, out)
}

func (a *PaymentsAPI) RoutePreview(w http.ResponseWriter, r *http.Request) {
	// Prefer server geo (reference parity). Optional country_code query is ignored for routing.
	cc := a.payerCountry(r)
	if cc == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "country_required_checkout")
		return
	}
	flags := a.Payments.Flags()
	route := payments.ResolveRoute(cc, flags, a.Payments.CurrencyConfig(), a.Payments.EthiopiaCountry())
	if err := route.Validate(); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "payment_route_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, payments.PublicRouteJSON(route))
}

func (a *PaymentsAPI) CurrencyConfig(w http.ResponseWriter, r *http.Request) {
	cfg := a.Payments.CurrencyConfig()
	if cfg.Source != "database" || cfg.Global == "" || cfg.Ethiopia == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "location_currency_unresolved")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"global":    cfg.Global,
		"ethiopia":  cfg.Ethiopia,
		"supported": cfg.Supported,
	})
}

// WalletChrome returns DB-backed wallet/payout UI strings (fail closed).
func (a *PaymentsAPI) WalletChrome(w http.ResponseWriter, r *http.Request) {
	unavailable := walletChromeString(a.Settings, r.Context(), "wallet_chrome_unavailable")
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable})
		return
	}
	raw, err := a.Settings.WalletChromeJSON(r.Context())
	if err != nil || len(raw) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable})
		return
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable})
		return
	}
	required := []string{
		"payout_method_saved", "payout_request_submitted", "payout_phone_required",
		"payout_method_section", "payout_request_section", "payout_phone_label",
		"payout_provider_label", "payout_account_label", "payout_save_action",
		"payout_request_action", "payout_amount_label", "payout_phone_hint",
		"payout_method_save_failed", "payout_request_failed",
		"payout_amount_currency_required", "wallet_chrome_unavailable",
		"sign_in_required", "sign_in_required_checkout",
		"page_title", "balance_label", "balance_pending", "country_code_label",
		"country_code_hint", "top_up_amount_label", "top_up_amount_placeholder", "top_up_action",
		"payout_amount_placeholder",
		"refresh_action", "detect_location_action",
		"location_unavailable", "location_geo_failed", "country_unresolved",
		"payment_route_unavailable", "payment_route_prefix", "payment_route_separator",
		"payout_required_marker", "paren_open", "paren_close", "amount_currency_separator",
		"wallet_unavailable", "wallet_load_failed", "country_required_checkout",
		"invalid_top_up_amount", "checkout_unavailable", "checkout_ready",
		"manual_accounts_title", "banks_loading", "banks_empty",
		"bank_name_prefix", "bank_account_prefix", "bank_mobile_prefix", "bank_currency_prefix",
		"copy_action", "toast_copied", "toast_copy_failed",
		"bank_copy_account_label", "bank_copy_mobile_label", "bank_copy_name_label",
		"cancel_action",
		"submit_receipt_title", "receipt_image_label",
		"receipt_uploaded_prefix", "submit_receipt_action", "receipt_upload_failed",
		"receipt_submitted", "receipt_submit_failed", "receipt_intent_unavailable", "checkout_failed",
		"location_currency_unresolved", "document_kyc_required",
		"organizer_payout_section_blurb",
		"list_page_size", "empty_value",
		"link_transactions_label", "link_receipts_label",
		"link_transactions_href", "link_receipts_href", "link_wallet_href",
		"link_manual_transfer_label", "link_manual_transfer_href",
		"manual_transfer_page_title", "manual_transfer_page_blurb", "manual_transfer_unavailable",
		"list_empty_receipts", "list_empty_transactions", "list_detail_title",
		"list_action_submit_receipt", "list_awaiting_proof_blurb",
		"dialog_close_label",
		"receipt_view_detail", "receipt_reviewed_at_label", "receipt_intent_id_label",
		"receipt_provider_label", "receipt_proof_label", "receipt_open_document_action",
		"list_col_status", "list_col_amount", "list_col_date", "list_col_reference",
		"list_kind_topup", "list_kind_payout",
		"list_kind_event_host_fee", "list_kind_event_entry_paid", "list_kind_event_entry_earned",
		"list_kind_event_entry_commission", "list_kind_event_entry_refund",
		"list_kind_event_entry_clawback", "list_kind_campaign_create_fee",
		"list_kind_prize_pool_guarantee_hold", "list_kind_prize_pool_guarantee_release",
		"list_kind_prize_pool_guarantee_capture",
		"list_status_posted", "list_status_pending", "list_status_approved", "list_status_rejected",
		"list_status_paid", "list_status_awaiting_receipt", "list_status_cancelled", "meta_separator",
		"payout_history_title", "payout_history_empty", "payout_history_amount_label",
		"payout_history_status_label", "payout_history_date_label",
		"payout_history_note_label", "payout_history_reviewed_label",
		"payout_history_load_failed", "payout_history_page_size",
		"payout_methods_empty", "payout_methods_load_failed",
		"payout_method_add_action", "payout_method_edit_action", "payout_method_delete_action",
		"payout_method_delete_confirm", "payout_method_deleted", "payout_method_delete_failed",
		"payout_method_updated", "payout_methods_page_size", "payout_methods_actions_label",
		"age_gate_open_action",
		"receipt_document_title", "receipt_brand_name",
		"receipt_section_bill_to", "receipt_section_from", "receipt_section_details",
		"receipt_section_payment", "receipt_section_transaction", "receipt_section_proof",
		"receipt_label_reference", "receipt_label_amount", "receipt_label_currency", "receipt_label_status",
		"receipt_label_channel", "receipt_label_date", "receipt_label_id", "receipt_label_paid_at",
		"receipt_label_billing_period",
		"receipt_header_meta_separator",
		"receipt_label_subtotal", "receipt_label_tax", "receipt_label_total", "receipt_label_amount_paid",
		"receipt_col_description", "receipt_col_product", "receipt_col_amount", "receipt_col_qty", "receipt_col_unit", "receipt_col_tax_rate",
		"receipt_section_tax_breakdown", "receipt_label_tax_percent", "receipt_label_tax_total",
		"receipt_tax_rate_display", "receipt_line_description",
		"receipt_merchant_via", "receipt_footer",
		"receipt_print_action", "receipt_print_pending",
		"receipt_download_action", "receipt_download_pending",
		"receipt_download_failed", "receipt_download_done", "receipt_download_filename_fmt",
		"receipt_brand_mark_alt", "receipt_proof_caption", "receipt_support_email",
		"err_invalid_json", "err_unauthorized", "err_not_found",
		"err_tx_ref_required", "err_invalid_signature",
	}
	for _, key := range required {
		v, _ := doc[key].(string)
		if !chromeValuePresent(key, v) {
			if unavailable == "" {
				if u, ok := doc["wallet_chrome_unavailable"].(string); ok {
					unavailable = strings.TrimSpace(u)
				}
			}
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": unavailable})
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

// ConsoleCurrencyGet returns DB-backed currency matrix for admin CRUD.
func (a *PaymentsAPI) ConsoleCurrencyGet(w http.ResponseWriter, r *http.Request) {
	a.CurrencyConfig(w, r)
}

type currencyPutBody struct {
	Global    string   `json:"global"`
	Ethiopia  string   `json:"ethiopia"`
	Supported []string `json:"supported"`
}

// ConsoleCurrencyPut persists currency matrix into platform_settings (fail closed).
func (a *PaymentsAPI) ConsoleCurrencyPut(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "location_currency_unresolved")
		return
	}
	var body currencyPutBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	cfg := store.CurrencyConfig{
		Global:    strings.ToUpper(strings.TrimSpace(body.Global)),
		Ethiopia:  strings.ToUpper(strings.TrimSpace(body.Ethiopia)),
		Supported: make([]string, 0, len(body.Supported)),
	}
	for _, c := range body.Supported {
		c = strings.ToUpper(strings.TrimSpace(c))
		if c != "" {
			cfg.Supported = append(cfg.Supported, c)
		}
	}
	if err := a.Settings.SetCurrency(r.Context(), cfg); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	out := a.Settings.Currency()
	writeJSON(w, http.StatusOK, map[string]any{
		"global":    out.Global,
		"ethiopia":  out.Ethiopia,
		"supported": out.Supported,
	})
}

// ConsoleGeoPaymentGet returns DB geo_payment (domestic ISO + localhost invent city).
func (a *PaymentsAPI) ConsoleGeoPaymentGet(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "location_unavailable")
		return
	}
	cfg := a.Settings.GeoPayment()
	if cfg.Source != "database" || cfg.EthiopiaCountry == "" || cfg.PrivateDefaultCity == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "location_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ethiopia_country":       cfg.EthiopiaCountry,
		"private_default_city":   cfg.PrivateDefaultCity,
		"private_default_region": cfg.PrivateDefaultRegion,
	})
}

type geoPaymentPutBody struct {
	EthiopiaCountry      string `json:"ethiopia_country"`
	PrivateDefaultCity   string `json:"private_default_city"`
	PrivateDefaultRegion string `json:"private_default_region"`
}

// ConsoleGeoPaymentPut persists geo_payment into platform_settings (fail closed).
func (a *PaymentsAPI) ConsoleGeoPaymentPut(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "location_unavailable")
		return
	}
	var body geoPaymentPutBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	if err := a.Settings.SetGeoPayment(r.Context(), store.GeoPaymentConfig{
		EthiopiaCountry:      body.EthiopiaCountry,
		PrivateDefaultCity:   body.PrivateDefaultCity,
		PrivateDefaultRegion: body.PrivateDefaultRegion,
	}); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	cfg := a.Settings.GeoPayment()
	writeJSON(w, http.StatusOK, map[string]any{
		"ethiopia_country":       cfg.EthiopiaCountry,
		"private_default_city":   cfg.PrivateDefaultCity,
		"private_default_region": cfg.PrivateDefaultRegion,
	})
}

func (a *PaymentsAPI) Wallet(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	// Server geo only (reference pay chain; ignore client country_code / profile).
	cc := a.payerCountry(r)
	if cc == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "country_required_checkout")
		return
	}
	snap := a.Payments.WalletSnapshot(r.Context(), userID, cc)
	if src, _ := snap["source"].(string); src != "database" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "location_currency_unresolved")
		return
	}
	if cur, _ := snap["currency"].(string); cur == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "country_unresolved")
		return
	}
	delete(snap, "source")
	writeJSON(w, http.StatusOK, snap)
}

func (a *PaymentsAPI) Banks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"banks": payments.PublicBanks(a.Payments.ListBanks())})
}

type manualReceiptBody struct {
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	ReceiptURL  string  `json:"receipt_url"`
	CountryCode string  `json:"country_code"`
	IntentID    string  `json:"intent_id,omitempty"`
}

func (a *PaymentsAPI) UploadReceipt(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Avatars == nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "receipt_upload_failed")
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "receipt_upload_failed")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "receipt_upload_failed")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "receipt_upload_failed")
		return
	}
	url, err := a.Avatars.UploadReceiptImage(userID, header.Filename, header.Header.Get("Content-Type"), data)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "receipt_upload_failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"receipt_url": url})
}

func (a *PaymentsAPI) SubmitReceipt(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	var body manualReceiptBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	if body.Currency == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_amount_currency_required")
		return
	}
	payerCC := a.payerCountry(r)
	if payerCC == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "country_required_checkout")
		return
	}
	// Manual receipt is a cash top-up path - same RMG gates as checkout.
	if !requireCashGate(w, r, a.Cash, a.Users, a.Settings, payerCC) {
		return
	}
	route := payments.ResolveRoute(payerCC, a.Payments.Flags(), a.Payments.CurrencyConfig(), a.Payments.EthiopiaCountry())
	if err := route.Validate(); err != nil || route.Provider != "manual" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payment_route_unavailable")
		return
	}
	if !strings.EqualFold(body.Currency, route.Currency) {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "location_currency_unresolved")
		return
	}
	// Reference is no longer collected on upload; store empty for new rows (column kept for history).
	rec, err := a.Payments.SubmitManualReceipt(
		r.Context(),
		userID,
		body.Amount,
		body.Currency,
		"",
		body.ReceiptURL,
		body.IntentID,
	)
	if err != nil {
		if errors.Is(err, payments.ErrReceiptIntentUnavailable) {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusConflict, "receipt_intent_unavailable")
			return
		}
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "receipt_submit_failed")
		return
	}
	// In-app admin notifs need DB; Telegram notify only needs Settings (fail-open).
	// Keep them independent so notify is never accidentally gated on EmitAdmins.
	uname := userID
	phone := ""
	if a.Users != nil {
		if u, err := a.Users.GetByID(r.Context(), userID); err == nil && u != nil {
			uname = u.Username
			if u.PrimaryPhone != nil {
				phone = strings.TrimSpace(*u.PrimaryPhone)
			}
		}
	}
	if a.DB != nil && a.DB.Ready() && a.Settings != nil {
		args := notifications.MoneyArgs(rec.Amount, rec.Currency)
		notifications.EmitAdmins(r.Context(), a.DB.Pool, a.Settings.ClientEnums().ConsoleRoles,
			notifications.KindAdminReceiptPending, "receipt_pending:"+rec.ID, rec.ID,
			append([]string{uname}, args...)...)
	}
	if a.Settings != nil {
		_ = a.Settings.ReloadTelegramOpsBot(r.Context())
		ops := a.Settings.TelegramOpsBot()
		telegramops.NotifyReceiptPending(r.Context(), a.Settings, telegramops.ReceiptPendingPayload{
			Amount:          rec.Amount,
			Currency:        rec.Currency,
			SenderName:      uname,
			SenderPhone:     phone,
			ScreenshotURL:   rec.ReceiptURL,
			RelatedEntityID: rec.ID,
			NotificationData: map[string]any{
				"receipt_id":    rec.ID,
				"user_id":       rec.UserID,
				"provider":      payments.PublicChannel(rec.Provider),
				"intent_id":     rec.IntentID,
				"product_label": ops.ProductLabel,
				"notify_title":  ops.ReceiptNotifyTitle,
				"is_manual":     true,
			},
		})
	}
	created := map[string]any{
		"id":          rec.ID,
		"amount":      rec.Amount,
		"currency":    rec.Currency,
		"provider":    payments.PublicChannel(rec.Provider),
		"reference":   rec.Reference,
		"receipt_url": rec.ReceiptURL,
		"status":      rec.Status,
		"created_at":  rec.CreatedAt,
	}
	if rec.ReviewedAt != nil {
		created["reviewed_at"] = *rec.ReviewedAt
	}
	writeJSON(w, http.StatusCreated, created)
}

func (a *PaymentsAPI) ListReceipts(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	raw, total, listErr := a.Payments.ListPendingReceiptsPaged(r.Context(), params.Skip, params.Limit, q, status)
	if listErr != nil {
		writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "toast_receipt_failed")
		return
	}
	out := make([]map[string]any, 0, len(raw))
	for _, rec := range raw {
		username := ""
		email := ""
		if a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), rec.UserID); err == nil && u != nil {
				username = strings.TrimSpace(u.Username)
				if u.Email != nil {
					email = strings.TrimSpace(*u.Email)
				}
			}
		}
		row := map[string]any{
			"id":             rec.ID,
			"user_id":        rec.UserID,
			"username":       username,
			"amount":         rec.Amount,
			"currency":       rec.Currency,
			"provider":       payments.PublicChannel(rec.Provider),
			"reference":      rec.Reference,
			"receipt_url":    rec.ReceiptURL,
			"status":         rec.Status,
			"display_status": payments.ReceiptDisplayStatus(rec.Status),
			"created_at":     rec.CreatedAt,
		}
		if email != "" {
			row["email"] = email
		}
		if id := strings.TrimSpace(rec.IntentID); id != "" {
			row["intent_id"] = id
		}
		if rec.ReviewedAt != nil {
			row["reviewed_at"] = *rec.ReviewedAt
		}
		out = append(out, row)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"receipts": out, "meta": meta})
}

// ListMyReceipts returns the signed-in player's submitted payment proofs.
func (a *PaymentsAPI) ListMyReceipts(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	raw, total := a.Payments.ListUserReceiptsPaged(r.Context(), userID, params.Skip, params.Limit, q)
	out := make([]map[string]any, 0, len(raw))
	for _, rec := range raw {
		row := map[string]any{
			"id":             rec.ID,
			"user_id":        rec.UserID,
			"amount":         rec.Amount,
			"currency":       rec.Currency,
			"provider":       payments.PublicChannel(rec.Provider),
			"reference":      rec.Reference,
			"receipt_url":    rec.ReceiptURL,
			"status":         rec.Status,
			"display_status": payments.ReceiptDisplayStatus(rec.Status),
			"created_at":     rec.CreatedAt,
		}
		if id := strings.TrimSpace(rec.IntentID); id != "" {
			row["intent_id"] = id
		}
		if rec.ReviewedAt != nil {
			row["reviewed_at"] = *rec.ReviewedAt
		}
		out = append(out, row)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"receipts": out, "meta": meta})
}

// ListConsoleTransactions returns platform-wide money movements for console OpsDataTable.
func (a *PaymentsAPI) ListConsoleTransactions(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	kind := strings.TrimSpace(r.URL.Query().Get("kind"))
	raw, total := a.Payments.ListConsoleTransactionsPaged(r.Context(), params.Skip, params.Limit, q, status, kind)
	out := make([]map[string]any, 0, len(raw))
	for _, t := range raw {
		username := ""
		if a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), t.UserID); err == nil && u != nil {
				username = strings.TrimSpace(u.Username)
			}
		}
		row := map[string]any{
			"id":         t.ID,
			"user_id":    t.UserID,
			"username":   username,
			"kind":       t.Kind,
			"amount":     t.Amount,
			"currency":   t.Currency,
			"status":     t.Status,
			"reference":  t.Reference,
			"provider":   t.Provider,
			"created_at": t.CreatedAt,
		}
		if u := strings.TrimSpace(t.ReceiptURL); u != "" {
			row["receipt_url"] = u
		}
		if rid := strings.TrimSpace(t.ReceiptID); rid != "" {
			row["receipt_id"] = rid
		}
		if st := strings.TrimSpace(t.ReceiptStatus); st != "" {
			row["receipt_status"] = st
		}
		out = append(out, row)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"transactions": out, "meta": meta})
}

// ListMyTransactions returns top-ups + payouts for the signed-in player.
func (a *PaymentsAPI) ListMyTransactions(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	raw, total := a.Payments.ListUserTransactionsPaged(r.Context(), userID, params.Skip, params.Limit, q)
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"transactions": raw, "meta": meta})
}

type reviewBody struct {
	Approve bool   `json:"approve"`
	Note    string `json:"note"`
}

func (a *PaymentsAPI) ReviewReceipt(w http.ResponseWriter, r *http.Request) {
	adminID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	var body reviewBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	rec, err := a.Payments.ReviewReceipt(r.Context(), id, adminID, body.Approve, body.Note)
	if err != nil {
		if errors.Is(err, payments.ErrReceiptAlreadyReviewed) {
			// Dual-actuator / stale UI: pending→reviewed already committed (console or bot).
			writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusConflict, "toast_receipt_already_reviewed")
			return
		}
		if errors.Is(err, payments.ErrReceiptNotFound) {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "receipt_not_found")
			return
		}
		writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "toast_receipt_failed")
		return
	}
	displayStatus := payments.ReceiptDisplayStatus(rec.Status)
	if a.DB != nil && a.DB.Ready() {
		// Notif body uses display status (approved → paid) so players see Paid, not Approved.
		if statusLabel := walletListStatusLabel(r.Context(), a.Settings, displayStatus); statusLabel != "" {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, rec.UserID, notifications.KindPlayerReceiptReviewed,
				"receipt_reviewed:"+rec.ID, rec.ID, statusLabel)
		}
		if body.Approve {
			args := notifications.MoneyArgs(rec.Amount, rec.Currency)
			notifications.EmitPlayer(r.Context(), a.DB.Pool, rec.UserID, notifications.KindPlayerWalletCredited,
				"wallet_credited:receipt:"+rec.ID, "", args...)
		}
	}
	reviewed := map[string]any{
		"id":             rec.ID,
		"user_id":        rec.UserID,
		"amount":         rec.Amount,
		"currency":       rec.Currency,
		"provider":       payments.PublicChannel(rec.Provider),
		"reference":      rec.Reference,
		"receipt_url":    rec.ReceiptURL,
		"status":         rec.Status,
		"display_status": displayStatus,
		"created_at":     rec.CreatedAt,
	}
	if rec.ReviewedAt != nil {
		reviewed["reviewed_at"] = *rec.ReviewedAt
	}
	writeJSON(w, http.StatusOK, reviewed)
}

func (a *PaymentsAPI) LocalWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	// Prefer neutral header; accept gateway vendor headers for compatibility.
	sig := r.Header.Get("X-Local-Signature")
	if sig == "" {
		sig = r.Header.Get("Chapa-Signature")
	}
	if sig == "" {
		sig = r.Header.Get("x-chapa-signature")
	}
	if !a.Payments.VerifyChapaSignature(raw, sig) {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_invalid_signature")
		return
	}
	var payload struct {
		TxRef  string `json:"tx_ref"`
		Status string `json:"status"`
		Data   struct {
			TxRef  string `json:"tx_ref"`
			Status string `json:"status"`
		} `json:"data"`
	}
	_ = json.Unmarshal(raw, &payload)
	txRef := payload.TxRef
	if txRef == "" {
		txRef = payload.Data.TxRef
	}
	status := payload.Status
	if status == "" {
		status = payload.Data.Status
	}
	if txRef == "" {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	// Empty status is not success; only explicit gateway success strings credit wallets.
	if status == "success" || status == "successful" {
		if _, err := a.Payments.MarkPaidByTxRef(r.Context(), txRef); err != nil {
			writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *PaymentsAPI) InternationalWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	sig := r.Header.Get("Paddle-Signature")
	if sig == "" {
		sig = r.Header.Get("X-International-Signature")
	}
	if !a.Payments.VerifyPaddleSignature(raw, sig) {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_invalid_signature")
		return
	}
	var payload struct {
		EventType string `json:"event_type"`
		Data      struct {
			CustomData map[string]any `json:"custom_data"`
			Status     string         `json:"status"`
		} `json:"data"`
	}
	_ = json.Unmarshal(raw, &payload)
	txRef, _ := payload.Data.CustomData["tx_ref"].(string)
	if txRef != "" && (payload.EventType == "transaction.completed" || payload.Data.Status == "completed") {
		_, _ = a.Payments.MarkPaidByTxRef(r.Context(), txRef)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *PaymentsAPI) StubComplete(w http.ResponseWriter, r *http.Request) {
	// Local smoke only. Never expose payment completion or intent details publicly.
	if os.Getenv("DAMA_ALLOW_PAYMENT_STUB") != "1" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "err_not_found")
		return
	}
	txRef := r.URL.Query().Get("tx_ref")
	if txRef == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_tx_ref_required")
		return
	}
	intent, err := a.Payments.MarkPaidByTxRef(r.Context(), txRef)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "err_not_found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "paid",
		"tx_ref": intent.TxRef,
	})
}

// GetMyReceipt returns one payment receipt owned by the signed-in user (Trim GET /billing/receipts/{id}).
func (a *PaymentsAPI) GetMyReceipt(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	rec, err := a.Payments.GetUserReceipt(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, payments.ErrReceiptNotFound) {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "receipt_not_found")
			return
		}
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "receipt_download_failed")
		return
	}
	if rec == nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "receipt_not_found")
		return
	}
	writeJSON(w, http.StatusOK, a.receiptDetailJSON(r, rec, false))
}

// GetConsoleReceipt returns one payment receipt for console reviewers.
func (a *PaymentsAPI) GetConsoleReceipt(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	rec, err := a.Payments.GetReceipt(r.Context(), id)
	if err != nil {
		if errors.Is(err, payments.ErrReceiptNotFound) {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "receipt_not_found")
			return
		}
		writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "toast_receipt_failed")
		return
	}
	if rec == nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "receipt_not_found")
		return
	}
	writeJSON(w, http.StatusOK, a.receiptDetailJSON(r, rec, true))
}

func (a *PaymentsAPI) receiptDetailJSON(r *http.Request, rec *payments.Receipt, console bool) map[string]any {
	row := map[string]any{
		"id":             rec.ID,
		"user_id":        rec.UserID,
		"amount":         rec.Amount,
		"currency":       rec.Currency,
		"provider":       payments.PublicChannel(rec.Provider),
		"reference":      rec.Reference,
		"receipt_url":    rec.ReceiptURL,
		"status":         rec.Status,
		"display_status": payments.ReceiptDisplayStatus(rec.Status),
		"created_at":     rec.CreatedAt,
	}
	if id := strings.TrimSpace(rec.IntentID); id != "" {
		row["intent_id"] = id
	}
	if rec.ReviewedAt != nil {
		row["reviewed_at"] = *rec.ReviewedAt
	}
	if n := strings.TrimSpace(rec.ReviewNote); n != "" {
		row["review_note"] = n
	}
	if a.Users != nil && strings.TrimSpace(rec.UserID) != "" {
		if u, err := a.Users.GetByID(r.Context(), rec.UserID); err == nil && u != nil {
			row["username"] = strings.TrimSpace(u.Username)
			if u.Email != nil {
				if em := strings.TrimSpace(*u.Email); em != "" {
					row["email"] = em
				}
			}
		}
	}
	pdfPath := "/payments/receipts/" + rec.ID + "/pdf"
	if console {
		pdfPath = "/payments/console/receipts/" + rec.ID + "/pdf"
	}
	row["first_party_pdf_href"] = pdfPath
	return row
}

// DownloadMyReceiptPDF serves first-party payment receipt PDF for the signed-in owner (Trim parity).
func (a *PaymentsAPI) DownloadMyReceiptPDF(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	rec, err := a.Payments.GetUserReceipt(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, payments.ErrReceiptNotFound) {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "receipt_not_found")
			return
		}
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "receipt_download_failed")
		return
	}
	a.writeReceiptPDF(w, r, rec)
}

// DownloadConsoleReceiptPDF serves first-party payment receipt PDF for console reviewers.
func (a *PaymentsAPI) DownloadConsoleReceiptPDF(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	rec, err := a.Payments.GetReceipt(r.Context(), id)
	if err != nil {
		if errors.Is(err, payments.ErrReceiptNotFound) {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "receipt_not_found")
			return
		}
		writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "toast_receipt_failed")
		return
	}
	a.writeReceiptPDF(w, r, rec)
}

func (a *PaymentsAPI) writeReceiptPDF(w http.ResponseWriter, r *http.Request, rec *payments.Receipt) {
	chrome, ok := a.receiptPDFChrome(r, rec)
	if !ok {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "receipt_download_failed")
		return
	}
	billName, billEmail := "", ""
	if a.Users != nil && strings.TrimSpace(rec.UserID) != "" {
		if u, err := a.Users.GetByID(r.Context(), rec.UserID); err == nil && u != nil {
			billName = strings.TrimSpace(u.Username)
			if u.Email != nil {
				billEmail = strings.TrimSpace(*u.Email)
			}
		}
	}
	pdf, err := payments.BuildPaymentReceiptPDF(rec, billName, billEmail, chrome)
	if err != nil || len(pdf) < 40 {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "receipt_download_failed")
		return
	}
	filename := payments.ReceiptPDFFilename(chrome.FilenameFmt, rec.ID)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.Header().Set("X-Dama-Download-Filename", filename)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdf)
}

func (a *PaymentsAPI) receiptPDFChrome(r *http.Request, rec *payments.Receipt) (payments.ReceiptPDFChrome, bool) {
	raw, err := a.Settings.WalletChromeJSON(r.Context())
	if err != nil || len(raw) == 0 {
		return payments.ReceiptPDFChrome{}, false
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return payments.ReceiptPDFChrome{}, false
	}
	str := func(k string) string {
		v, _ := doc[k].(string)
		return strings.TrimSpace(v)
	}
	// Space is a valid amount/currency / meta separator - do not TrimSpace.
	rawSep, _ := doc["amount_currency_separator"].(string)
	rawMetaSep, _ := doc["receipt_header_meta_separator"].(string)
	displayStatus := payments.ReceiptDisplayStatus(rec.Status)
	statusKey := "list_status_" + strings.ToLower(strings.TrimSpace(displayStatus))
	statusLabel := str(statusKey)
	if statusLabel == "" {
		statusLabel = strings.TrimSpace(displayStatus)
	}
	out := payments.ReceiptPDFChrome{
		DocumentTitle:       str("receipt_document_title"),
		BrandName:           str("receipt_brand_name"),
		StatusPaid:          strings.EqualFold(displayStatus, "paid"),
		SectionBillTo:       str("receipt_section_bill_to"),
		SectionFrom:         str("receipt_section_from"),
		SectionDetails:      str("receipt_section_details"),
		SectionPayment:      str("receipt_section_payment"),
		SectionTransaction:  str("receipt_section_transaction"),
		LabelReference:      str("receipt_label_reference"),
		LabelAmount:         str("receipt_label_amount"),
		LabelCurrency:       str("receipt_label_currency"),
		LabelStatus:         str("receipt_label_status"),
		LabelChannel:        str("receipt_label_channel"),
		LabelDate:           str("receipt_label_date"),
		LabelID:             str("receipt_label_id"),
		LabelPaidAt:         str("receipt_label_paid_at"),
		LabelBillingPeriod:  str("receipt_label_billing_period"),
		HeaderMetaSep:       rawMetaSep,
		LabelSubtotal:       str("receipt_label_subtotal"),
		LabelTax:            str("receipt_label_tax"),
		LabelTotal:          str("receipt_label_total"),
		LabelAmountPaid:     str("receipt_label_amount_paid"),
		ColDescription:      str("receipt_col_description"),
		ColProduct:          str("receipt_col_product"),
		ColAmount:           str("receipt_col_amount"),
		ColQty:              str("receipt_col_qty"),
		ColUnit:             str("receipt_col_unit"),
		ColTaxRate:          str("receipt_col_tax_rate"),
		TaxRateDisplay:      str("receipt_tax_rate_display"),
		SectionTaxBreakdown: str("receipt_section_tax_breakdown"),
		LabelTaxPercent:     str("receipt_label_tax_percent"),
		LabelTaxTotal:       str("receipt_label_tax_total"),
		LineDescription:     str("receipt_line_description"),
		MerchantVia:         str("receipt_merchant_via"),
		Footer:              str("receipt_footer"),
		SupportEmail:        str("receipt_support_email"),
		AmountSep:           rawSep,
		EmptyValue:          str("empty_value"),
		StatusLabel:         statusLabel,
		FilenameFmt:         str("receipt_download_filename_fmt"),
	}
	return out, out.Complete()
}
