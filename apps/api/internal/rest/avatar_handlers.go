package rest

import (
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/db"
	"dama/apps/api/internal/media"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"
)

type MediaAPI struct {
	Users     *store.UserStore
	Avatars   *media.AvatarService
	Settings  *store.SettingsStore
	Cash      *store.CashRmgStore
	UploadDir string
	DB        *db.Handle
	Hub       *ws.Hub
}

func (a *MediaAPI) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromContext(r.Context())
	if claims == nil {
		auth.WriteUnauthorized(w)
		return
	}
	if a.Settings == nil {
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_moderation_unavailable")
		return
	}
	mod := a.Settings.Moderation()
	if mod.Source != "database" {
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_moderation_unavailable")
		return
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_invalid_multipart")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_file_required")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, "err_read_failed")
		return
	}
	contentType := header.Header.Get("Content-Type")
	result, err := a.Avatars.ProcessAvatar(claims.UserID, header.Filename, contentType, data, mod)
	if err != nil {
		log.Printf("avatar process user=%s ct=%q name=%q err=%v", claims.UserID, contentType, header.Filename, err)
		key := "err_process_failed"
		switch {
		case strings.Contains(err.Error(), "media upload unavailable"):
			key = "err_media_upload_unavailable"
		case strings.Contains(err.Error(), "moderation config"):
			key = "err_moderation_unavailable"
		case strings.Contains(err.Error(), "only image"), strings.Contains(err.Error(), "not a recognized image"), strings.Contains(err.Error(), "empty file"), strings.Contains(err.Error(), "too large"):
			key = "err_invalid_image"
		}
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusBadRequest, key)
		return
	}
	user, err := a.Users.UpdateAvatar(r.Context(), claims.UserID, result.AvatarThumbURL, result.AvatarFullURL, result.PublicID)
	if err != nil {
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_save_failed")
		return
	}
	modStatus := result.ModerationStatus
	if modStatus == "" {
		modStatus = "pending"
	}
	if result.ModerationPending || modStatus == "pending" || modStatus == "pending_review" {
		user, _ = a.Users.SetAvatarModeration(r.Context(), claims.UserID, "pending")
	} else if modStatus == "approved" {
		user, _ = a.Users.SetAvatarModeration(r.Context(), claims.UserID, "approved")
	} else if modStatus == "rejected" {
		user, _ = a.Users.SetAvatarModeration(r.Context(), claims.UserID, "flagged")
	}
	modOut := result.ModerationStatus
	switch modOut {
	case "pending_admin", "pending_review":
		modOut = "pending"
	case "cloudinary_aws_rek", "admin_only":
		modOut = "pending"
	}
	pending := result.ModerationPending || modOut == "pending"
	if pending && a.DB != nil && a.DB.Ready() && a.Settings != nil {
		uname := claims.UserID
		if user != nil {
			uname = user.Username
		}
		notifications.EmitAdmins(r.Context(), a.DB.Pool, a.Settings.ClientEnums().ConsoleRoles,
			notifications.KindAdminAvatarPending, "avatar_pending:"+claims.UserID, claims.UserID, uname)
	}
	if user == nil {
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_save_failed")
		return
	}
	thumb := result.AvatarThumbURL
	full := result.AvatarFullURL
	if user.AvatarThumbURL != nil && *user.AvatarThumbURL != "" {
		thumb = *user.AvatarThumbURL
	}
	if user.AvatarFullURL != nil && *user.AvatarFullURL != "" {
		full = *user.AvatarFullURL
	}
	if a.Hub != nil {
		a.Hub.BroadcastAvatarUpdated(map[string]any{
			"type":             "avatar_updated",
			"user_id":          claims.UserID,
			"avatar_thumb_url": thumb,
			"avatar_full_url":  full,
		})
	}
	msg := avatarChromeString(a.Settings, r.Context(), "toast_updated")
	out := map[string]any{
		"avatar": map[string]any{
			"thumb_url":          thumb,
			"full_url":           full,
			"moderation_status":  modOut,
			"moderation_pending": pending,
		},
		"message": msg,
	}
	if user != nil {
		self := user.Self()
		stampHostTrustFields(a.Cash, user.PhoneKycVerifiedAt != nil, user.DocumentKycVerifiedAt != nil, self)
		out["user"] = self
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *MediaAPI) ServeLocal(w http.ResponseWriter, r *http.Request) {
	rel := strings.TrimPrefix(r.URL.Path, "/api/v1/media/")
	rel = filepath.Clean(rel)
	if strings.Contains(rel, "..") {
		writeAvatarChromeError(w, a.Settings, r.Context(), http.StatusForbidden, "err_serve_forbidden")
		return
	}
	full := filepath.Join(a.UploadDir, rel)
	if _, err := os.Stat(full); err != nil {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, full)
}
