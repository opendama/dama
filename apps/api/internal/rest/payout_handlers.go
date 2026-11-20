package rest

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
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

type PayoutAPI struct {
	Payouts  *store.PayoutStore
	Payments *payments.Service
	Cash     *store.CashRmgStore
	Docs     *store.KycDocumentStore
	Users    *store.UserStore
	Settings *store.SettingsStore
	Flags    *store.FlagStore
	Locate   *geo.Resolver
	DB       *db.Handle
}

// When cash phone OTP is off, mirroring a payout phone onto primary_phone completes KYC
// (same rule as PUT /me/phone-kyc).
func (a *PayoutAPI) confirmPhoneKycIfOtpOff(r *http.Request, userID string) {
	if a.Users == nil || strings.TrimSpace(userID) == "" {
		return
	}
	otpRequired := false
	if a.Flags != nil {
		otpRequired = a.Flags.Get(r.Context()).CashPhoneOtpRequired
	}
	if otpRequired {
		return
	}
	_ = a.Users.MarkPhoneKycVerified(r.Context(), userID)
}

func (a *PayoutAPI) GetMethod(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	m, err := a.Payouts.GetMethod(r.Context(), userID)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "payout_method_not_set")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func (a *PayoutAPI) UpsertMethod(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	var body struct {
		Provider    string `json:"provider"`
		AccountName string `json:"account_name"`
		Phone       string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	m, err := a.Payouts.UpsertMethod(r.Context(), userID, body.Provider, body.AccountName, body.Phone)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_method_save_failed")
		return
	}
	writeJSON(w, http.StatusOK, m)
}

func (a *PayoutAPI) ListMethods(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	pageSizeRaw := strings.TrimSpace(walletChromeString(a.Settings, r.Context(), "payout_methods_page_size"))
	n, err := strconv.Atoi(pageSizeRaw)
	if err != nil || n <= 0 || n > 200 {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "payout_methods_load_failed")
		return
	}
	params.Limit = n
	list, total, err := a.Payouts.ListMethodsForUser(r.Context(), userID, params.Skip, params.Limit)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "payout_methods_load_failed")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"methods": list, "meta": meta})
}

func (a *PayoutAPI) CreateMethod(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	var body struct {
		Provider    string `json:"provider"`
		AccountName string `json:"account_name"`
		Phone       string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	m, err := a.Payouts.CreateMethod(r.Context(), userID, body.Provider, body.AccountName, body.Phone)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_method_save_failed")
		return
	}
	a.confirmPhoneKycIfOtpOff(r, userID)
	writeJSON(w, http.StatusCreated, m)
}

func (a *PayoutAPI) UpdateMethod(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var body struct {
		Provider    string `json:"provider"`
		AccountName string `json:"account_name"`
		Phone       string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	m, err := a.Payouts.UpdateMethod(r.Context(), userID, id, body.Provider, body.AccountName, body.Phone)
	if err != nil {
		if err == store.ErrNotFound {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "payout_method_not_set")
			return
		}
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_method_save_failed")
		return
	}
	a.confirmPhoneKycIfOtpOff(r, userID)
	writeJSON(w, http.StatusOK, m)
}

