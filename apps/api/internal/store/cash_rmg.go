package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"
)

// CashRmgPolicy is platform_settings.cash_rmg_policy (fail closed if incomplete).
type CashRmgPolicy struct {
	MinAgeYears                               int      `json:"min_age_years"`
	AllowedCountryCodes                       []string `json:"allowed_country_codes"`
	LocateMaxAgeSeconds                       int      `json:"locate_max_age_seconds"`
	RequireLocateForCash                      bool     `json:"require_locate_for_cash"`
	PayoutStatuses                            []string `json:"payout_statuses"`
	DefaultPayoutStatus                       string   `json:"default_payout_status"`
	ApprovablePayoutStatus                    string   `json:"approvable_payout_status"`
	ApprovedPayoutStatus                      string   `json:"approved_payout_status"`
	RejectedPayoutStatus                      string   `json:"rejected_payout_status"`
	PaidPayoutStatus                          string   `json:"paid_payout_status"`
	OTPPhoneChannel                           string   `json:"otp_phone_channel"`
	RequireDocumentKycForPayout               bool     `json:"require_document_kyc_for_payout"`
	HostGuaranteeRequiresDocumentKyc          bool     `json:"host_guarantee_requires_document_kyc"`
	HostPaidCreateRequiresPhoneKyc            bool     `json:"host_paid_create_requires_phone_kyc"`
	HostConcurrentOpenPaidCapPhoneVerified    int      `json:"host_concurrent_open_paid_cap_phone_verified"`
	HostConcurrentOpenPaidCapDocumentVerified int      `json:"host_concurrent_open_paid_cap_document_verified"`
	HostConcurrentOpenPaidCapNewHost          int      `json:"host_concurrent_open_paid_cap_new_host"`
	HostNewHostSettledPaidThreshold           int      `json:"host_new_host_settled_paid_threshold"`
	HostReputationMaxOpenReports              int      `json:"host_reputation_max_open_reports"`
	HostReputationCancelRateBps               int      `json:"host_reputation_cancel_rate_bps"`
	HostReputationCancelRateMinSample         int      `json:"host_reputation_cancel_rate_min_sample"`
	HostTrustTierUnverified                   string   `json:"host_trust_tier_unverified"`
	HostTrustTierPhoneVerified                string   `json:"host_trust_tier_phone_verified"`
	HostTrustTierDocumentVerified             string   `json:"host_trust_tier_document_verified"`
	DocumentKycTypes                          []string `json:"document_kyc_types"`
	DocumentKycStatuses                       []string `json:"document_kyc_statuses"`
	DocumentKycDraftStatus                    string   `json:"document_kyc_draft_status"`
	DocumentKycPendingStatus                  string   `json:"document_kyc_pending_status"`
	DocumentKycApprovedStatus                 string   `json:"document_kyc_approved_status"`
	DocumentKycRejectedStatus                 string   `json:"document_kyc_rejected_status"`
	DocumentKycPassportType                   string   `json:"document_kyc_passport_type"`
	Source                                    string   `json:"-"`
}

