package rest

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

// LegalAPI serves public legal documents and chrome (DB-backed only).
type LegalAPI struct {
	Legal    *store.LegalStore
	Settings *store.SettingsStore
}

// LegalChrome returns platform_settings.legal_chrome (fail closed).
func (a *PaymentsAPI) LegalChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "legal chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.LegalChromeJSON(r.Context()) },
		[]string{
			"privacy_title", "terms_title", "refunds_title", "last_updated_label",
			"privacy_nav_label", "terms_nav_label", "refunds_nav_label", "support_email_key",
			"legal_unavailable", "back_action",
			"err_doc_not_found", "err_content_unavailable",
		},
	)
}

// StoreComplianceChrome returns platform_settings.store_compliance_chrome (fail closed).
func (a *PaymentsAPI) StoreComplianceChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "store compliance chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.StoreComplianceChromeJSON(r.Context()) },
		[]string{
			"account_section_title",
			"delete_account_title", "delete_account_blurb", "delete_account_action",
			"delete_account_confirm", "delete_account_confirm_token",
			"delete_account_pending", "delete_account_failed", "delete_account_success",
			"export_data_title", "export_data_blurb", "export_data_action", "export_data_pending", "export_data_failed",
			"export_filename",
			"privacy_link_label", "terms_link_label", "refunds_link_label",
			"store_compliance_unavailable", "err_unauthorized",
		},
	)
}

// LegalDoc returns privacy, terms, or refunds sections plus support_email from the database only.
func (a *LegalAPI) LegalDoc(w http.ResponseWriter, r *http.Request) {
	kind := strings.ToLower(strings.TrimSpace(chi.URLParam(r, "kind")))
	if kind != "privacy" && kind != "terms" && kind != "refunds" {
		writeLegalChromeError(w, a.Settings, r.Context(), http.StatusNotFound, "err_doc_not_found")
		return
	}
	if a.Legal == nil || a.Settings == nil {
		writeLegalChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_content_unavailable")
		return
	}
	sections, err := a.Legal.ListByKind(r.Context(), kind)
	if err != nil {
		writeLegalChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_content_unavailable")
		return
	}
	supportEmail, err := a.Settings.SupportEmail(r.Context())
	if err != nil {
		writeLegalChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_content_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"sections":      sections,
		"support_email": supportEmail,
	})
}

// DeleteAccount hard-deletes the authenticated user (store compliance).
func (a *AuthAPI) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" {
		auth.WriteUnauthorized(w)
		return
	}
	if a.Users == nil {
		writeStoreComplianceError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "delete_account_failed")
		return
	}
	if err := a.Users.HardDelete(r.Context(), uid); err != nil {
		writeStoreComplianceError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "delete_account_failed")
		return
	}
	if claims := auth.ClaimsFromContext(r.Context()); claims != nil && a.Revoked != nil {
		until := time.Now().UTC().Add(72 * time.Hour)
		if claims.ExpiresAt != nil {
			until = claims.ExpiresAt.Time
		}
		_ = a.Revoked.Revoke(r.Context(), claims.ID, until)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// DataExport downloads an Excel (.xlsx) copy of public-safe account fields.
func (a *AuthAPI) DataExport(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r.Context())
	if uid == "" {
		auth.WriteUnauthorized(w)
		return
	}
	if a.Users == nil {
		writeStoreComplianceError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "export_data_failed")
		return
	}
	payload, err := a.Users.DataExport(r.Context(), uid)
	if err != nil {
		writeStoreComplianceError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "export_data_failed")
		return
	}
	raw, err := buildAccountDataExportXLSX(payload)
	if err != nil {
		writeStoreComplianceError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "export_data_failed")
		return
	}
	filename := ""
	if a.Settings != nil {
		chromeRaw, chromeErr := a.Settings.StoreComplianceChromeJSON(r.Context())
		if chromeErr == nil {
			var chrome map[string]any
			if json.Unmarshal(chromeRaw, &chrome) == nil {
				filename = strings.TrimSpace(fmtString(chrome["export_filename"]))
			}
		}
	}
	if filename == "" {
		writeStoreComplianceError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "export_data_failed")
		return
	}
	// Fail closed: clients must receive a real spreadsheet, never JSON disguised as download.
	if !strings.HasSuffix(strings.ToLower(filename), ".xlsx") {
		writeStoreComplianceError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "export_data_failed")
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func fmtString(v any) string {
	s, _ := v.(string)
	return s
}
