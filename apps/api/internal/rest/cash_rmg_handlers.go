package rest

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

// CashRmgAPI serves cash/RMG compliance chrome + age/phone gates.
type CashRmgAPI struct {
	Cash     *store.CashRmgStore
	Users    *store.UserStore
	OTP      *store.OTPStore
	Flags    *store.FlagStore
	Settings *store.SettingsStore
	Locate   *geo.Resolver
	Docs     *store.KycDocumentStore
}

func cashUnavailableMsg(cash *store.CashRmgStore) string {
	if cash != nil {
		if msg := strings.TrimSpace(cash.Chrome().CashRmgUnavailable); msg != "" {
			return msg
		}
	}
	return ""
}

func (a *CashRmgAPI) PublicChrome(w http.ResponseWriter, r *http.Request) {
	if a.Cash == nil || !a.Cash.Ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	chrome := a.Cash.Chrome()
	policy := a.Cash.Policy()
	writeJSON(w, http.StatusOK, map[string]any{
		"chrome": chrome,
		"policy": map[string]any{
			"min_age_years":                                   policy.MinAgeYears,
			"allowed_country_codes":                           policy.AllowedCountryCodes,
			"locate_max_age_seconds":                          policy.LocateMaxAgeSeconds,
			"require_locate_for_cash":                         policy.RequireLocateForCash,
			"otp_phone_channel":                               policy.OTPPhoneChannel,
			"payout_statuses":                                 policy.PayoutStatuses,
			"default_payout_status":                           policy.DefaultPayoutStatus,
			"approvable_payout_status":                        policy.ApprovablePayoutStatus,
			"approved_payout_status":                          policy.ApprovedPayoutStatus,
			"rejected_payout_status":                          policy.RejectedPayoutStatus,
			"paid_payout_status":                              policy.PaidPayoutStatus,
			"require_document_kyc_for_payout":                 policy.RequireDocumentKycForPayout,
			"host_guarantee_requires_document_kyc":            policy.HostGuaranteeRequiresDocumentKyc,
			"host_paid_create_requires_phone_kyc":             policy.HostPaidCreateRequiresPhoneKyc,
			"host_concurrent_open_paid_cap_phone_verified":    policy.HostConcurrentOpenPaidCapPhoneVerified,
			"host_concurrent_open_paid_cap_document_verified": policy.HostConcurrentOpenPaidCapDocumentVerified,
			"host_concurrent_open_paid_cap_new_host":          policy.HostConcurrentOpenPaidCapNewHost,
			"host_new_host_settled_paid_threshold":            policy.HostNewHostSettledPaidThreshold,
			"host_reputation_max_open_reports":                policy.HostReputationMaxOpenReports,
			"host_reputation_cancel_rate_bps":                 policy.HostReputationCancelRateBps,
			"host_reputation_cancel_rate_min_sample":          policy.HostReputationCancelRateMinSample,
			"host_trust_tier_unverified":                      policy.HostTrustTierUnverified,
			"host_trust_tier_phone_verified":                  policy.HostTrustTierPhoneVerified,
			"host_trust_tier_document_verified":               policy.HostTrustTierDocumentVerified,
			"document_kyc_types":                              policy.DocumentKycTypes,
			"document_kyc_statuses":                           policy.DocumentKycStatuses,
			"document_kyc_draft_status":                       policy.DocumentKycDraftStatus,
			"document_kyc_pending_status":                     policy.DocumentKycPendingStatus,
			"document_kyc_approved_status":                    policy.DocumentKycApprovedStatus,
			"document_kyc_rejected_status":                    policy.DocumentKycRejectedStatus,
			"document_kyc_passport_type":                      policy.DocumentKycPassportType,
		},
	})
}