// CashRmgChrome is platform_settings.cash_rmg_chrome (fail closed).
type CashRmgChrome struct {
	CashRmgUnavailable             string `json:"cash_rmg_unavailable"`
	AgeGateTitle                   string `json:"age_gate_title"`
	AgeGateBlurb                   string `json:"age_gate_blurb"`
	AgeGateDobLabel                string `json:"age_gate_dob_label"`
	AgeGateDobPlaceholder          string `json:"age_gate_dob_placeholder"`
	AgeGateSubmitAction            string `json:"age_gate_submit_action"`
	AgeGateSubmitPending           string `json:"age_gate_submit_pending"`
	AgeGateSuccess                 string `json:"age_gate_success"`
	AgeGateFailed                  string `json:"age_gate_failed"`
	AgeGateTooYoung                string `json:"age_gate_too_young"`
	AgeRequiredError               string `json:"age_required_error"`
	JurisdictionBlockedError       string `json:"jurisdiction_blocked_error"`
	CashDisabledError              string `json:"cash_disabled_error"`
	LocateRequiredError            string `json:"locate_required_error"`
	LocateStaleError               string `json:"locate_stale_error"`
	CountryRequiredError           string `json:"country_required_error"`
	PhoneKycTitle                  string `json:"phone_kyc_title"`
	PhoneKycBlurb                  string `json:"phone_kyc_blurb"`
	PhoneKycPhoneLabel             string `json:"phone_kyc_phone_label"`
	PhoneKycSaveAction             string `json:"phone_kyc_save_action"`
	PhoneKycStartOtpAction         string `json:"phone_kyc_start_otp_action"`
	PhoneKycSendPending            string `json:"phone_kyc_send_pending"`
	PhoneKycVerifyAction           string `json:"phone_kyc_verify_action"`
	PhoneKycVerifyPending          string `json:"phone_kyc_verify_pending"`
	PhoneKycCodeLabel              string `json:"phone_kyc_code_label"`
	PhoneKycCodePlaceholder        string `json:"phone_kyc_code_placeholder"`
	PhoneKycSuccess                string `json:"phone_kyc_success"`
	PhoneKycFailed                 string `json:"phone_kyc_failed"`
	PhoneKycRequiredError          string `json:"phone_kyc_required_error"`
	EligibleLabel                  string `json:"eligible_label"`
	NotEligibleLabel               string `json:"not_eligible_label"`
	DocKycTitle                    string `json:"doc_kyc_title"`
	DocKycBlurb                    string `json:"doc_kyc_blurb"`
	DocKycTypeLabel                string `json:"doc_kyc_type_label"`
	DocKycLegalNameLabel           string `json:"doc_kyc_legal_name_label"`
	DocKycFrontLabel               string `json:"doc_kyc_front_label"`
	DocKycBackLabel                string `json:"doc_kyc_back_label"`
	DocKycSelfieLabel              string `json:"doc_kyc_selfie_label"`
	DocKycUploadAction             string `json:"doc_kyc_upload_action"`
	DocKycSaveDraftAction          string `json:"doc_kyc_save_draft_action"`
	DocKycSubmitAction             string `json:"doc_kyc_submit_action"`
	DocKycSubmitPending            string `json:"doc_kyc_submit_pending"`
	DocKycPendingLabel             string `json:"doc_kyc_pending_label"`
	DocKycApprovedLabel            string `json:"doc_kyc_approved_label"`
	DocKycRejectedLabel            string `json:"doc_kyc_rejected_label"`
	DocKycSuccess                  string `json:"doc_kyc_success"`
	DocKycFailed                   string `json:"doc_kyc_failed"`
	DocKycRequiredError            string `json:"doc_kyc_required_error"`
	DocKycIncompleteError          string `json:"doc_kyc_incomplete_error"`
	DocKycTypePassport             string `json:"doc_kyc_type_passport"`
	DocKycTypeNationalID           string `json:"doc_kyc_type_national_id"`
	DocKycTypeDriversLicense       string `json:"doc_kyc_type_drivers_license"`
	DocKycCameraAction             string `json:"doc_kyc_camera_action"`
	DocKycGalleryAction            string `json:"doc_kyc_gallery_action"`
	HostTrustBadgeUnverified       string `json:"host_trust_badge_unverified"`
	HostTrustBadgePhoneVerified    string `json:"host_trust_badge_phone_verified"`
	HostTrustBadgeDocumentVerified string `json:"host_trust_badge_document_verified"`
	DocKycAutoApprovedSuccess      string `json:"doc_kyc_auto_approved_success"`
	Source                         string `json:"-"`
}

