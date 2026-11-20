package rest

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/media"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

// KycAPI serves government-ID document KYC for payouts.
type KycAPI struct {
	Cash     *store.CashRmgStore
	Docs     *store.KycDocumentStore
	Avatars  *media.AvatarService
	Settings *store.SettingsStore
	Flags    *store.FlagStore
	DB       *db.Handle
	Users    *store.UserStore
}

func (a *KycAPI) docChrome() store.CashRmgChrome {
	if a.Cash == nil {
		return store.CashRmgChrome{}
	}
	return a.Cash.Chrome()
}

func (a *KycAPI) typeAllowed(docType string, types []string) bool {
	docType = strings.TrimSpace(docType)
	for _, t := range types {
		if t == docType {
			return true
		}
	}
	return false
}

func (a *KycAPI) completeForSubmit(doc *store.KycDocumentSubmission, passportType string) bool {
	if doc == nil {
		return false
	}
	if strings.TrimSpace(doc.LegalName) == "" || strings.TrimSpace(doc.IDFrontURL) == "" || strings.TrimSpace(doc.SelfieURL) == "" {
		return false
	}
	if !a.kycMediaURLAllowed(doc.IDFrontURL, false) || !a.kycMediaURLAllowed(doc.SelfieURL, false) {
		return false
	}
	if doc.DocumentType != passportType {
		if strings.TrimSpace(doc.IDBackURL) == "" || !a.kycMediaURLAllowed(doc.IDBackURL, false) {
			return false
		}
	}
	return true
}

// kycMediaURLAllowed accepts only URLs produced by UploadKycImage:
// - relative local: /api/v1/media/kyc/… (no foreign host)
// - loopback local: http(s)://localhost|127.0.0.1/api/v1/media/kyc/…
// - CDN: path contains /dama/kyc/ on cloudinary.com or DAMA_MEDIA_PUBLIC_BASE host
func (a *KycAPI) kycMediaURLAllowed(raw string, allowEmpty bool) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return allowEmpty
	}
	u, err := url.Parse(raw)
	if err != nil || u == nil {
		return false
	}
	path := strings.ToLower(u.EscapedPath())
	if path == "" {
		path = strings.ToLower(u.Path)
	}
	if strings.Contains(path, "..") {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if strings.HasPrefix(path, "/api/v1/media/kyc/") {
		// Relative app media, or explicit loopback only (never arbitrary hosts).
		return host == "" || host == "localhost" || host == "127.0.0.1" || host == "::1"
	}
	if !strings.Contains(path, "/dama/kyc/") {
		return false
	}
	if host == "" {
		return false
	}
	if strings.Contains(host, "cloudinary.com") {
		return true
	}
	if a.Avatars != nil {
		if baseHost := a.Avatars.MediaPublicHost(); baseHost != "" && host == baseHost {
			return true
		}
	}
	return false
}

func (a *KycAPI) Mine(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() || a.Docs == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	policy := a.Cash.Policy()
	approved, _ := a.Docs.HasApprovedDocument(r.Context(), userID, policy.DocumentKycApprovedStatus)
	doc, err := a.Docs.LatestForUser(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"submission":                      nil,
			"require_document_kyc_for_payout": policy.RequireDocumentKycForPayout,
			"document_kyc_types":              policy.DocumentKycTypes,
			"approved":                        approved,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"submission":                      doc,
		"require_document_kyc_for_payout": policy.RequireDocumentKycForPayout,
		"document_kyc_types":              policy.DocumentKycTypes,
		"approved":                        approved,
	})
}

func (a *KycAPI) Upload(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	chrome := a.docChrome()
	if a.Cash == nil || !a.Cash.Ready() || a.Avatars == nil {
		writeClientError(w, http.StatusServiceUnavailable, chrome.DocKycFailed)
		return
	}
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycFailed)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycFailed)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycFailed)
		return
	}
	url, err := a.Avatars.UploadKycImage(userID, header.Filename, header.Header.Get("Content-Type"), data)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycFailed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"url": url})
}

