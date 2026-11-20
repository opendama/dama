package rest

import (
	"encoding/json"
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/store"
)

type FingerprintAPI struct {
	Fingerprints *store.FingerprintStore
	Settings     *store.SettingsStore
}

type fingerprintBody struct {
	Fingerprint string `json:"fingerprint"`
	UserAgent   string `json:"user_agent"`
	Platform    string `json:"platform"`
}

func (a *FingerprintAPI) writeAuthProvidersErr(w http.ResponseWriter, status int, key string) {
	msg := ""
	if a.Settings != nil {
		msg = strings.TrimSpace(a.Settings.AuthProvidersChromeString(key))
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

func (a *FingerprintAPI) Upsert(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		auth.WriteUnauthorized(w)
		return
	}
	var body fingerprintBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Fingerprint == "" {
		a.writeAuthProvidersErr(w, http.StatusBadRequest, "err_fingerprint_required")
		return
	}
	ipHint := r.RemoteAddr
	rec, err := a.Fingerprints.Upsert(r.Context(), userID, body.Fingerprint, body.UserAgent, body.Platform, ipHint)
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusInternalServerError, "err_fingerprint_save_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":           rec.ID,
		"fingerprint":  rec.Fingerprint,
		"platform":     rec.Platform,
		"last_seen_at": rec.LastSeenAt,
	})
}

func (a *FingerprintAPI) ListMine(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		auth.WriteUnauthorized(w)
		return
	}
	list, err := a.Fingerprints.ListByUser(r.Context(), userID, 50)
	if err != nil {
		a.writeAuthProvidersErr(w, http.StatusInternalServerError, "err_fingerprint_list_failed")
		return
	}
	out := make([]map[string]any, 0, len(list))
	for _, rec := range list {
		out = append(out, map[string]any{
			"id":           rec.ID,
			"fingerprint":  rec.Fingerprint,
			"platform":     rec.Platform,
			"last_seen_at": rec.LastSeenAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"fingerprints": out})
}