var cashRmgChromeKeys = []string{
	"cash_rmg_unavailable", "age_gate_title", "age_gate_blurb", "age_gate_dob_label",
	"age_gate_submit_action", "age_gate_submit_pending", "age_gate_success", "age_gate_failed", "age_gate_too_young",
	"age_required_error", "jurisdiction_blocked_error", "cash_disabled_error",
	"locate_required_error", "locate_stale_error", "country_required_error",
	"phone_kyc_title", "phone_kyc_blurb", "phone_kyc_phone_label", "phone_kyc_save_action",
	"phone_kyc_start_otp_action", "phone_kyc_send_pending", "phone_kyc_verify_action", "phone_kyc_verify_pending", "phone_kyc_code_label",
	"phone_kyc_success", "phone_kyc_failed", "phone_kyc_required_error",
	"eligible_label", "not_eligible_label",
	"doc_kyc_title", "doc_kyc_blurb", "doc_kyc_type_label", "doc_kyc_legal_name_label",
	"doc_kyc_front_label", "doc_kyc_back_label", "doc_kyc_selfie_label", "doc_kyc_upload_action",
	"doc_kyc_save_draft_action", "doc_kyc_submit_action", "doc_kyc_submit_pending", "doc_kyc_pending_label",
	"doc_kyc_approved_label", "doc_kyc_rejected_label", "doc_kyc_success", "doc_kyc_failed",
	"doc_kyc_required_error", "doc_kyc_incomplete_error",
	"doc_kyc_type_passport", "doc_kyc_type_national_id", "doc_kyc_type_drivers_license",
	"doc_kyc_camera_action", "doc_kyc_gallery_action",
	"host_trust_badge_unverified", "host_trust_badge_phone_verified", "host_trust_badge_document_verified",
	"doc_kyc_auto_approved_success",
}

// CashEligibility is the server decision for cash actions.
type CashEligibility struct {
	OK           bool   `json:"ok"`
	ErrorKey     string `json:"error_key,omitempty"`
	ErrorMessage string `json:"error,omitempty"`
	CountryCode  string `json:"country_code,omitempty"`
	AgeVerified  bool   `json:"age_verified"`
	PhoneKycOK   bool   `json:"phone_kyc_verified"`
	CashEnabled  bool   `json:"cash_rmg_enabled"`
	MinAgeYears  int    `json:"min_age_years"`
	// DocumentKycApproved mirrors HasApprovedDocument (payout gate; independent of panel mount).
	DocumentKycApproved bool `json:"document_kyc_approved"`
	// Display helpers for compliance panel (hide re-entry when already verified).
	PrimaryPhone string `json:"primary_phone,omitempty"`
	DateOfBirth  string `json:"date_of_birth,omitempty"`
}

type CashRmgStore struct {
	db       *db.Handle
	settings *SettingsStore
	flags    *FlagStore
	mu       sync.RWMutex
	policy   CashRmgPolicy
	chrome   CashRmgChrome
}

func NewCashRmgStore(handle *db.Handle, settings *SettingsStore, flags *FlagStore) *CashRmgStore {
	s := &CashRmgStore{
		db:       handle,
		settings: settings,
		flags:    flags,
		policy:   CashRmgPolicy{Source: "unavailable"},
		chrome:   CashRmgChrome{Source: "unavailable"},
	}
	_ = s.Reload(context.Background())
	return s
}

