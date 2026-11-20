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

func (a *AdsAPI) viewportAspectTolerance() (float64, bool) {
	if a.Settings == nil {
		return 0, false
	}
	raw := strings.TrimSpace(a.Settings.AdRuntimeChromeString("viewport_aspect_tolerance"))
	if raw == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil || v <= 0 || v > 1 {
		return 0, false
	}
	return v, true
}

func (a *AdsAPI) viewportMaxVideoBytes() (int64, bool) {
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

func campaignPublicCreativeFields(c store.AdCampaign) map[string]any {
	videoID := c.YouTubeVideoID
	if strings.HasPrefix(videoID, "stub_") {
		videoID = ""
	}
	deskVid := c.YouTubeVideoIDDesktop
	tabVid := c.YouTubeVideoIDTablet
	mobVid := c.YouTubeVideoIDMobile
	if strings.HasPrefix(deskVid, "stub_") {
		deskVid = ""
	}
	if strings.HasPrefix(tabVid, "stub_") {
		tabVid = ""
	}
	if strings.HasPrefix(mobVid, "stub_") {
		mobVid = ""
	}
	gallery := c.Gallery
	if gallery == nil {
		gallery = []string{}
	}
	row := map[string]any{
		"id":                   c.ID,
		"title":                c.Title,
		"creative_type":        c.CreativeType,
		"creative_url":         c.CreativeURL,
		"creative_desktop_url": c.CreativeDesktopURL,
		"creative_tablet_url":  c.CreativeTabletURL,
		"creative_mobile_url":  c.CreativeMobileURL,
		"thumbnail_url":        c.ThumbnailURL,
		"gallery":              gallery,
		"video_id_desktop":     deskVid,
		"video_id_tablet":      tabVid,
		"video_id_mobile":      mobVid,
	}
	if videoID != "" {
		row["video_id"] = videoID
	}
	return row
}

func viewportChromeKeys(settings *store.SettingsStore) map[string]any {
	if settings == nil {
		return map[string]any{}
	}
	keys := []string{
		"viewport_creatives_title", "viewport_creatives_blurb",
		"viewport_desktop_label", "viewport_tablet_label", "viewport_mobile_label",
		"viewport_desktop_ratio_label", "viewport_tablet_ratio_label", "viewport_mobile_ratio_label",
		"viewport_desktop_hint", "viewport_tablet_hint", "viewport_mobile_hint",
		"viewport_upload_image_action", "viewport_upload_video_action",
		"viewport_replace_image_action", "viewport_clear_action",
		"viewport_preview_empty", "viewport_optional_badge",
		"viewport_video_badge", "viewport_image_badge",
		"viewport_ratio_mismatch", "viewport_slot_invalid",
		"viewport_breakpoint_mobile_max", "viewport_breakpoint_tablet_max",
		"err_viewport_slot_required", "err_viewport_ratio_mismatch",
		"err_viewport_video_required", "err_viewport_video_type", "err_viewport_video_too_large",
		"toast_viewport_creative_saved", "toast_viewport_creative_cleared", "toast_viewport_video_queued",
		"err_campaign_auto_closed", "clear_legacy_video_action", "toast_legacy_video_cleared",
		"viewport_aspect_tolerance", "viewport_max_video_bytes",
	}
	out := make(map[string]any, len(keys))
	for _, k := range keys {
		out[k] = settings.AdRuntimeChromeString(k)
	}
	return out
}

func (a *AdsAPI) publisherCampaignMutable(w http.ResponseWriter, r *http.Request, id, userID string) (*store.AdCampaign, bool) {
	c, err := a.Ads.Get(r.Context(), id)
	if err != nil || c == nil || c.PublisherID != userID {
		writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
		return nil, false
	}
	if c.AutoClosed {
		writeAdsErr(w, a.Settings, http.StatusConflict, "err_campaign_auto_closed")
		return nil, false
	}
	return c, true
}

func (a *AdsAPI) writeAdsCampaignMediaStoreErr(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrCampaignAutoClosed) {
		writeAdsErr(w, a.Settings, http.StatusConflict, "err_campaign_auto_closed")
		return
	}
	writeAdsErr(w, a.Settings, http.StatusNotFound, "err_campaign_not_found")
}

