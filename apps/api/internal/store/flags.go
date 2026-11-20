package store

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"

	"dama/apps/api/internal/db"
)

type FeatureFlags struct {
	VSAIEnabled               bool           `json:"vs_ai_enabled"`
	OTPRequired               bool           `json:"otp_required"`
	CashRmgEnabled            bool           `json:"cash_rmg_enabled"`
	CashPhoneKycRequired      bool           `json:"cash_phone_kyc_required"`
	CashPhoneOtpRequired      bool           `json:"cash_phone_otp_required"`
	CashRmgDisabledCountries  []string       `json:"cash_rmg_disabled_countries"`
	HostedEventsEnabled       bool           `json:"hosted_events_enabled"`
	PublicEventsEnabled       bool           `json:"public_events_enabled"`
	PublicEventMatchesRated   bool           `json:"public_event_matches_rated"`
	PrizePoolDisplayEnabled   bool           `json:"prize_pool_display_enabled"`
	PrizePoolGuaranteeEnabled bool           `json:"prize_pool_guarantee_enabled"`
	KycAutoApprove            bool           `json:"kyc_auto_approve"`
	EthiopiaPaymentMode       string         `json:"-"` // internal gateway mode; public APIs map via PublicChannel
	AIDepths                  []int          `json:"ai_depths"`
	Source                    string         `json:"-"`
	Raw                       map[string]any `json:"-"`
}

type FlagStore struct {
	db       *db.Handle
	settings *SettingsStore
	mu       sync.RWMutex
	mem      map[string]flagRow
}

type flagRow struct {
	Enabled bool
	Payload map[string]any
}

func NewFlagStore(handle *db.Handle) *FlagStore {
	// No seeded depths/payment mode. Hydrate only from Postgres (or explicit Set under DAMA_ALLOW_MEMORY).
	return &FlagStore{
		db:  handle,
		mem: map[string]flagRow{},
	}
}

// AttachSettings wires platform_settings.feature_flag_catalog for key resolution.
func (s *FlagStore) AttachSettings(settings *SettingsStore) {
	s.settings = settings
}

func (s *FlagStore) Get(ctx context.Context) FeatureFlags {
	if s.db != nil && s.db.Ready() {
		if flags, err := s.loadFromDB(ctx); err == nil {
			flags.Source = "database"
			return flags
		}
	}
	if os.Getenv("DAMA_ALLOW_MEMORY") == "1" {
		s.mu.RLock()
		defer s.mu.RUnlock()
		return s.fromMemLocked("memory")
	}
	// Fail closed: no VS-AI, no payment mode guess, no invented AI depths.
	return FeatureFlags{
		VSAIEnabled:               false,
		OTPRequired:               false,
		CashRmgEnabled:            false,
		CashPhoneKycRequired:      false,
		CashPhoneOtpRequired:      false, // optional OTP; default off until flag says on
		CashRmgDisabledCountries:  []string{},
		HostedEventsEnabled:       false,
		PublicEventsEnabled:       false,
		PublicEventMatchesRated:   false,
		PrizePoolDisplayEnabled:   false,
		PrizePoolGuaranteeEnabled: false,
		KycAutoApprove:            false,
		EthiopiaPaymentMode:       "",
		AIDepths:                  []int{},
		Source:                    "unavailable",
		Raw:                       map[string]any{},
	}
}

func (s *FlagStore) Set(ctx context.Context, key string, enabled bool, payload map[string]any) error {
	if payload == nil {
		payload = map[string]any{}
	}
	if s.db != nil && s.db.Ready() {
		b, _ := json.Marshal(payload)
		_, err := s.db.Pool.Exec(ctx, `
			INSERT INTO feature_flags (key, enabled, payload, updated_at)
			VALUES ($1, $2, $3::jsonb, NOW())
			ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled, payload = EXCLUDED.payload, updated_at = NOW()
		`, key, enabled, string(b))
		if err != nil {
			return err
		}
	}
	s.mu.Lock()
	s.mem[key] = flagRow{Enabled: enabled, Payload: payload}
	s.mu.Unlock()
	return nil
}

func (s *FlagStore) loadFromDB(ctx context.Context) (FeatureFlags, error) {
	rows, err := s.db.Pool.Query(ctx, `SELECT key, enabled, payload FROM feature_flags`)
	if err != nil {
		return FeatureFlags{}, err
	}
	defer rows.Close()

	s.mu.Lock()
	defer s.mu.Unlock()
	for rows.Next() {
		var key string
		var enabled bool
		var raw []byte
		if err := rows.Scan(&key, &enabled, &raw); err != nil {
			return FeatureFlags{}, err
		}
		payload := map[string]any{}
		_ = json.Unmarshal(raw, &payload)
		s.mem[key] = flagRow{Enabled: enabled, Payload: payload}
	}
	return s.fromMemLocked("database"), rows.Err()
}