func (s *CashRmgStore) Reload(ctx context.Context) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database unavailable")
	}
	var policyRaw, chromeRaw []byte
	if err := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'cash_rmg_policy'`).Scan(&policyRaw); err != nil {
		return err
	}
	if err := s.db.Pool.QueryRow(ctx, `SELECT value FROM platform_settings WHERE key = 'cash_rmg_chrome'`).Scan(&chromeRaw); err != nil {
		return err
	}
	var policyMap map[string]any
	if err := json.Unmarshal(policyRaw, &policyMap); err != nil {
		return err
	}
	if _, ok := policyMap["require_document_kyc_for_payout"]; !ok {
		return errors.New("cash_rmg_policy incomplete: require_document_kyc_for_payout")
	}
	if _, ok := policyMap["host_guarantee_requires_document_kyc"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_guarantee_requires_document_kyc")
	}
	if _, ok := policyMap["host_paid_create_requires_phone_kyc"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_paid_create_requires_phone_kyc")
	}
	if _, ok := policyMap["host_concurrent_open_paid_cap_phone_verified"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_concurrent_open_paid_cap_phone_verified")
	}
	if _, ok := policyMap["host_concurrent_open_paid_cap_document_verified"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_concurrent_open_paid_cap_document_verified")
	}
	if _, ok := policyMap["host_concurrent_open_paid_cap_new_host"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_concurrent_open_paid_cap_new_host")
	}
	if _, ok := policyMap["host_new_host_settled_paid_threshold"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_new_host_settled_paid_threshold")
	}
	if _, ok := policyMap["host_reputation_max_open_reports"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_reputation_max_open_reports")
	}
	if _, ok := policyMap["host_reputation_cancel_rate_bps"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_reputation_cancel_rate_bps")
	}
	if _, ok := policyMap["host_reputation_cancel_rate_min_sample"]; !ok {
		return errors.New("cash_rmg_policy incomplete: host_reputation_cancel_rate_min_sample")
	}
	var policy CashRmgPolicy
	if err := json.Unmarshal(policyRaw, &policy); err != nil {
		return err
	}
	if policy.MinAgeYears < 1 || len(policy.AllowedCountryCodes) == 0 ||
		policy.LocateMaxAgeSeconds < 1 || policy.OTPPhoneChannel == "" ||
		policy.DefaultPayoutStatus == "" || policy.ApprovablePayoutStatus == "" ||
		policy.ApprovedPayoutStatus == "" || policy.RejectedPayoutStatus == "" ||
		policy.PaidPayoutStatus == "" || len(policy.PayoutStatuses) == 0 ||
		len(policy.DocumentKycTypes) == 0 || len(policy.DocumentKycStatuses) == 0 ||
		policy.DocumentKycDraftStatus == "" || policy.DocumentKycPendingStatus == "" ||
		policy.DocumentKycApprovedStatus == "" || policy.DocumentKycRejectedStatus == "" ||
		policy.DocumentKycPassportType == "" ||
		policy.HostConcurrentOpenPaidCapPhoneVerified < 1 ||
		policy.HostConcurrentOpenPaidCapDocumentVerified < 1 ||
		policy.HostConcurrentOpenPaidCapNewHost < 1 ||
		policy.HostNewHostSettledPaidThreshold < 0 ||
		policy.HostReputationMaxOpenReports < 0 ||
		policy.HostReputationCancelRateBps < 0 || policy.HostReputationCancelRateBps > 10000 ||
		policy.HostReputationCancelRateMinSample < 1 ||
		strings.TrimSpace(policy.HostTrustTierUnverified) == "" ||
		strings.TrimSpace(policy.HostTrustTierPhoneVerified) == "" ||
		strings.TrimSpace(policy.HostTrustTierDocumentVerified) == "" {
		return errors.New("cash_rmg_policy incomplete")
	}
	var chromeMap map[string]any
	if err := json.Unmarshal(chromeRaw, &chromeMap); err != nil {
		return err
	}
	for _, k := range cashRmgChromeKeys {
		v, _ := chromeMap[k].(string)
		if strings.TrimSpace(v) == "" {
			return errors.New("cash_rmg_chrome incomplete: " + k)
		}
	}
	var chrome CashRmgChrome
	if err := json.Unmarshal(chromeRaw, &chrome); err != nil {
		return err
	}
	policy.Source = "database"
	chrome.Source = "database"
	// Normalize allowlist
	out := make([]string, 0, len(policy.AllowedCountryCodes))
	for _, c := range policy.AllowedCountryCodes {
		c = strings.ToUpper(strings.TrimSpace(c))
		if c != "" {
			out = append(out, c)
		}
	}
	policy.AllowedCountryCodes = out
	s.mu.Lock()
	s.policy = policy
	s.chrome = chrome
	s.mu.Unlock()
	return nil
}

func (s *CashRmgStore) Policy() CashRmgPolicy {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := s.policy
	cp.AllowedCountryCodes = append([]string{}, s.policy.AllowedCountryCodes...)
	cp.PayoutStatuses = append([]string{}, s.policy.PayoutStatuses...)
	cp.DocumentKycTypes = append([]string{}, s.policy.DocumentKycTypes...)
	cp.DocumentKycStatuses = append([]string{}, s.policy.DocumentKycStatuses...)
	return cp
}

func (s *CashRmgStore) Chrome() CashRmgChrome {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.chrome
}

func (s *CashRmgStore) Ready() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.policy.Source == "database" && s.chrome.Source == "database"
}

// ConcurrentOpenPaidCap returns the DB cap for open paid cups at the caller's trust tier.
// Document-verified hosts use the higher cap. Phone-tier hosts under the settled-paid
// threshold use the new-host cap; after that they use the phone-verified cap.
func (p CashRmgPolicy) ConcurrentOpenPaidCap(documentVerified bool, settledPaid int) int {
	if documentVerified {
		return p.HostConcurrentOpenPaidCapDocumentVerified
	}
	if p.HostNewHostSettledPaidThreshold > 0 && settledPaid < p.HostNewHostSettledPaidThreshold {
		return p.HostConcurrentOpenPaidCapNewHost
	}
	return p.HostConcurrentOpenPaidCapPhoneVerified
}

// HostReputationBlocksPaidCreate is true when open reports or cancel rate breach DB thresholds.
// max_open_reports 0 disables the report gate; cancel_rate_bps 0 disables the cancel-rate gate.
func (p CashRmgPolicy) HostReputationBlocksPaidCreate(finishedPaid, cancelledPaid, openReports int) bool {
	if p.HostReputationMaxOpenReports > 0 && openReports >= p.HostReputationMaxOpenReports {
		return true
	}
	if p.HostReputationCancelRateBps <= 0 {
		return false
	}
	sample := finishedPaid + cancelledPaid
	if sample < p.HostReputationCancelRateMinSample || sample < 1 {
		return false
	}
	bps := (cancelledPaid * 10000) / sample
	return bps >= p.HostReputationCancelRateBps
}

// HostTrust resolves DB-driven host trust tier code + badge label from KYC stamps.
// Document KYC outranks phone; neither yields unverified. Fail closed when policy/chrome incomplete.
func (s *CashRmgStore) HostTrust(phoneVerified, documentVerified bool) (tier string, badge string) {
	if s == nil || !s.Ready() {
		return "", ""
	}
	p := s.Policy()
	c := s.Chrome()
	switch {
	case documentVerified:
		tier = strings.TrimSpace(p.HostTrustTierDocumentVerified)
		badge = strings.TrimSpace(c.HostTrustBadgeDocumentVerified)
	case phoneVerified:
		tier = strings.TrimSpace(p.HostTrustTierPhoneVerified)
		badge = strings.TrimSpace(c.HostTrustBadgePhoneVerified)
	default:
		tier = strings.TrimSpace(p.HostTrustTierUnverified)
		badge = strings.TrimSpace(c.HostTrustBadgeUnverified)
	}
	if tier == "" || badge == "" {
		return "", ""
	}
	return tier, badge
}

// HostTrustPolicyPatch is the editable host-trust slice of cash_rmg_policy.
type HostTrustPolicyPatch struct {
	HostPaidCreateRequiresPhoneKyc            bool `json:"host_paid_create_requires_phone_kyc"`
	HostGuaranteeRequiresDocumentKyc          bool `json:"host_guarantee_requires_document_kyc"`
	HostConcurrentOpenPaidCapPhoneVerified    int  `json:"host_concurrent_open_paid_cap_phone_verified"`
	HostConcurrentOpenPaidCapDocumentVerified int  `json:"host_concurrent_open_paid_cap_document_verified"`
	HostConcurrentOpenPaidCapNewHost          int  `json:"host_concurrent_open_paid_cap_new_host"`
	HostNewHostSettledPaidThreshold           int  `json:"host_new_host_settled_paid_threshold"`
	HostReputationMaxOpenReports              int  `json:"host_reputation_max_open_reports"`
	HostReputationCancelRateBps               int  `json:"host_reputation_cancel_rate_bps"`
	HostReputationCancelRateMinSample         int  `json:"host_reputation_cancel_rate_min_sample"`
}

func validateHostTrustPolicyPatch(p HostTrustPolicyPatch) error {
	if p.HostConcurrentOpenPaidCapPhoneVerified < 1 ||
		p.HostConcurrentOpenPaidCapDocumentVerified < 1 ||
		p.HostConcurrentOpenPaidCapNewHost < 1 ||
		p.HostNewHostSettledPaidThreshold < 0 ||
		p.HostReputationMaxOpenReports < 0 ||
		p.HostReputationCancelRateBps < 0 || p.HostReputationCancelRateBps > 10000 ||
		p.HostReputationCancelRateMinSample < 1 {
		return errors.New("host trust policy invalid")
	}
	return nil
}

// SetHostTrustPolicy updates host-trust gates/caps/reputation on cash_rmg_policy (fail closed).
func (s *CashRmgStore) SetHostTrustPolicy(ctx context.Context, patch HostTrustPolicyPatch) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database unavailable")
	}
	if err := validateHostTrustPolicyPatch(patch); err != nil {
		return err
	}
	raw, err := json.Marshal(patch)
	if err != nil {
		return err
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE platform_settings
		SET value = value || $1::jsonb,
		    updated_at = NOW()
		WHERE key = 'cash_rmg_policy'
	`, string(raw))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("cash_rmg_policy missing")
	}
	return s.Reload(ctx)
}

