package rest

import (
	"net/http"
	"strings"

	"dama/apps/api/internal/db"
)

// EmailPolicyAPI serves GET /public/email-policy?email=
type EmailPolicyAPI struct {
	DB *db.Handle
}

// Check returns whether the email domain is allowed for new OAuth sign-ups.
func (a *EmailPolicyAPI) Check(w http.ResponseWriter, r *http.Request) {
	email := strings.TrimSpace(r.URL.Query().Get("email"))
	if email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"allowed": false,
			"code":    "oauth_email_denied",
		})
		return
	}
	if a.DB == nil || !a.DB.Ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"allowed": false,
			"code":    "auth_providers_unavailable",
		})
		return
	}
	var denied bool
	err := a.DB.Pool.QueryRow(r.Context(), `SELECT email_domain_is_denied($1)`, email).Scan(&denied)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"allowed": false,
			"code":    "auth_providers_unavailable",
		})
		return
	}
	if denied {
		writeJSON(w, http.StatusOK, map[string]any{
			"allowed": false,
			"code":    "oauth_email_denied",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"allowed": true})
}
