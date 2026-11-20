package rest

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/redisx"
	"dama/apps/api/internal/store"
)

type OTPAPI struct {
	OTP      *store.OTPStore
	Flags    *store.FlagStore
	Users    *store.UserStore
	Redis    *redisx.Client
	Settings *store.SettingsStore
}

type otpStartBody struct {
	Channel string `json:"channel"`
}

func writeOTPChromeError(w http.ResponseWriter, settings *store.SettingsStore, status int, key string) {
	msg := ""
	if settings != nil {
		msg = strings.TrimSpace(settings.OTPChromeString(key))
	}
	// Fail closed: always emit error_key so clients map without parsing English copy.
	writeJSON(w, status, map[string]string{"error": msg, "error_key": strings.TrimSpace(key)})
}

func (a *OTPAPI) Start(w http.ResponseWriter, r *http.Request) {
	flags := a.Flags.Get(r.Context())
	if !flags.OTPRequired {
		writeOTPChromeError(w, a.Settings, http.StatusBadRequest, "err_not_required")
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeOTPChromeError(w, a.Settings, http.StatusUnauthorized, "err_unauthorized")
		return
	}
	var body otpStartBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Channel == "" {
		body.Channel = "email"
	}
	code, id, err := a.OTP.Issue(r.Context(), userID, body.Channel)
	if err != nil {
		writeOTPChromeError(w, a.Settings, http.StatusInternalServerError, "verification_start_failed")
		return
	}
	// Code is hashed at rest. Delivery is OPS_EXTERNAL (email/SMS provider). Never return plaintext.
	_ = code
	log.Printf("otp: challenge issued channel=%s", body.Channel)
	writeJSON(w, http.StatusCreated, map[string]any{
		"challenge_id": id,
		"channel":      body.Channel,
		"expires_in":   600,
	})
}

type otpVerifyBody struct {
	ChallengeID string `json:"challenge_id"`
	Code        string `json:"code"`
}

func (a *OTPAPI) Verify(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeOTPChromeError(w, a.Settings, http.StatusUnauthorized, "err_unauthorized")
		return
	}
	var body otpVerifyBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ChallengeID == "" || body.Code == "" {
		writeOTPChromeError(w, a.Settings, http.StatusBadRequest, "err_challenge_required")
		return
	}
	if err := a.OTP.Verify(r.Context(), body.ChallengeID, userID, body.Code); err != nil {
		writeOTPChromeError(w, a.Settings, http.StatusUnauthorized, "invalid_code")
		return
	}
	if a.Redis != nil && a.Redis.Ready() {
		_ = a.Redis.RDB.Set(r.Context(), "dama:otp:ok:"+userID, "1", 24*time.Hour).Err()
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "verified"})
}

var (
	errOTPUnauthorized            = errors.New("otp_unauthorized")
	errOTPVerificationUnavailable = errors.New("otp_verification_unavailable")
	errOTPVerificationRequired    = errors.New("otp_verification_required")
)

// MapOTPVerifiedError turns EnsureOTPVerified sentinel errors into DB otp_chrome copy.
func MapOTPVerifiedError(settings *store.SettingsStore, err error) error {
	if err == nil {
		return nil
	}
	key := ""
	switch {
	case errors.Is(err, errOTPUnauthorized):
		key = "err_unauthorized"
	case errors.Is(err, errOTPVerificationUnavailable):
		key = "err_verification_unavailable"
	case errors.Is(err, errOTPVerificationRequired):
		key = "err_verification_required"
	default:
		return err
	}
	msg := ""
	if settings != nil {
		msg = strings.TrimSpace(settings.OTPChromeString(key))
	}
	if msg == "" {
		return errors.New("")
	}
	return errors.New(msg)
}

// EnsureOTPVerified is the shared OTP gate for REST middleware and WSS invite/move paths.
func EnsureOTPVerified(ctx context.Context, flags *store.FlagStore, redisClient *redisx.Client, userID string) error {
	if flags == nil || !flags.Get(ctx).OTPRequired {
		return nil
	}
	if userID == "" {
		return errOTPUnauthorized
	}
	// Guest practice JWTs are VS-AI only - never require phone OTP.
	if claims := auth.ClaimsFromContext(ctx); claims != nil && claims.Role == "guest" {
		return nil
	}
	if redisClient == nil || !redisClient.Ready() {
		return errOTPVerificationUnavailable
	}
	n, err := redisClient.RDB.Exists(ctx, "dama:otp:ok:"+userID).Result()
	if err != nil || n == 0 {
		return errOTPVerificationRequired
	}
	return nil
}

// RequireOTPWhenEnabled blocks authenticated mutating player flows when the OTP flag is on
// and the user has not completed verification in the current 24h window.
func RequireOTPWhenEnabled(flags *store.FlagStore, redisClient *redisx.Client, settings *store.SettingsStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := auth.UserIDFromContext(r.Context())
			if err := EnsureOTPVerified(r.Context(), flags, redisClient, userID); err != nil {
				switch {
				case errors.Is(err, errOTPUnauthorized):
					writeOTPChromeError(w, settings, http.StatusUnauthorized, "err_unauthorized")
				case errors.Is(err, errOTPVerificationUnavailable):
					writeOTPChromeError(w, settings, http.StatusServiceUnavailable, "err_verification_unavailable")
				default:
					writeOTPChromeError(w, settings, http.StatusForbidden, "err_verification_required")
				}
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