func (a *PayoutAPI) DeleteMethod(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if err := a.Payouts.DeleteMethod(r.Context(), userID, id); err != nil {
		if err == store.ErrNotFound {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "payout_method_not_set")
			return
		}
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_method_delete_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *PayoutAPI) CreateRequest(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	var body struct {
		Amount   float64 `json:"amount"`
		Currency string  `json:"currency"`
		MethodID string  `json:"method_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	body.Currency = strings.ToUpper(strings.TrimSpace(body.Currency))
	if body.Amount <= 0 || body.Currency == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_amount_currency_required")
		return
	}
	payerCC := resolvePayerCountryFromRequest(r, a.Locate, a.Settings, 0, 0)
	if payerCC == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "country_required_checkout")
		return
	}
	if !requireCashGate(w, r, a.Cash, a.Users, a.Settings, payerCC) {
		return
	}
	expectedCur := ""
	if a.Settings != nil {
		expectedCur = strings.ToUpper(strings.TrimSpace(a.Settings.CurrencyForCountry(payerCC)))
	}
	if expectedCur == "" || !strings.EqualFold(body.Currency, expectedCur) {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "location_currency_unresolved")
		return
	}
	// Phase C: government-ID document KYC required before cashout when policy says so.
	if a.Cash != nil && a.Cash.Ready() && a.Cash.Policy().RequireDocumentKycForPayout {
		policy := a.Cash.Policy()
		ok := false
		if a.Docs != nil {
			ok, _ = a.Docs.HasApprovedDocument(r.Context(), userID, policy.DocumentKycApprovedStatus)
		}
		if !ok {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusForbidden, "document_kyc_required")
			return
		}
	}
	// Gate: bank/mobile-money details required (optional method_id, else most recent).
	var method *store.PayoutMethod
	var err error
	if mid := strings.TrimSpace(body.MethodID); mid != "" {
		method, err = a.Payouts.GetMethodByID(r.Context(), userID, mid)
	} else {
		method, err = a.Payouts.GetMethod(r.Context(), userID)
	}
	if err != nil || method == nil || len(strings.TrimSpace(method.Phone)) < 8 {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_phone_required")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	initialStatus := a.Cash.Policy().DefaultPayoutStatus
	if a.Payments != nil {
		if err := a.Payments.DebitWallet(r.Context(), userID, body.Amount, body.Currency); err != nil {
			if strings.Contains(err.Error(), "insufficient") {
				writeWalletChromeError(w, a.Settings, r.Context(), http.StatusConflict, "wallet_insufficient_balance")
				return
			}
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "wallet_debit_failed")
			return
		}
	}
	req, err := a.Payouts.CreateRequest(r.Context(), userID, body.Amount, body.Currency, initialStatus, method)
	if err != nil {
		if a.Payments != nil {
			if creditErr := a.Payments.CreditWallet(r.Context(), userID, body.Amount, body.Currency); creditErr != nil {
				writeWalletChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "wallet_debit_failed")
				return
			}
			if a.DB != nil && a.DB.Ready() {
				args := notifications.MoneyArgs(body.Amount, body.Currency)
				notifications.EmitPlayer(r.Context(), a.DB.Pool, userID, notifications.KindPlayerWalletCredited,
					"wallet_credited:payout_create_fail:"+userID+":"+fmt.Sprintf("%.2f", body.Amount), "", args...)
			}
		}
		if err == store.ErrPayoutPhoneRequired {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_phone_required")
			return
		}
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "payout_request_failed")
		return
	}
	// In-app admin notifs need DB; Telegram notify only needs Settings (fail-open).
	uname := userID
	phone := strings.TrimSpace(req.Phone)
	if a.Users != nil {
		if u, err := a.Users.GetByID(r.Context(), userID); err == nil && u != nil {
			uname = u.Username
			if phone == "" && u.PrimaryPhone != nil {
				phone = strings.TrimSpace(*u.PrimaryPhone)
			}
		}
	}
	if a.DB != nil && a.DB.Ready() && a.Settings != nil {
		args := notifications.MoneyArgs(req.Amount, req.Currency)
		notifications.EmitAdmins(r.Context(), a.DB.Pool, a.Settings.ClientEnums().ConsoleRoles,
			notifications.KindAdminPayoutPending, "payout_pending:"+req.ID, req.ID,
			append([]string{uname}, args...)...)
	}
	if a.Settings != nil {
		_ = a.Settings.ReloadTelegramOpsBot(r.Context())
		ops := a.Settings.TelegramOpsBot()
		telegramops.NotifyPayoutPending(r.Context(), a.Settings, telegramops.PayoutPendingPayload{
			Amount:          req.Amount,
			Currency:        req.Currency,
			SenderName:      uname,
			SenderPhone:     phone,
			PayoutMethod:    req.Provider,
			RelatedEntityID: req.ID,
			NotificationData: map[string]any{
				"payout_id":     req.ID,
				"user_id":       req.UserID,
				"status":        req.Status,
				"product_label": ops.ProductLabel,
				"notify_title":  ops.PayoutNotifyTitle,
			},
		})
	}
	writeJSON(w, http.StatusCreated, req)
}

func (a *PayoutAPI) ListMine(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	pageSizeRaw := strings.TrimSpace(walletChromeString(a.Settings, r.Context(), "payout_history_page_size"))
	n, err := strconv.Atoi(pageSizeRaw)
	if err != nil || n <= 0 || n > 200 {
		msg := walletChromeString(a.Settings, r.Context(), "payout_history_load_failed")
		if msg == "" {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "payout_history_page_size")
			return
		}
		writeClientError(w, http.StatusServiceUnavailable, msg)
		return
	}
	params.Limit = n
	// Deep link ?id= seeks once from skip=0 to the page that contains that payout
	// (newest-first). Later pages keep client skip so pager works while ?id= remains.
	focusID := strings.TrimSpace(r.URL.Query().Get("id"))
	if focusID != "" && params.Skip == 0 {
		if seekSkip, seekErr := a.Payouts.SeekSkipForUserRequest(r.Context(), userID, focusID, n); seekErr == nil {
			params.Skip = seekSkip
		}
	}
	list, total, err := a.Payouts.ListRequestsForUser(r.Context(), userID, params.Skip, params.Limit)
	if err != nil {
		msg := walletChromeString(a.Settings, r.Context(), "payout_history_load_failed")
		if msg == "" {
			writeWalletChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "payout_history_load_failed")
			return
		}
		writeClientError(w, http.StatusInternalServerError, msg)
		return
	}
	out := make([]store.PayoutRequest, 0, len(list))
	for i := range list {
		row := list[i]
		if label := walletListStatusLabel(r.Context(), a.Settings, row.Status); label != "" {
			row.StatusLabel = label
		}
		out = append(out, row)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"payouts": out, "meta": meta})
}

func (a *PayoutAPI) ListConsole(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	list, total, err := a.Payouts.ListRequestsPaged(r.Context(), status, params.Skip, params.Limit, q)
	if err != nil {
		reviewFail := adminPaymentsChromeString(a.Settings, r.Context(), "payout_review_failed")
		if reviewFail == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusInternalServerError, reviewFail)
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"payouts": list, "meta": meta})
}

func (a *PayoutAPI) ReviewConsole(w http.ResponseWriter, r *http.Request) {
	reviewerID := auth.UserIDFromContext(r.Context())
	if reviewerID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	policy := a.Cash.Policy()
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var body struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	body.Status = strings.TrimSpace(body.Status)
	allowed := false
	for _, s := range policy.PayoutStatuses {
		if s == body.Status {
			allowed = true
			break
		}
	}
	reviewFail := adminPaymentsChromeString(a.Settings, r.Context(), "payout_review_failed")
	if !allowed || id == "" {
		if reviewFail == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusBadRequest, reviewFail)
		return
	}
	current, err := a.Payouts.GetRequest(r.Context(), id)
	if err != nil {
		if reviewFail == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		if errors.Is(err, store.ErrPayoutNotFound) {
			writeClientError(w, http.StatusNotFound, reviewFail)
			return
		}
		writeClientError(w, http.StatusInternalServerError, reviewFail)
		return
	}
	if current == nil {
		if reviewFail == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusNotFound, reviewFail)
		return
	}
	// Enforce DB policy transitions: approvable → approved|rejected; approved → paid.
	switch body.Status {
	case policy.ApprovedPayoutStatus, policy.RejectedPayoutStatus:
		if current.Status != policy.ApprovablePayoutStatus {
			writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusConflict, "payout_transition_conflict")
			return
		}
	case policy.PaidPayoutStatus:
		if current.Status != policy.ApprovedPayoutStatus {
			writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusConflict, "payout_transition_conflict")
			return
		}
	default:
		if reviewFail == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusBadRequest, reviewFail)
		return
	}
	fromStatus := policy.ApprovablePayoutStatus
	if body.Status == policy.PaidPayoutStatus {
		fromStatus = policy.ApprovedPayoutStatus
	}
	var req *store.PayoutRequest
	if body.Status == policy.RejectedPayoutStatus {
		if a.Payments == nil {
			if reviewFail == "" {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
				return
			}
			writeClientError(w, http.StatusServiceUnavailable, reviewFail)
			return
		}
		// Atomic reject+refund - status and wallet credit commit together.
		req, err = a.Payments.RejectPayoutAndRefund(r.Context(), id, fromStatus, body.Status, body.Note, reviewerID)
		if err != nil {
			if reviewFail == "" {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
				return
			}
			if errors.Is(err, store.ErrPayoutNotFound) {
				writeClientError(w, http.StatusNotFound, reviewFail)
				return
			}
			if errors.Is(err, store.ErrPayoutTransitionConflict) {
				writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusConflict, "payout_transition_conflict")
				return
			}
			writeClientError(w, http.StatusInternalServerError, reviewFail)
			return
		}
		if a.DB != nil && a.DB.Ready() {
			args := notifications.MoneyArgs(req.Amount, req.Currency)
			notifications.EmitPlayer(r.Context(), a.DB.Pool, req.UserID, notifications.KindPlayerWalletCredited,
				"wallet_credited:payout_reject:"+req.ID, req.ID, args...)
		}
	} else {
		req, err = a.Payouts.ReviewRequest(r.Context(), id, fromStatus, body.Status, body.Note, reviewerID)
		if err != nil {
			if reviewFail == "" {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
				return
			}
			if errors.Is(err, store.ErrPayoutNotFound) {
				writeClientError(w, http.StatusNotFound, reviewFail)
				return
			}
			if errors.Is(err, store.ErrPayoutTransitionConflict) {
				writeAdminPaymentsChromeError(w, a.Settings, r.Context(), http.StatusConflict, "payout_transition_conflict")
				return
			}
			writeClientError(w, http.StatusInternalServerError, reviewFail)
			return
		}
	}
	if a.DB != nil && a.DB.Ready() {
		if statusLabel := walletListStatusLabel(r.Context(), a.Settings, body.Status); statusLabel != "" {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, req.UserID, notifications.KindPlayerPayoutUpdated,
				"payout_updated:"+req.ID+":"+body.Status, req.ID, statusLabel)
		}
	}
	writeJSON(w, http.StatusOK, req)
}
