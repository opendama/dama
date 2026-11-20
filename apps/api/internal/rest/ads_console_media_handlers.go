package rest

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/media"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/youtube"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// consoleCampaignOwner loads a campaign for admin media ops (any publisher).
func (a *AdsAPI) consoleCampaignOwner(w http.ResponseWriter, r *http.Request) (*store.AdCampaign, bool) {
	if a.Settings == nil || a.Settings.AdRuntimeChrome().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_runtime_chrome_unavailable")
		return nil, false
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return nil, false
	}
	c, err := a.Ads.Get(r.Context(), id)
	if err != nil || c == nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return nil, false
	}
	if c.AutoClosed {
		writeAdsErr(w, a.Settings, http.StatusConflict, "err_campaign_auto_closed")
		return nil, false
	}
	return c, true
}

func (a *AdsAPI) ConsoleUploadThumbnail(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	_, url, ok := a.uploadCampaignImage(w, r)
	if !ok {
		return
	}
	c, err := a.Ads.UpdateThumbnail(r.Context(), owner.ID, owner.PublisherID, url)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ConsoleClearThumbnail(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	c, err := a.Ads.ClearThumbnail(r.Context(), owner.ID, owner.PublisherID)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ConsoleUploadGalleryImage(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	_, url, ok := a.uploadCampaignImage(w, r)
	if !ok {
		return
	}
	c, err := a.Ads.AppendGalleryImage(r.Context(), owner.ID, owner.PublisherID, url)
	if err != nil {
		if errors.Is(err, store.ErrGalleryFull) {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "gallery_limit_reached")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ConsoleRemoveGalleryImage(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	idxRaw := strings.TrimSpace(chi.URLParam(r, "index"))
	index, err := strconv.Atoi(idxRaw)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
		return
	}
	c, err := a.Ads.RemoveGalleryAt(r.Context(), owner.ID, owner.PublisherID, index)
	if err != nil {
		if errors.Is(err, store.ErrGalleryIndex) {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
			return
		}
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ConsoleUploadViewportCreative(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	slot := store.NormalizeViewportSlot(chi.URLParam(r, "slot"))
	if !store.IsValidViewportSlot(slot) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
		return
	}
	_, url, data, ok := a.uploadCampaignImageWithBytes(w, r)
	if !ok {
		return
	}
	tol, tolOK := a.viewportAspectTolerance()
	if !tolOK {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_runtime_chrome_unavailable")
		return
	}
	ratioKey := store.ViewportRatioChromeKey(slot)
	ratioLabel := ""
	if a.Settings != nil && ratioKey != "" {
		ratioLabel = strings.TrimSpace(a.Settings.AdRuntimeChromeString(ratioKey))
	}
	if ratioLabel == "" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_runtime_chrome_unavailable")
		return
	}
	if err := media.ValidateViewportImageAspect(data, slot, ratioLabel, tol); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_ratio_mismatch")
		return
	}
	creativeType := "image"
	if a.Settings != nil && a.Settings.ClientEnums().Source == "database" {
		creativeType = a.Settings.ClientEnums().DefaultCreativeType
	}
	c, err := a.Ads.SetViewportImage(r.Context(), owner.ID, owner.PublisherID, slot, url, creativeType)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ConsoleClearViewportCreative(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	slot := store.NormalizeViewportSlot(chi.URLParam(r, "slot"))
	if !store.IsValidViewportSlot(slot) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
		return
	}
	c, err := a.Ads.ClearViewportImage(r.Context(), owner.ID, owner.PublisherID, slot)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ConsoleClearViewportVideo(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	slot := store.NormalizeViewportSlot(chi.URLParam(r, "slot"))
	if !store.IsValidViewportSlot(slot) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
		return
	}
	c, err := a.Ads.ClearViewportVideo(r.Context(), owner.ID, owner.PublisherID, slot)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ConsoleAttachViewportVideo(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	slot := store.NormalizeViewportSlot(chi.URLParam(r, "slot"))
	if !store.IsValidViewportSlot(slot) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
		return
	}
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_campaign_defaults_unavailable")
		return
	}
	videoCreative := a.Settings.ClientEnums().VideoCreativeType
	if !a.Settings.IsAllowedCreativeType(videoCreative) {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_video_creative_unavailable")
		return
	}

	ct := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	title := ""
	description := ""
	async := true
	localPath := ""

	maxBytes, maxOK := a.viewportMaxVideoBytes()
	if !maxOK {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_runtime_chrome_unavailable")
		return
	}
	if strings.HasPrefix(ct, "multipart/") {
		if err := r.ParseMultipartForm(maxBytes); err != nil {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_multipart")
			return
		}
		title = strings.TrimSpace(r.FormValue("title"))
		description = strings.TrimSpace(r.FormValue("description"))
		if v := strings.TrimSpace(r.FormValue("async")); v == "false" || v == "0" {
			async = false
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_video_required")
			return
		}
		defer file.Close()
		data, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
		if err != nil {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_read_failed")
			return
		}
		if int64(len(data)) > maxBytes {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_video_too_large")
			return
		}
		if !media.IsAllowedAdVideoContentType(header.Header.Get("Content-Type"), header.Filename) {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_video_type")
			return
		}
		ext := filepath.Ext(header.Filename)
		if ext == "" {
			ext = ".mp4"
		}
		tmp, err := os.CreateTemp("", "dama-ad-video-*"+ext)
		if err != nil {
			writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_video_upload_failed")
			return
		}
		if _, err := tmp.Write(data); err != nil {
			_ = tmp.Close()
			_ = os.Remove(tmp.Name())
			writeAdsErr(w, a.Settings, http.StatusInternalServerError, "err_video_upload_failed")
			return
		}
		_ = tmp.Close()
		localPath = tmp.Name()
	} else {
		var body attachViewportVideoJSONBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_body")
			return
		}
		title = strings.TrimSpace(body.Title)
		description = strings.TrimSpace(body.Description)
		async = body.Async
	}
	if title == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_title_required")
		return
	}

	if async && a.Worker != nil {
		jobID := uuid.NewString()
		err := a.Worker.Enqueue(r.Context(), youtube.UploadJob{
			JobID:        jobID,
			CampaignID:   owner.ID,
			PublisherID:  owner.PublisherID,
			Title:        title,
			Description:  description,
			LocalPath:    localPath,
			ViewportSlot: slot,
		})
		if err != nil {
			if localPath != "" {
				_ = os.Remove(localPath)
			}
			writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_video_queue_failed")
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]any{
			"status":      "queued",
			"job_id":      jobID,
			"campaign_id": owner.ID,
			"slot":        slot,
		})
		return
	}
	if a.YT == nil {
		if localPath != "" {
			_ = os.Remove(localPath)
		}
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_video_upload_failed")
		return
	}
	result, err := a.YT.UploadVideo(r.Context(), title, description, localPath)
	if localPath != "" {
		_ = os.Remove(localPath)
	}
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_video_upload_failed")
		return
	}
	c, err := a.Ads.AttachYouTubeViewport(r.Context(), owner.ID, owner.PublisherID, slot, result.VideoID, videoCreative)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"campaign": c,
		"upload": map[string]any{
			"video_id": result.VideoID,
			"slot":     slot,
		},
	})
}

func (a *AdsAPI) ConsoleClearLegacyVideo(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.consoleCampaignOwner(w, r)
	if !ok {
		return
	}
	c, err := a.Ads.ClearYouTube(r.Context(), owner.ID, owner.PublisherID)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *AdsAPI) ClearLegacyVideo(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	cur, err := a.Ads.Get(r.Context(), id)
	if err != nil || cur == nil || cur.PublisherID != userID {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	if cur.AutoClosed {
		writeAdsErr(w, a.Settings, http.StatusConflict, "err_campaign_auto_closed")
		return
	}
	c, err := a.Ads.ClearYouTube(r.Context(), id, userID)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return
	}
	writeJSON(w, http.StatusOK, c)
}
