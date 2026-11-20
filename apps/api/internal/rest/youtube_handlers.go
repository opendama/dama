package rest

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"dama/apps/api/internal/media"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/youtube"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type YouTubeAPI struct {
	Pool     *youtube.Pool
	Worker   *youtube.Worker
	Settings *store.SettingsStore
}

type registerChannelBody struct {
	ChannelID       string `json:"channel_id"`
	Label           string `json:"label"`
	ClientID        string `json:"client_id"`
	ClientSecret    string `json:"client_secret"`
	RefreshToken    string `json:"refresh_token"`
	APIKey          string `json:"api_key"`
	DailyQuotaLimit int    `json:"daily_quota_limit"`
}

func (a *YouTubeAPI) ListChannels(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	list, total := a.Pool.ListPaged(params.Skip, params.Limit, q, status)
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"channels": list, "meta": meta})
}

func (a *YouTubeAPI) RegisterChannel(w http.ResponseWriter, r *http.Request) {
	var body registerChannelBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_invalid_json")
		return
	}
	ch, err := a.Pool.Register(r.Context(), youtube.RegisterInput{
		ChannelID:       body.ChannelID,
		Label:           body.Label,
		ClientID:        body.ClientID,
		ClientSecret:    body.ClientSecret,
		RefreshToken:    body.RefreshToken,
		APIKey:          body.APIKey,
		DailyQuotaLimit: body.DailyQuotaLimit,
	})
	if err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_register_failed")
		return
	}
	writeJSON(w, http.StatusCreated, ch)
}

type setActiveBody struct {
	Active bool `json:"active"`
}

func (a *YouTubeAPI) SetActive(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body setActiveBody
	_ = json.NewDecoder(r.Body).Decode(&body)
	if err := a.Pool.SetActive(r.Context(), id, body.Active); err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusNotFound, "err_channel_not_found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type updateChannelBody struct {
	ChannelID       *string `json:"channel_id"`
	Label           *string `json:"label"`
	ClientID        *string `json:"client_id"`
	ClientSecret    *string `json:"client_secret"`
	RefreshToken    *string `json:"refresh_token"`
	APIKey          *string `json:"api_key"`
	DailyQuotaLimit *int    `json:"daily_quota_limit"`
	SortOrder       *int    `json:"sort_order"`
	Active          *bool   `json:"active"`
	IsActive        *bool   `json:"is_active"`
}

func (a *YouTubeAPI) UpdateChannel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body updateChannelBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_invalid_json")
		return
	}
	active := body.Active
	if active == nil {
		active = body.IsActive
	}
	if body.DailyQuotaLimit != nil && *body.DailyQuotaLimit < 1 {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_quota_invalid")
		return
	}
	if body.SortOrder != nil && *body.SortOrder < 0 {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_sort_order_invalid")
		return
	}
	ch, err := a.Pool.Update(r.Context(), id, youtube.UpdateInput{
		ChannelID:       body.ChannelID,
		Label:           body.Label,
		ClientID:        body.ClientID,
		ClientSecret:    body.ClientSecret,
		RefreshToken:    body.RefreshToken,
		APIKey:          body.APIKey,
		DailyQuotaLimit: body.DailyQuotaLimit,
		SortOrder:       body.SortOrder,
		IsActive:        active,
	})
	if err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_channel_update_failed")
		return
	}
	writeJSON(w, http.StatusOK, ch)
}

func (a *YouTubeAPI) DeleteChannel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.Pool.Delete(r.Context(), id); err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusNotFound, "err_channel_not_found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// mediaPoolErr returns DB admin_console_chrome.media_pool copy only (fail closed: empty when missing).
func mediaPoolErr(settings *store.SettingsStore, key, _ string) string {
	if settings == nil {
		return ""
	}
	raw, err := settings.AdminConsoleChromeJSON(context.Background())
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return ""
	}
	section, _ := doc["media_pool"].(map[string]any)
	if section == nil {
		return ""
	}
	msg, _ := section[key].(string)
	return strings.TrimSpace(msg)
}

