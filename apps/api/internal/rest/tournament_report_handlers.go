package rest

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

type reportTournamentBody struct {
	ReasonCode string `json:"reason_code"`
	Note       string `json:"note"`
}

func tournamentReportAllowed(t *store.Tournament, now time.Time) bool {
	if t == nil || t.StartedAt == nil {
		return false
	}
	if t.DisputeWindowEndsAt != nil && now.Before(t.DisputeWindowEndsAt.UTC()) {
		return true
	}
	return t.StartedAt != nil
}

func (a *TournamentAPI) tournamentEmitPool() bool {
	return a != nil && a.DB != nil && a.DB.Ready()
}

func (a *TournamentAPI) Report(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	enums, cat, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	t, err := a.Tournaments.Get(r.Context(), id)
	if err != nil || t == nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if a.Entries == nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_not_enrolled")
		return
	}
	enrolled, err := a.Entries.Exists(r.Context(), t.ID, userID)
	if err != nil || !enrolled {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_not_enrolled")
		return
	}
	if !tournamentReportAllowed(t, time.Now()) {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_report_not_allowed")
		return
	}
	var body reportTournamentBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_json")
		return
	}
	reason := strings.TrimSpace(body.ReasonCode)
	allowed := false
	for _, c := range cat.ReportReasonCodes {
		if c == reason {
			allowed = true
			break
		}
	}
	if !allowed {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_reason_code")
		return
	}
	openStatus := strings.TrimSpace(enums.HostedEventReportOpenStatus)
	if openStatus == "" {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_enrollable_status_unavailable")
		return
	}
	rep, err := a.Tournaments.CreateReport(r.Context(), t.ID, userID, reason, strings.TrimSpace(body.Note), openStatus)
	if err != nil {
		if errors.Is(err, store.ErrTournamentReportConflict) {
			writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_report_already_open")
			return
		}
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_report_submit_failed")
		return
	}
	if a.tournamentEmitPool() {
		notifications.EmitPlayer(r.Context(), a.DB.Pool, userID, notifications.KindPlayerTournamentReportReceived,
			"tournament_report_received:"+rep.ID, t.ID, t.Title)
		reporterName := userID
		if a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), userID); err == nil && u != nil {
				reporterName = u.Username
			}
		}
		notifications.EmitAdmins(r.Context(), a.DB.Pool, enums.ConsoleRoles, notifications.KindAdminTournamentReportPending,
			"admin_tournament_report:"+rep.ID, rep.ID, reporterName, t.Title, reason)
	}
	writeJSON(w, http.StatusCreated, rep)
}

func (a *TournamentAPI) ConsoleListReports(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	list, total, err := a.Tournaments.ListReports(r.Context(), status, params.Skip, params.Limit)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_reports_failed")
		return
	}
	if a.Settings != nil {
		cat := a.Settings.EventsCatalog()
		if cat.Source == "database" {
			for i := range list {
				list[i].ReasonLabel = store.StatusLabel(cat.ReportReasonLabels, list[i].ReasonCode)
			}
		}
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"reports": list, "meta": meta})
}

func (a *TournamentAPI) ConsoleDismissReport(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	dismissed := strings.TrimSpace(enums.HostedEventReportDismissedStatus)
	if dismissed == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "tournament_chrome_unavailable")
		return
	}
	rep, err := a.Tournaments.SetReportStatus(r.Context(), chi.URLParam(r, "id"), dismissed, userID)
	if err != nil {
		if errors.Is(err, store.ErrTournamentReportNotFound) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_report_not_found")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_dismiss_failed")
		return
	}
	writeJSON(w, http.StatusOK, rep)
}

func (a *TournamentAPI) ConsoleResolveReport(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	resolved := strings.TrimSpace(enums.HostedEventReportDeactivatedStatus)
	if resolved == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "tournament_chrome_unavailable")
		return
	}
	rep, err := a.Tournaments.SetReportStatus(r.Context(), chi.URLParam(r, "id"), resolved, userID)
	if err != nil {
		if errors.Is(err, store.ErrTournamentReportNotFound) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_report_not_found")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_resolve_failed")
		return
	}
	writeJSON(w, http.StatusOK, rep)
}