// UploadViewportCreative stores an image for desktop|tablet|mobile with aspect check.
func (a *AdsAPI) UploadViewportCreative(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	slot := store.NormalizeViewportSlot(chi.URLParam(r, "slot"))
	if !store.IsValidViewportSlot(slot) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeAdsErr(w, a.Settings, http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
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
	c, err := a.Ads.SetViewportImage(r.Context(), id, userID, slot, url, creativeType)
	if err != nil {
		a.writeAdsCampaignMediaStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// ClearViewportCreative clears image for one viewport slot.
func (a *AdsAPI) ClearViewportCreative(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	slot := store.NormalizeViewportSlot(chi.URLParam(r, "slot"))
	if !store.IsValidViewportSlot(slot) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
		return
	}
	c, err := a.Ads.ClearViewportImage(r.Context(), id, userID, slot)
	if err != nil {
		a.writeAdsCampaignMediaStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// ClearViewportVideo clears youtube id for one viewport slot.
func (a *AdsAPI) ClearViewportVideo(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	slot := store.NormalizeViewportSlot(chi.URLParam(r, "slot"))
	if !store.IsValidViewportSlot(slot) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
		return
	}
	c, err := a.Ads.ClearViewportVideo(r.Context(), id, userID, slot)
	if err != nil {
		a.writeAdsCampaignMediaStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

type attachViewportVideoJSONBody struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Async       bool   `json:"async"`
	Slot        string `json:"slot"`
}

// AttachViewportVideoUpload accepts multipart video (preferred) or JSON queue job for a slot.
func (a *AdsAPI) AttachViewportVideoUpload(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	id := chi.URLParam(r, "id")
	slot := store.NormalizeViewportSlot(chi.URLParam(r, "slot"))
	if !store.IsValidViewportSlot(slot) {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
		return
	}
	if a.Settings == nil || a.Settings.ClientEnums().Source != "database" {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_campaign_defaults_unavailable")
		return
	}
	if _, ok := a.publisherCampaignMutable(w, r, id, userID); !ok {
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
		if body.Slot != "" {
			slot = store.NormalizeViewportSlot(body.Slot)
			if !store.IsValidViewportSlot(slot) {
				writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_viewport_slot_required")
				return
			}
		}
	}
	if title == "" {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_title_required")
		return
	}

	if async && a.Worker != nil {
		jobID := uuid.NewString()
		err := a.Worker.Enqueue(r.Context(), youtube.UploadJob{
			JobID:        jobID,
			CampaignID:   id,
			PublisherID:  userID,
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
			"campaign_id": id,
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
	c, err := a.Ads.AttachYouTubeViewport(r.Context(), id, userID, slot, result.VideoID, videoCreative)
	if err != nil {
		a.writeAdsCampaignMediaStoreErr(w, err)
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

func (a *AdsAPI) uploadCampaignImageWithBytes(w http.ResponseWriter, r *http.Request) (userID, url string, data []byte, ok bool) {
	userID = auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeAdsErr(w, a.Settings, http.StatusUnauthorized, "err_unauthorized")
		return "", "", nil, false
	}
	if a.Avatars == nil {
		writeAdsErr(w, a.Settings, http.StatusServiceUnavailable, "err_media_unavailable")
		return "", "", nil, false
	}
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_invalid_multipart")
		return "", "", nil, false
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_file_required")
		return "", "", nil, false
	}
	defer file.Close()
	data, err = io.ReadAll(file)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_read_failed")
		return "", "", nil, false
	}
	url, err = a.Avatars.UploadAdCreativeImage(userID, header.Filename, header.Header.Get("Content-Type"), data)
	if err != nil {
		writeAdsErr(w, a.Settings, http.StatusBadRequest, "err_media_upload_failed")
		return "", "", nil, false
	}
	return userID, url, data, true
}