func (a *CashRmgAPI) Eligibility(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() || a.Users == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	// Server geo only (reference pay chain; ignore client country_code query).
	country := resolvePayerCountryFromRequest(r, a.Locate, a.Settings, 0, 0)
	u, err := a.Users.GetByID(r.Context(), userID)
	if err != nil {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	phone := ""
	if u.PrimaryPhone != nil {
		phone = strings.TrimSpace(*u.PrimaryPhone)
	}
	phoneKycOK := u.PhoneKycVerifiedAt != nil
	// Self-heal: OTP optional + phone already on file but stamp wiped (e.g. old payout mirror).
	if !phoneKycOK && phone != "" && !a.cashPhoneOtpRequired(r.Context()) {
		if err := a.Users.MarkPhoneKycVerified(r.Context(), userID); err == nil {
			phoneKycOK = true
			if refreshed, err := a.Users.GetByID(r.Context(), userID); err == nil && refreshed != nil {
				u = refreshed
				if u.PrimaryPhone != nil {
					phone = strings.TrimSpace(*u.PrimaryPhone)
				}
			}
		}
	}
	el := a.Cash.EvaluateCash(
		r.Context(),
		userID,
		country,
		u.AgeVerifiedAt != nil,
		phoneKycOK,
		phone,
	)
	el.PrimaryPhone = strings.TrimSpace(phone)
	if u.DateOfBirth != nil {
		el.DateOfBirth = u.DateOfBirth.UTC().Format("2006-01-02")
	}
	if a.Docs != nil && a.Cash.Ready() {
		ok, _ := a.Docs.HasApprovedDocument(r.Context(), userID, a.Cash.Policy().DocumentKycApprovedStatus)
		el.DocumentKycApproved = ok
	}
	writeJSON(w, http.StatusOK, el)
}

type ageGateBody struct {
	DateOfBirth string `json:"date_of_birth"`
}

func (a *CashRmgAPI) SubmitAgeGate(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() || a.Users == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	chrome := a.Cash.Chrome()
	var body ageGateBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.DateOfBirth) == "" {
		writeClientError(w, http.StatusBadRequest, chrome.AgeGateFailed)
		return
	}
	dob, err := time.Parse("2006-01-02", strings.TrimSpace(body.DateOfBirth))
	if err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.AgeGateFailed)
		return
	}
	u, err := a.Users.SetDateOfBirthAgeGate(r.Context(), userID, dob, a.Cash.Policy().MinAgeYears)
	if err != nil {
		if err.Error() == "too_young" {
			writeClientError(w, http.StatusForbidden, chrome.AgeGateTooYoung)
			return
		}
		writeClientError(w, http.StatusBadRequest, chrome.AgeGateFailed)
		return
	}
	out := u.Self()
	stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, out)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"user":    out,
		"message": chrome.AgeGateSuccess,
	})
}

type phoneKycBody struct {
	Phone string `json:"phone"`
}

func (a *CashRmgAPI) SavePhone(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() || a.Users == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	chrome := a.Cash.Chrome()
	var body phoneKycBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.PhoneKycFailed)
		return
	}
	u, err := a.Users.SetPrimaryPhone(r.Context(), userID, body.Phone)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.PhoneKycFailed)
		return
	}
	// When cash phone OTP is off, saving the phone completes KYC (admin toggle).
	if !a.cashPhoneOtpRequired(r.Context()) {
		if err := a.Users.MarkPhoneKycVerified(r.Context(), userID); err != nil {
			writeClientError(w, http.StatusInternalServerError, chrome.PhoneKycFailed)
			return
		}
		u, _ = a.Users.GetByID(r.Context(), userID)
		out := u.Self()
		stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, out)
		writeJSON(w, http.StatusOK, map[string]any{
			"status":  "verified",
			"message": chrome.PhoneKycSuccess,
			"user":    out,
		})
		return
	}
	out := u.Self()
	stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, out)
	writeJSON(w, http.StatusOK, map[string]any{"user": out})
}

// cashPhoneOtpRequired: optional challenge; default off until feature flag enables it.
func (a *CashRmgAPI) cashPhoneOtpRequired(ctx context.Context) bool {
	if a.Flags == nil {
		return false
	}
	return a.Flags.Get(ctx).CashPhoneOtpRequired
}

func (a *CashRmgAPI) StartPhoneOTP(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() || a.OTP == nil || a.Users == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	chrome := a.Cash.Chrome()
	if !a.cashPhoneOtpRequired(r.Context()) {
		writeClientError(w, http.StatusBadRequest, chrome.PhoneKycFailed)
		return
	}
	u, err := a.Users.GetByID(r.Context(), userID)
	if err != nil || u.PrimaryPhone == nil || len(strings.TrimSpace(*u.PrimaryPhone)) < 8 {
		writeClientError(w, http.StatusBadRequest, chrome.PhoneKycFailed)
		return
	}
	channel := a.Cash.Policy().OTPPhoneChannel
	code, id, err := a.OTP.Issue(r.Context(), userID, channel)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, chrome.PhoneKycFailed)
		return
	}
	out := map[string]any{
		"challenge_id": id,
		"channel":      channel,
		"expires_in":   600,
	}
	// SMS delivery is OPS_EXTERNAL. Expose plaintext code only for automated smoke.
	if os.Getenv("DAMA_ALLOW_E2E_AUTH") == "1" {
		out["debug_code"] = code
	}
	writeJSON(w, http.StatusCreated, out)
}