func (a *KycAPI) SaveDraft(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	chrome := a.docChrome()
	if a.Cash == nil || !a.Cash.Ready() || a.Docs == nil {
		writeClientError(w, http.StatusServiceUnavailable, chrome.DocKycFailed)
		return
	}
	policy := a.Cash.Policy()
	var body struct {
		DocumentType string `json:"document_type"`
		LegalName    string `json:"legal_name"`
		IDFrontURL   string `json:"id_front_url"`
		IDBackURL    string `json:"id_back_url"`
		SelfieURL    string `json:"selfie_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycFailed)
		return
	}
	body.DocumentType = strings.TrimSpace(body.DocumentType)
	body.LegalName = strings.TrimSpace(body.LegalName)
	if !a.typeAllowed(body.DocumentType, policy.DocumentKycTypes) || body.LegalName == "" {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycIncompleteError)
		return
	}
	front := strings.TrimSpace(body.IDFrontURL)
	back := strings.TrimSpace(body.IDBackURL)
	selfie := strings.TrimSpace(body.SelfieURL)
	passport := body.DocumentType == policy.DocumentKycPassportType
	if front != "" && !a.kycMediaURLAllowed(front, false) {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycIncompleteError)
		return
	}
	if !a.kycMediaURLAllowed(back, passport || back == "") {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycIncompleteError)
		return
	}
	if selfie != "" && !a.kycMediaURLAllowed(selfie, false) {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycIncompleteError)
		return
	}
	latest, _ := a.Docs.LatestForUser(r.Context(), userID)
	if latest != nil && latest.Status == policy.DocumentKycPendingStatus {
		writeClientError(w, http.StatusConflict, chrome.DocKycFailed)
		return
	}
	if latest != nil && latest.Status == policy.DocumentKycApprovedStatus {
		stillOK, _ := a.Docs.HasApprovedDocument(r.Context(), userID, policy.DocumentKycApprovedStatus)
		if stillOK {
			writeClientError(w, http.StatusConflict, chrome.DocKycFailed)
			return
		}
	}
	doc, err := a.Docs.SaveDraft(r.Context(), userID, body.DocumentType, body.LegalName,
		front, back, selfie, policy.DocumentKycDraftStatus)
	if err != nil {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycFailed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"submission": doc,
		"message":    chrome.DocKycSuccess,
	})
}

func (a *KycAPI) Submit(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	chrome := a.docChrome()
	if a.Cash == nil || !a.Cash.Ready() || a.Docs == nil {
		writeClientError(w, http.StatusServiceUnavailable, chrome.DocKycFailed)
		return
	}
	policy := a.Cash.Policy()
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.ID) == "" {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycFailed)
		return
	}
	cur, err := a.Docs.GetByID(r.Context(), body.ID)
	if err != nil || cur == nil || cur.UserID != userID {
		writeClientError(w, http.StatusNotFound, chrome.DocKycFailed)
		return
	}
	if !a.completeForSubmit(cur, policy.DocumentKycPassportType) {
		writeClientError(w, http.StatusBadRequest, chrome.DocKycIncompleteError)
		return
	}
	doc, err := a.Docs.Submit(r.Context(), userID, body.ID, policy.DocumentKycPendingStatus, policy.DocumentKycDraftStatus, policy.DocumentKycRejectedStatus)
	if err != nil {
		writeClientError(w, http.StatusConflict, chrome.DocKycFailed)
		return
	}
	msg := chrome.DocKycSuccess
	autoOn := a.Flags != nil && a.Flags.Get(r.Context()).KycAutoApprove
	if autoOn {
		approved, autoErr := a.Docs.AutoApprovePending(
			r.Context(), doc.ID, policy.DocumentKycApprovedStatus, policy.DocumentKycPendingStatus,
			strings.TrimSpace(chrome.DocKycAutoApprovedSuccess),
		)
		if autoErr != nil {
			writeClientError(w, http.StatusConflict, chrome.DocKycFailed)
			return
		}
		doc = approved
		if s := strings.TrimSpace(chrome.DocKycAutoApprovedSuccess); s != "" {
			msg = s
		}
		if a.DB != nil && a.DB.Ready() && doc != nil {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, doc.UserID, notifications.KindPlayerKycReviewed,
				"kyc_reviewed:"+doc.ID+":"+doc.Status, doc.ID, doc.Status)
		}
	} else if a.DB != nil && a.DB.Ready() && a.Settings != nil {
		uname := userID
		if a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), userID); err == nil && u != nil {
				uname = u.Username
			}
		}
		notifications.EmitAdmins(r.Context(), a.DB.Pool, a.Settings.ClientEnums().ConsoleRoles,
			notifications.KindAdminKycPending, "kyc_pending:"+doc.ID, doc.ID, uname)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"submission": doc,
		"message":    msg,
	})
}

func (a *KycAPI) ListConsole(w http.ResponseWriter, r *http.Request) {
	if a.Cash == nil || !a.Cash.Ready() || a.Docs == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = a.Cash.Policy().DocumentKycPendingStatus
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	list, total, err := a.Docs.ListByStatusPaged(r.Context(), status, params.Skip, params.Limit, q)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": cashUnavailableMsg(a.Cash)})
		return
	}
	if a.Users != nil {
		for i := range list {
			if u, err := a.Users.GetByID(r.Context(), list[i].UserID); err == nil && u != nil {
				list[i].Username = strings.TrimSpace(u.Username)
			}
		}
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"submissions": list, "status": status, "meta": meta})
}

func (a *KycAPI) ReviewConsole(w http.ResponseWriter, r *http.Request) {
	reviewerID := auth.UserIDFromContext(r.Context())
	if reviewerID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if a.Cash == nil || !a.Cash.Ready() || a.Docs == nil {
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
	reviewFail := adminPaymentsChromeString(a.Settings, r.Context(), "doc_kyc_review_failed")
	doc, err := a.Docs.Review(r.Context(), id, strings.TrimSpace(body.Status), body.Note, reviewerID,
		policy.DocumentKycApprovedStatus, policy.DocumentKycRejectedStatus, policy.DocumentKycPendingStatus)
	if err != nil {
		if reviewFail == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": cashUnavailableMsg(a.Cash)})
			return
		}
		writeClientError(w, http.StatusBadRequest, reviewFail)
		return
	}
	if a.DB != nil && a.DB.Ready() && doc != nil {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, doc.UserID, notifications.KindPlayerKycReviewed,
			"kyc_reviewed:"+doc.ID+":"+doc.Status, doc.ID, doc.Status)
	}
	writeJSON(w, http.StatusOK, doc)
}