// SetAllowedCountryCodes replaces cash_rmg_policy.allowed_country_codes (fail closed: ≥1 valid ISO-2).
func (s *CashRmgStore) SetAllowedCountryCodes(ctx context.Context, codes []string) error {
	if s.db == nil || !s.db.Ready() {
		return errors.New("database unavailable")
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, len(codes))
	for _, c := range codes {
		c = strings.ToUpper(strings.TrimSpace(c))
		if len(c) != 2 {
			continue
		}
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		out = append(out, c)
	}
	if len(out) == 0 {
		return errors.New("allowed_country_codes requires at least one ISO country code")
	}
	raw, err := json.Marshal(out)
	if err != nil {
		return err
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE platform_settings
		SET value = jsonb_set(value, '{allowed_country_codes}', $1::jsonb, true),
		    updated_at = NOW()
		WHERE key = 'cash_rmg_policy'
	`, string(raw))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("cash_rmg_policy missing")
	}
	return s.Reload(ctx)
}

// AddAllowedCountryCode appends one ISO-2 code to the allowlist.
func (s *CashRmgStore) AddAllowedCountryCode(ctx context.Context, code string) error {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != 2 {
		return errors.New("invalid country code")
	}
	cur := s.Policy().AllowedCountryCodes
	for _, c := range cur {
		if c == code {
			return s.Reload(ctx) // already present; refresh
		}
	}
	return s.SetAllowedCountryCodes(ctx, append(cur, code))
}

// RemoveAllowedCountryCode removes one ISO-2 code; refuses if it would empty the allowlist.
func (s *CashRmgStore) RemoveAllowedCountryCode(ctx context.Context, code string) error {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != 2 {
		return errors.New("invalid country code")
	}
	cur := s.Policy().AllowedCountryCodes
	next := make([]string, 0, len(cur))
	for _, c := range cur {
		if c != code {
			next = append(next, c)
		}
	}
	if len(next) == 0 {
		return errors.New("allowed_country_codes requires at least one ISO country code")
	}
	return s.SetAllowedCountryCodes(ctx, next)
}

func (s *CashRmgStore) countryAllowed(code string) bool {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return false
	}
	for _, c := range s.Policy().AllowedCountryCodes {
		if c == code {
			return true
		}
	}
	return false
}

// CountryEligibleForCash is the jurisdiction half of EvaluateCash (allowlist + flags).
// Used to hide paid discovery surfaces outside allowed regions.
func (s *CashRmgStore) CountryEligibleForCash(ctx context.Context, countryCode string) bool {
	if s == nil || !s.Ready() || s.flags == nil {
		return false
	}
	flags := s.flags.Get(ctx)
	if flags.Source != "database" || !flags.CashRmgEnabled {
		return false
	}
	cc := strings.ToUpper(strings.TrimSpace(countryCode))
	if cc == "" {
		return false
	}
	return s.countryAllowed(cc) && !s.countryDisabledByFlag(cc, flags)
}

func (s *CashRmgStore) countryDisabledByFlag(code string, flags FeatureFlags) bool {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return false
	}
	for _, c := range flags.CashRmgDisabledCountries {
		if c == code {
			return true
		}
	}
	return false
}

// EvaluateCash gates paid enroll / checkout / payout. countryCode required when cash is involved.
func (s *CashRmgStore) EvaluateCash(ctx context.Context, userID, countryCode string, ageVerified, phoneKycVerified bool, phone string) CashEligibility {
	chrome := s.Chrome()
	policy := s.Policy()
	out := CashEligibility{
		MinAgeYears: policy.MinAgeYears,
		AgeVerified: ageVerified,
		PhoneKycOK:  phoneKycVerified,
		CountryCode: strings.ToUpper(strings.TrimSpace(countryCode)),
	}
	if !s.Ready() || s.flags == nil {
		out.ErrorKey = "unavailable"
		out.ErrorMessage = chrome.CashRmgUnavailable
		return out
	}
	flags := s.flags.Get(ctx)
	out.CashEnabled = flags.CashRmgEnabled
	if flags.Source != "database" {
		out.ErrorKey = "unavailable"
		out.ErrorMessage = chrome.CashRmgUnavailable
		return out
	}
	if !flags.CashRmgEnabled {
		out.ErrorKey = "cash_disabled"
		out.ErrorMessage = chrome.CashDisabledError
		return out
	}
	if out.CountryCode == "" {
		out.ErrorKey = "country_required"
		out.ErrorMessage = chrome.CountryRequiredError
		return out
	}
	if !s.countryAllowed(out.CountryCode) || s.countryDisabledByFlag(out.CountryCode, flags) {
		out.ErrorKey = "jurisdiction"
		out.ErrorMessage = chrome.JurisdictionBlockedError
		return out
	}
	if !ageVerified {
		out.ErrorKey = "age_required"
		out.ErrorMessage = chrome.AgeRequiredError
		return out
	}
	if flags.CashPhoneKycRequired {
		if strings.TrimSpace(phone) == "" || !phoneKycVerified {
			out.ErrorKey = "phone_kyc"
			out.ErrorMessage = chrome.PhoneKycRequiredError
			return out
		}
	}
	if policy.RequireLocateForCash {
		ok, stale, err := s.hasFreshLocate(ctx, userID, out.CountryCode, policy.LocateMaxAgeSeconds)
		if err != nil {
			out.ErrorKey = "locate_required"
			out.ErrorMessage = chrome.LocateRequiredError
			return out
		}
		if stale {
			out.ErrorKey = "locate_stale"
			out.ErrorMessage = chrome.LocateStaleError
			return out
		}
		if !ok {
			out.ErrorKey = "locate_required"
			out.ErrorMessage = chrome.LocateRequiredError
			return out
		}
	}
	out.OK = true
	return out
}

func (s *CashRmgStore) hasFreshLocate(ctx context.Context, userID, country string, maxAgeSec int) (ok bool, stale bool, err error) {
	if s.db == nil || !s.db.Ready() {
		return false, false, errors.New("database unavailable")
	}
	var createdAt time.Time
	var gotCountry string
	err = s.db.Pool.QueryRow(ctx, `
		SELECT country_code, created_at
		FROM geo_ip_records
		WHERE user_id = $1 AND UPPER(TRIM(country_code)) = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, country).Scan(&gotCountry, &createdAt)
	if err != nil {
		return false, false, nil // no row → not ok, not stale specifically
	}
	if time.Since(createdAt) > time.Duration(maxAgeSec)*time.Second {
		return false, true, nil
	}
	return true, false, nil
}