type phoneVerifyBody struct {
	ChallengeID string `json:"challenge_id"`
	Code        string `json:"code"`
}

func (a *CashRmgAPI) VerifyPhoneOTP(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() || a.OTP == nil || a.Users == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	chrome := a.Cash.Chrome()
	// Mirror reference verify-otp: when admin disables OTP, challenge endpoints reject.
	if !a.cashPhoneOtpRequired(r.Context()) {
		writeClientError(w, http.StatusBadRequest, chrome.PhoneKycFailed)
		return
	}
	var body phoneVerifyBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ChallengeID == "" || body.Code == "" {
		writeClientError(w, http.StatusBadRequest, chrome.PhoneKycFailed)
		return
	}
	channel := a.Cash.Policy().OTPPhoneChannel
	if err := a.OTP.VerifyChannel(r.Context(), body.ChallengeID, userID, body.Code, channel); err != nil {
		writeClientError(w, http.StatusUnauthorized, chrome.PhoneKycFailed)
		return
	}
	if err := a.Users.MarkPhoneKycVerified(r.Context(), userID); err != nil {
		writeClientError(w, http.StatusInternalServerError, chrome.PhoneKycFailed)
		return
	}
	u, err := a.Users.GetByID(r.Context(), userID)
	if err != nil || u == nil {
		writeClientError(w, http.StatusInternalServerError, chrome.PhoneKycFailed)
		return
	}
	out := u.Self()
	stampHostTrustFields(a.Cash, u.PhoneKycVerifiedAt != nil, u.DocumentKycVerifiedAt != nil, out)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "verified",
		"message": chrome.PhoneKycSuccess,
		"user":    out,
	})
}

func (a *CashRmgAPI) adminAllowlistMsg(ctx context.Context, key string) string {
	if a.Settings == nil {
		return ""
	}
	raw, err := a.Settings.AdminConsoleChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return ""
	}
	ff, _ := doc["feature_flags"].(map[string]any)
	if ff == nil {
		return ""
	}
	s, _ := ff[key].(string)
	return strings.TrimSpace(s)
}

func (a *CashRmgAPI) writeAllowlistPolicy(w http.ResponseWriter) {
	policy := a.Cash.Policy()
	writeJSON(w, http.StatusOK, map[string]any{
		"allowed_country_codes":   policy.AllowedCountryCodes,
		"min_age_years":           policy.MinAgeYears,
		"require_locate_for_cash": policy.RequireLocateForCash,
		// Host-trust Layer B/D (cash_rmg_policy; editable via ConsolePutHostTrustPolicy).
		"host_paid_create_requires_phone_kyc":             policy.HostPaidCreateRequiresPhoneKyc,
		"host_guarantee_requires_document_kyc":            policy.HostGuaranteeRequiresDocumentKyc,
		"host_concurrent_open_paid_cap_phone_verified":    policy.HostConcurrentOpenPaidCapPhoneVerified,
		"host_concurrent_open_paid_cap_document_verified": policy.HostConcurrentOpenPaidCapDocumentVerified,
		"host_concurrent_open_paid_cap_new_host":          policy.HostConcurrentOpenPaidCapNewHost,
		"host_new_host_settled_paid_threshold":            policy.HostNewHostSettledPaidThreshold,
		"host_reputation_max_open_reports":                policy.HostReputationMaxOpenReports,
		"host_reputation_cancel_rate_bps":                 policy.HostReputationCancelRateBps,
		"host_reputation_cancel_rate_min_sample":          policy.HostReputationCancelRateMinSample,
	})
}

// ConsoleGetPolicy returns live cash_rmg_policy fields for console editors.
func (a *CashRmgAPI) ConsoleGetPolicy(w http.ResponseWriter, r *http.Request) {
	if a.Cash == nil || !a.Cash.Ready() {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		if msg == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusServiceUnavailable, msg)
		return
	}
	a.writeAllowlistPolicy(w)
}

func (a *CashRmgAPI) adminHostTrustMsg(ctx context.Context, key string) string {
	if a.Settings == nil {
		return ""
	}
	raw, err := a.Settings.AdminConsoleChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return ""
	}
	payments, _ := doc["payments"].(map[string]any)
	if payments == nil {
		return ""
	}
	s, _ := payments[key].(string)
	return strings.TrimSpace(s)
}

