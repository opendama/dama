package rest

import (
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type NotificationsAPI struct {
	DB       *db.Handle
	Settings *store.SettingsStore
}

func (a *NotificationsAPI) notifChrome(r *http.Request) notifications.Chrome {
	if a.DB == nil || !a.DB.Ready() {
		return notifications.Chrome{}
	}
	return notifications.LoadChrome(r.Context(), a.DB.Pool)
}

func writeNotifChromeError(w http.ResponseWriter, chrome notifications.Chrome, status int, msg string) {
	msg = strings.TrimSpace(msg)
	if msg == "" {
		msg = strings.TrimSpace(chrome.Unavailable)
	}
	if msg == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": ""})
		return
	}
	writeClientError(w, status, msg)
}

func (a *NotificationsAPI) ListMine(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, notifications.AudiencePlayer)
}

func (a *NotificationsAPI) UnreadMine(w http.ResponseWriter, r *http.Request) {
	a.unread(w, r, notifications.AudiencePlayer)
}

func (a *NotificationsAPI) MarkReadMine(w http.ResponseWriter, r *http.Request) {
	a.markRead(w, r, notifications.AudiencePlayer)
}

func (a *NotificationsAPI) MarkAllReadMine(w http.ResponseWriter, r *http.Request) {
	a.markAllRead(w, r, notifications.AudiencePlayer)
}

func (a *NotificationsAPI) ListConsole(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, notifications.AudienceAdmin)
}

func (a *NotificationsAPI) UnreadConsole(w http.ResponseWriter, r *http.Request) {
	a.unread(w, r, notifications.AudienceAdmin)
}

func (a *NotificationsAPI) MarkReadConsole(w http.ResponseWriter, r *http.Request) {
	a.markRead(w, r, notifications.AudienceAdmin)
}

func (a *NotificationsAPI) MarkAllReadConsole(w http.ResponseWriter, r *http.Request) {
	a.markAllRead(w, r, notifications.AudienceAdmin)
}

func (a *NotificationsAPI) list(w http.ResponseWriter, r *http.Request, audience string) {
	chrome := a.notifChrome(r)
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeNotifChromeError(w, chrome, http.StatusUnauthorized, chrome.ErrUnauthorized)
		return
	}
	if a.DB == nil || !a.DB.Ready() {
		writeNotifChromeError(w, chrome, http.StatusServiceUnavailable, chrome.Unavailable)
		return
	}
	labels, maxLimit, skipCap, ok := paginationLabelsFromSettings(r.Context(), a.Settings)
	if !ok {
		writeNotifChromeError(w, chrome, http.StatusServiceUnavailable, chrome.Unavailable)
		return
	}
	result, err := notifications.List(r.Context(), a.DB.Pool, r, userID, audience, maxLimit, skipCap, labels)
	if err != nil {
		code := err.Error()
		if code == "DATABASE_UNAVAILABLE" {
			writeNotifChromeError(w, chrome, http.StatusServiceUnavailable, chrome.Unavailable)
			return
		}
		writeNotifChromeError(w, chrome, http.StatusBadRequest, chrome.ListFailed)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *NotificationsAPI) unread(w http.ResponseWriter, r *http.Request, audience string) {
	chrome := a.notifChrome(r)
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeNotifChromeError(w, chrome, http.StatusUnauthorized, chrome.ErrUnauthorized)
		return
	}
	if a.DB == nil || !a.DB.Ready() {
		writeNotifChromeError(w, chrome, http.StatusServiceUnavailable, chrome.Unavailable)
		return
	}
	count, badge, chromeOut, err := notifications.UnreadCount(r.Context(), a.DB.Pool, userID, audience)
	if err != nil {
		writeNotifChromeError(w, chromeOut, http.StatusInternalServerError, chromeOut.CountFailed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"count":       count,
		"badge_label": badge,
		"chrome":      chromeOut,
	})
}

func (a *NotificationsAPI) markRead(w http.ResponseWriter, r *http.Request, audience string) {
	chrome := a.notifChrome(r)
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeNotifChromeError(w, chrome, http.StatusUnauthorized, chrome.ErrUnauthorized)
		return
	}
	if a.DB == nil || !a.DB.Ready() {
		writeNotifChromeError(w, chrome, http.StatusServiceUnavailable, chrome.Unavailable)
		return
	}
	id := chi.URLParam(r, "id")
	err := notifications.MarkRead(r.Context(), a.DB.Pool, userID, audience, id)
	if err == pgx.ErrNoRows {
		writeNotifChromeError(w, chrome, http.StatusNotFound, chrome.MarkFailed)
		return
	}
	if err != nil {
		writeNotifChromeError(w, chrome, http.StatusInternalServerError, chrome.MarkFailed)
		return
	}
	msg := strings.TrimSpace(chrome.MarkReadDone)
	if msg == "" {
		writeNotifChromeError(w, chrome, http.StatusServiceUnavailable, chrome.Unavailable)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": msg})
}

func (a *NotificationsAPI) markAllRead(w http.ResponseWriter, r *http.Request, audience string) {
	chrome := a.notifChrome(r)
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeNotifChromeError(w, chrome, http.StatusUnauthorized, chrome.ErrUnauthorized)
		return
	}
	if a.DB == nil || !a.DB.Ready() {
		writeNotifChromeError(w, chrome, http.StatusServiceUnavailable, chrome.Unavailable)
		return
	}
	if err := notifications.MarkAllRead(r.Context(), a.DB.Pool, userID, audience); err != nil {
		writeNotifChromeError(w, chrome, http.StatusInternalServerError, chrome.MarkFailed)
		return
	}
	msg := strings.TrimSpace(chrome.MarkAllReadDone)
	if msg == "" {
		writeNotifChromeError(w, chrome, http.StatusServiceUnavailable, chrome.Unavailable)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": msg})
}
