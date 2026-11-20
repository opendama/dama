package rest

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/geo"
	"dama/apps/api/internal/store"

	"github.com/google/uuid"
)

type AuthAPI struct {
	Users             *store.UserStore
	Tokens            *auth.TokenService
	Revoked           *auth.RevocationList
	Settings          *store.SettingsStore
	Cash              *store.CashRmgStore
	DB                *db.Handle
	Geo               *geo.Resolver
	SupabaseURL       string
	SupabaseJWTSecret string
}

func (a *AuthAPI) Me(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	user, err := a.Users.GetByID(r.Context(), uid)
	if err != nil {
		auth.WriteUnauthorized(w)
		return
	}
	out := user.Self()
	stampHostTrustFields(a.Cash, user.PhoneKycVerifiedAt != nil, user.DocumentKycVerifiedAt != nil, out)
	writeJSON(w, http.StatusOK, map[string]any{"user": out})
}

func (a *AuthAPI) Logout(w http.ResponseWriter, r *http.Request) {
	if claims := auth.ClaimsFromContext(r.Context()); claims != nil && a.Revoked != nil {
		until := time.Now().UTC().Add(72 * time.Hour)
		if claims.ExpiresAt != nil {
			until = claims.ExpiresAt.Time
		}
		_ = a.Revoked.Revoke(r.Context(), claims.ID, until)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GuestSession mints a short-lived practice JWT (role=guest) for free VS-AI only.
// No DB user row - matchmaking/wallet/ops must reject guest role.
func (a *AuthAPI) GuestSession(w http.ResponseWriter, r *http.Request) {
	guestName := ""
	if a.Settings != nil {
		guestName = strings.TrimSpace(a.Settings.AuthProvidersChromeString("guest_username"))
	}
	if a.Tokens == nil || guestName == "" {
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "err_auth_unavailable")
		return
	}
	uid := uuid.NewString()
	token, exp, err := a.Tokens.Issue(uid, guestName, "guest")
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusInternalServerError, "err_token_issue_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"access_token": token,
		"token_type":   "Bearer",
		"expires_at":   exp,
		"user": map[string]any{
			"id":       uid,
			"username": guestName,
			"role":     "guest",
		},
	})
}

// E2ESession mints a social-style session for automated smoke only.
// Enabled solely when DAMA_ALLOW_E2E_AUTH=1 (never in production).
func (a *AuthAPI) E2ESession(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("DAMA_ALLOW_E2E_AUTH") != "1" {
		a.writeAuthProvidersErr(w, http.StatusNotFound, "err_unauthorized")
		return
	}
	var body struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		a.writeAuthProvidersErr(w, http.StatusBadRequest, "err_invalid_json")
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Username == "" || body.Email == "" {
		a.writeAuthProvidersErr(w, http.StatusBadRequest, "err_e2e_identity_required")
		return
	}
	role := strings.TrimSpace(body.Role)
	if role == "" && a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			role = enums.DefaultRole
		}
	}
	if role == "" {
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "err_default_role_unavailable")
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
		a.writeAuthProvidersErr(w, http.StatusServiceUnavailable, "err_account_create_failed")
		return
	}
	// supabase_user_id is UUID in Postgres; mint a stable UUIDv5-style id from username.
	fakeSub := uuid.NewSHA1(uuid.NameSpaceOID, []byte("dama-e2e:"+body.Username)).String()
	user, err := a.Users.UpsertOAuthGoogle(r.Context(), fakeSub, body.Email, body.Username, role, "", startingRating)
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusConflict, "err_account_create_failed")
		return
	}
	// Optional role override for console tests (must be an allowed console role).
	if body.Role != "" && a.Settings != nil && a.Settings.IsAllowedRole(body.Role) {
		if updated, err := a.Users.SetRole(r.Context(), user.ID, body.Role); err == nil && updated != nil {
			user = updated
		} else {
			user, _ = a.Users.GetByID(r.Context(), user.ID)
		}
	}
	if user == nil || !user.IsActive {
		a.writeAuthProvidersErr(w, http.StatusForbidden, "err_account_disabled")
		return
	}
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