// ConsolePutHostTrustPolicy updates host-trust gates, caps, and reputation thresholds.
func (a *CashRmgAPI) ConsolePutHostTrustPolicy(w http.ResponseWriter, r *http.Request) {
	if a.Cash == nil || !a.Cash.Ready() {
		msg := a.adminHostTrustMsg(r.Context(), "host_trust_toast_failed")
		if msg == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusServiceUnavailable, msg)
		return
	}
	var body store.HostTrustPolicyPatch
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		msg := a.adminHostTrustMsg(r.Context(), "host_trust_save_invalid")
		if msg == "" {
			msg = a.adminHostTrustMsg(r.Context(), "host_trust_toast_failed")
		}
		writeClientError(w, http.StatusBadRequest, msg)
		return
	}
	if err := a.Cash.SetHostTrustPolicy(r.Context(), body); err != nil {
		msg := a.adminHostTrustMsg(r.Context(), "host_trust_save_invalid")
		if msg == "" || !strings.Contains(err.Error(), "invalid") {
			msg = a.adminHostTrustMsg(r.Context(), "host_trust_toast_failed")
		}
		if msg == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeClientError(w, http.StatusBadRequest, msg)
		return
	}
	a.writeAllowlistPolicy(w)
}

// ConsolePutAllowedCountries replaces the full allowlist (bulk update).
func (a *CashRmgAPI) ConsolePutAllowedCountries(w http.ResponseWriter, r *http.Request) {
	if a.Cash == nil || !a.Cash.Ready() {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		if msg == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusServiceUnavailable, msg)
		return
	}
	var body struct {
		CountryCodes []string `json:"country_codes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		writeClientError(w, http.StatusBadRequest, msg)
		return
	}
	if err := a.Cash.SetAllowedCountryCodes(r.Context(), body.CountryCodes); err != nil {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_empty")
		if !strings.Contains(err.Error(), "at least one") {
			msg = a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		}
		writeClientError(w, http.StatusBadRequest, msg)
		return
	}
	a.writeAllowlistPolicy(w)
}

// ConsoleAddAllowedCountry appends one ISO country to the allowlist.
func (a *CashRmgAPI) ConsoleAddAllowedCountry(w http.ResponseWriter, r *http.Request) {
	if a.Cash == nil || !a.Cash.Ready() {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		if msg == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusServiceUnavailable, msg)
		return
	}
	var body struct {
		CountryCode string `json:"country_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		writeClientError(w, http.StatusBadRequest, msg)
		return
	}
	if err := a.Cash.AddAllowedCountryCode(r.Context(), body.CountryCode); err != nil {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		writeClientError(w, http.StatusBadRequest, msg)
		return
	}
	a.writeAllowlistPolicy(w)
}

// ConsoleDeleteAllowedCountry removes one ISO country (refuses emptying the list).
func (a *CashRmgAPI) ConsoleDeleteAllowedCountry(w http.ResponseWriter, r *http.Request) {
	if a.Cash == nil || !a.Cash.Ready() {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		if msg == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusServiceUnavailable, msg)
		return
	}
	code := strings.TrimSpace(chi.URLParam(r, "code"))
	if err := a.Cash.RemoveAllowedCountryCode(r.Context(), code); err != nil {
		msg := a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_empty")
		if !strings.Contains(err.Error(), "at least one") {
			msg = a.adminAllowlistMsg(r.Context(), "cash_allowed_countries_failed")
		}
		writeClientError(w, http.StatusBadRequest, msg)
		return
	}
	a.writeAllowlistPolicy(w)
}

// requireCashGate evaluates cash eligibility; writes error response and returns false when blocked.
func requireCashGate(w http.ResponseWriter, r *http.Request, cash *store.CashRmgStore, users *store.UserStore, settings *store.SettingsStore, countryCode string) bool {
	if cash == nil || !cash.Ready() || users == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(cash)})
		return false
	}
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return false
	}
	u, err := users.GetByID(r.Context(), userID)
	if err != nil {
		writeWalletChromeError(w, settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return false
	}
	phone := ""
	if u.PrimaryPhone != nil {
		phone = *u.PrimaryPhone
	}
	el := cash.EvaluateCash(r.Context(), userID, countryCode, u.AgeVerifiedAt != nil, u.PhoneKycVerifiedAt != nil, phone)
	if !el.OK {
		status := http.StatusForbidden
		switch el.ErrorKey {
		case "country_required":
			status = http.StatusBadRequest
		case "unavailable", "cash_disabled":
			status = http.StatusServiceUnavailable
		}
		writeJSON(w, status, map[string]any{
			"error":     el.ErrorMessage,
			"error_key": el.ErrorKey,
		})
		return false
	}
	return true
}
