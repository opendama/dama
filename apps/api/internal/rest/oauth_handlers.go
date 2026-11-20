package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/store"
)

type oauthExchangeBody struct {
	AccessToken string `json:"access_token"`
}

func (a *AuthAPI) writeAuthProvidersErr(w http.ResponseWriter, status int, key string) {
	msg := ""
	if a.Settings != nil {
		msg = strings.TrimSpace(a.Settings.AuthProvidersChromeString(key))
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

// ListAuthProviders returns DB-backed Google social sign-in chrome.
func (a *AuthAPI) ListAuthProviders(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "login_auth_providers_unavailable")
		return
	}
	raw, err := a.Settings.AuthProvidersJSON(r.Context())
	if err != nil || len(raw) == 0 {
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "login_auth_providers_unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

// ExchangeSupabaseOAuth verifies a Supabase Google session and issues a dama JWT.
func (a *AuthAPI) ExchangeSupabaseOAuth(w http.ResponseWriter, r *http.Request) {
	if strings.TrimSpace(a.SupabaseURL) == "" {
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "login_missing_supabase_env")
		return
	}
	var body oauthExchangeBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.AccessToken) == "" {
		a.writeAuthProvidersErr(w, http.StatusBadRequest, "err_access_token_required")
		return
	}

	ident, err := auth.VerifySupabaseAccessToken(body.AccessToken, a.SupabaseJWTSecret, a.SupabaseURL)
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusUnauthorized, "err_invalid_oauth_token")
		return
	}
	if ident.Email == "" {
		a.writeAuthProvidersErr(w, http.StatusBadRequest, "login_oauth_email_missing")
		return
	}

	// Email-policy for brand-new OAuth identities only (mobile + complete page exchange).
	// Returning linked users skip denylist (same rule as Trim handle_new_user / callback).
	if a.Users != nil {
		_, lookupErr := a.Users.GetBySupabaseID(r.Context(), ident.Sub)
		if lookupErr != nil {
			if !strings.Contains(lookupErr.Error(), "user not found") {
				a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "err_email_policy_unavailable")
				return
			}
			if a.DB == nil || !a.DB.Ready() {
				a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "err_email_policy_unavailable")
				return
			}
			var denied bool
			if qerr := a.DB.Pool.QueryRow(r.Context(), `SELECT email_domain_is_denied($1)`, ident.Email).Scan(&denied); qerr != nil {
				a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "err_email_policy_unavailable")
				return
			}
			if denied {
				a.writeAuthProvidersErr(w, http.StatusForbidden, "err_oauth_email_denied")
				return
			}
		}
	}

	// Allow-list is database-only (auth_providers.providers). Every linked IdP must be listed.
	allowSet := map[string]struct{}{}
	if a.Settings != nil {
		providers, perr := a.Settings.AllowedAuthProviders(r.Context())
		if perr == nil {
			for _, p := range providers {
				p = strings.ToLower(strings.TrimSpace(p))
				if p != "" {
					allowSet[p] = struct{}{}
				}
			}
		}
	}
	if len(allowSet) == 0 {
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "login_auth_providers_unavailable")
		return
	}
	checkProviders := ident.Providers
	if len(checkProviders) == 0 && ident.Provider != "" {
		checkProviders = []string{ident.Provider}
	}
	if ident.Provider == "" || len(checkProviders) == 0 {
		a.writeAuthProvidersErr(w, http.StatusForbidden, "login_provider_disabled_message")
		return
	}
	for _, p := range checkProviders {
		if _, ok := allowSet[strings.ToLower(strings.TrimSpace(p))]; !ok {
			a.writeAuthProvidersErr(w, http.StatusForbidden, "login_provider_disabled_message")
			return
		}
	}
	// Upsert path is Google-linked identities only (DB currently lists google).
	if strings.ToLower(strings.TrimSpace(ident.Provider)) != "google" {
		a.writeAuthProvidersErr(w, http.StatusForbidden, "login_provider_disabled_message")
		return
	}

	role := ""
	if a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			role = enums.DefaultRole
		}
	}
	if role == "" {
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "err_default_role_unavailable")
		return
	}

	username, err := oauthUsername(ident.Name, ident.Email, ident.Sub)
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusBadRequest, "err_username_unavailable")
		return
	}
	username, err = ensureUniqueUsername(r.Context(), a.Users, username)
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusConflict, "err_account_create_failed")
		return
	}

	startingRating := -1
	if a.Settings != nil {
		rewards := a.Settings.MatchRewards()
		if rewards.Source == "database" && rewards.StartingRating >= rewards.RatingFloor && rewards.RatingFloor >= 0 {
			startingRating = rewards.StartingRating
		}
	}
	if startingRating < 0 {
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "err_sign_in_incomplete")
		return
	}

	user, err := a.Users.UpsertOAuthGoogle(r.Context(), ident.Sub, ident.Email, username, role, ident.Avatar, startingRating)
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusConflict, "err_sign_in_incomplete")
		return
	}
	if !user.IsActive {
		a.writeAuthProvidersErr(w, http.StatusForbidden, "err_account_disabled")
		return
	}
	// Profile country/flags: verified GeoIP / localhost invent at sign-in (never client-spoofed).
	applyVerifiedGeoIPToUser(r.Context(), a.Users, a.Geo, a.Settings, r, user.ID)
	if refreshed, err := a.Users.GetByID(r.Context(), user.ID); err == nil && refreshed != nil {
		user = refreshed
	}

	token, exp, err := a.Tokens.Issue(user.ID, user.Username, user.Role)
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusInternalServerError, "err_token_issue_failed")
		return
	}
	out := user.Self()
	stampHostTrustFields(a.Cash, user.PhoneKycVerifiedAt != nil, user.DocumentKycVerifiedAt != nil, out)
	writeJSON(w, http.StatusOK, map[string]any{
		"access_token": token,
		"token_type":   "Bearer",
		"expires_at":   exp,
		"user":         out,
	})
}

var nonUser = regexp.MustCompile(`[^a-z0-9_]+`)

// oauthUsername derives a handle from IdP name/email/sub only (no invented English seed).
func oauthUsername(name, email, sub string) (string, error) {
	base := strings.TrimSpace(strings.ToLower(name))
	if base == "" {
		if at := strings.IndexByte(email, '@'); at > 0 {
			base = email[:at]
		}
	}
	var b strings.Builder
	for _, r := range base {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' {
			b.WriteRune(unicode.ToLower(r))
		} else if unicode.IsSpace(r) || r == '-' || r == '.' {
			b.WriteByte('_')
		}
	}
	out := nonUser.ReplaceAllString(b.String(), "")
	out = strings.Trim(out, "_")
	if len(out) < 3 {
		// Last resort: sanitize trailing chars of Google subject (IdP identity, not invent).
		subClean := nonUser.ReplaceAllString(strings.ToLower(strings.TrimSpace(sub)), "")
		if len(subClean) < 8 {
			return "", fmt.Errorf("unable to derive username")
		}
		out = "g" + subClean[len(subClean)-8:]
	}
	if len(out) > 24 {
		out = out[:24]
	}
	return out, nil
}

func ensureUniqueUsername(ctx context.Context, users *store.UserStore, base string) (string, error) {
	candidate := base
	for i := 0; i < 50; i++ {
		_, err := users.GetByUsername(ctx, candidate)
		if err != nil {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s%d", base, i+2)
		if len(candidate) > 28 {
			candidate = candidate[:28]
		}
	}
	return "", fmt.Errorf("username exhausted")
}