func (s *FlagStore) fromMemLocked(source string) FeatureFlags {
	flags := FeatureFlags{
		VSAIEnabled:               false,
		OTPRequired:               false,
		CashRmgEnabled:            false,
		CashPhoneKycRequired:      false,
		CashPhoneOtpRequired:      false, // default OFF until catalog row says otherwise
		CashRmgDisabledCountries:  []string{},
		HostedEventsEnabled:       false,
		PublicEventsEnabled:       false,
		PublicEventMatchesRated:   false,
		PrizePoolDisplayEnabled:   false,
		PrizePoolGuaranteeEnabled: false,
		KycAutoApprove:            false,
		EthiopiaPaymentMode:       "",
		AIDepths:                  []int{},
		Source:                    source,
		Raw:                       map[string]any{},
	}
	vsKey, otpKey, payKey, cashKey, phoneKycKey, phoneOtpKey, eventsKey, publicEventsKey, publicRatedKey, prizePoolKey, prizeGuaranteeKey, kycAutoKey := "", "", "", "", "", "", "", "", "", "", "", ""
	if s.settings != nil {
		cat := s.settings.FeatureFlagCatalog()
		if cat.Source == "database" {
			vsKey = cat.AIDepthsFlagKey
			for _, t := range cat.Toggles {
				switch t.StateField {
				case "otpRequired":
					otpKey = t.Key
				case "ethiopiaPaymentMode":
					payKey = t.Key
				case "vsAiEnabled":
					if vsKey == "" {
						vsKey = t.Key
					}
				case "cashRmgEnabled":
					cashKey = t.Key
				case "cashPhoneKycRequired":
					phoneKycKey = t.Key
				case "cashPhoneOtpRequired":
					phoneOtpKey = t.Key
				case "hostedEventsEnabled":
					eventsKey = t.Key
				case "publicEventsEnabled":
					publicEventsKey = t.Key
				case "publicEventMatchesRated":
					publicRatedKey = t.Key
				case "prizePoolDisplayEnabled":
					prizePoolKey = t.Key
				case "prizePoolGuaranteeEnabled":
					prizeGuaranteeKey = t.Key
				case "kycAutoApprove":
					kycAutoKey = t.Key
				}
			}
		}
	}
	if vsKey != "" {
		if row, ok := s.mem[vsKey]; ok {
			flags.VSAIEnabled = row.Enabled
			if depths, ok := row.Payload["depths"].([]any); ok {
				out := make([]int, 0, len(depths))
				for _, d := range depths {
					switch v := d.(type) {
					case float64:
						out = append(out, int(v))
					case int:
						out = append(out, v)
					}
				}
				flags.AIDepths = out
			}
		}
	}
	if otpKey != "" {
		if row, ok := s.mem[otpKey]; ok {
			flags.OTPRequired = row.Enabled
		}
	}
	if cashKey != "" {
		if row, ok := s.mem[cashKey]; ok {
			flags.CashRmgEnabled = row.Enabled
			flags.CashRmgDisabledCountries = parseDisabledCountries(row.Payload)
		}
	}
	if phoneKycKey != "" {
		if row, ok := s.mem[phoneKycKey]; ok {
			flags.CashPhoneKycRequired = row.Enabled
		}
	}
	if phoneOtpKey != "" {
		if row, ok := s.mem[phoneOtpKey]; ok {
			flags.CashPhoneOtpRequired = row.Enabled
		}
	}
	if payKey != "" {
		if row, ok := s.mem[payKey]; ok {
			// Mode must be explicit in DB payload. Never invent from enabled bit.
			if mode, ok := row.Payload["mode"].(string); ok && mode != "" {
				flags.EthiopiaPaymentMode = mode
			}
		}
	}
	if eventsKey != "" {
		if row, ok := s.mem[eventsKey]; ok {
			flags.HostedEventsEnabled = row.Enabled
		}
	}
	if publicEventsKey != "" {
		if row, ok := s.mem[publicEventsKey]; ok {
			flags.PublicEventsEnabled = row.Enabled
		}
	}
	if publicRatedKey != "" {
		if row, ok := s.mem[publicRatedKey]; ok {
			flags.PublicEventMatchesRated = row.Enabled
		}
	}
	if prizePoolKey != "" {
		if row, ok := s.mem[prizePoolKey]; ok {
			flags.PrizePoolDisplayEnabled = row.Enabled
		}
	}
	if prizeGuaranteeKey != "" {
		if row, ok := s.mem[prizeGuaranteeKey]; ok {
			flags.PrizePoolGuaranteeEnabled = row.Enabled
		}
	}
	if kycAutoKey != "" {
		if row, ok := s.mem[kycAutoKey]; ok {
			flags.KycAutoApprove = row.Enabled
		}
	}
	for k, v := range s.mem {
		flags.Raw[k] = map[string]any{"enabled": v.Enabled, "payload": v.Payload}
	}
	return flags
}

func parseDisabledCountries(payload map[string]any) []string {
	if payload == nil {
		return []string{}
	}
	list, ok := payload["disabled_countries"].([]any)
	if !ok {
		return []string{}
	}
	out := make([]string, 0, len(list))
	for _, item := range list {
		var s string
		switch t := item.(type) {
		case string:
			s = t
		default:
			continue
		}
		s = strings.ToUpper(strings.TrimSpace(s))
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}