func writeMediaPoolErr(w http.ResponseWriter, settings *store.SettingsStore, status int, key string) {
	msg := mediaPoolErr(settings, key, "")
	if msg == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": ""})
		return
	}
	writeClientError(w, status, msg)
}

func (a *YouTubeAPI) TestChannel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	out, err := a.Pool.TestChannel(r.Context(), id)
	if err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusNotFound, "err_channel_not_found")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type uploadBody struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	LocalPath   string `json:"local_path"`
	Async       bool   `json:"async"`
}

func (a *YouTubeAPI) Upload(w http.ResponseWriter, r *http.Request) {
	var body uploadBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_invalid_json")
		return
	}
	if body.Title == "" {
		body.Title = mediaPoolErr(a.Settings, "default_upload_title", "")
		if body.Title == "" {
			writeMediaPoolErr(w, a.Settings, http.StatusServiceUnavailable, "default_upload_title")
			return
		}
	}
	if body.Async && a.Worker != nil {
		jobID := uuid.NewString()
		err := a.Worker.Enqueue(r.Context(), youtube.UploadJob{
			JobID:       jobID,
			Title:       body.Title,
			Description: body.Description,
			LocalPath:   body.LocalPath,
		})
		if err != nil {
			writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_upload_queue_failed")
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"status": "queued", "job_id": jobID})
		return
	}
	result, err := a.Pool.UploadVideo(r.Context(), body.Title, body.Description, body.LocalPath)
	if err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_upload_failed")
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (a *YouTubeAPI) maxVideoBytes() (int64, bool) {
	if a.Settings == nil {
		return 0, false
	}
	raw := strings.TrimSpace(a.Settings.AdRuntimeChromeString("viewport_max_video_bytes"))
	if raw == "" {
		return 0, false
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v < 1 {
		return 0, false
	}
	return v, true
}

// UploadMultipart accepts a browser file upload, stores a temp path, then uses pool failover.
func (a *YouTubeAPI) UploadMultipart(w http.ResponseWriter, r *http.Request) {
	maxBytes, maxOK := a.maxVideoBytes()
	if !maxOK {
		writeMediaPoolErr(w, a.Settings, http.StatusServiceUnavailable, "err_upload_failed")
		return
	}
	if err := r.ParseMultipartForm(maxBytes); err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_upload_file_required")
		return
	}
	title := strings.TrimSpace(r.FormValue("title"))
	description := strings.TrimSpace(r.FormValue("description"))
	async := true
	if v := strings.TrimSpace(r.FormValue("async")); v == "false" || v == "0" {
		async = false
	}
	if title == "" {
		title = mediaPoolErr(a.Settings, "default_upload_title", "")
		if title == "" {
			writeMediaPoolErr(w, a.Settings, http.StatusServiceUnavailable, "default_upload_title")
			return
		}
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_upload_file_required")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_read_failed")
		return
	}
	if int64(len(data)) > maxBytes {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_upload_file_too_large")
		return
	}
	if !media.IsAllowedAdVideoContentType(header.Header.Get("Content-Type"), header.Filename) {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_upload_file_type")
		return
	}
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".mp4"
	}
	tmp, err := os.CreateTemp("", "dama-pool-video-*"+ext)
	if err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusInternalServerError, "err_upload_failed")
		return
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
		writeMediaPoolErr(w, a.Settings, http.StatusInternalServerError, "err_upload_failed")
		return
	}
	_ = tmp.Close()
	localPath := tmp.Name()

	if async && a.Worker != nil {
		jobID := uuid.NewString()
		err := a.Worker.Enqueue(r.Context(), youtube.UploadJob{
			JobID:       jobID,
			Title:       title,
			Description: description,
			LocalPath:   localPath,
		})
		if err != nil {
			_ = os.Remove(localPath)
			writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_upload_queue_failed")
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{"status": "queued", "job_id": jobID})
		return
	}
	result, err := a.Pool.UploadVideo(r.Context(), title, description, localPath)
	_ = os.Remove(localPath)
	if err != nil {
		writeMediaPoolErr(w, a.Settings, http.StatusBadRequest, "err_upload_failed")
		return
	}
	writeJSON(w, http.StatusCreated, result)
}
