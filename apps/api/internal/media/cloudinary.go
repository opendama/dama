package media

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/config"
	"dama/apps/api/internal/store"
)

type AvatarResult struct {
	PublicID          string `json:"-"` // CDN object key - never client-facing
	AvatarThumbURL    string `json:"avatar_thumb_url"`
	AvatarFullURL     string `json:"avatar_full_url"`
	Provider          string `json:"-"`
	ModerationStatus  string `json:"moderation_status,omitempty"`
	ModerationPending bool   `json:"moderation_pending,omitempty"`
}

type AvatarService struct {
	cfg config.Config
}

func NewAvatarService(cfg config.Config) *AvatarService {
	return &AvatarService{cfg: cfg}
}

func (s *AvatarService) ReadyCloudinary() bool {
	return s.cfg.CloudinaryCloudName != "" && s.cfg.CloudinaryAPIKey != "" && s.cfg.CloudinaryAPISecret != ""
}

// MediaPublicHost returns the hostname of DAMA_MEDIA_PUBLIC_BASE (custom CDN), or empty.
func (s *AvatarService) MediaPublicHost() string {
	if s == nil {
		return ""
	}
	base := strings.TrimSpace(s.cfg.MediaPublicBase)
	if base == "" {
		return ""
	}
	u, err := url.Parse(base)
	if err != nil || u == nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

// ProcessAvatar uploads and returns thumb (128) + full (1024) URLs.
// mod must come from platform_settings.avatar_moderation (fail closed when unavailable).
func (s *AvatarService) ProcessAvatar(userID string, filename string, contentType string, data []byte, mod store.ModerationConfig) (*AvatarResult, error) {
	if err := validateImage(contentType, data); err != nil {
		return nil, err
	}
	if mod.Source != "database" || mod.Provider == "" {
		return nil, fmt.Errorf("avatar moderation config unavailable")
	}
	if s.ReadyCloudinary() {
		if !mod.Enabled || mod.Provider == "admin_only" {
			res, err := s.uploadCloudinaryNoModeration(userID, filename, data)
			if err != nil {
				return nil, err
			}
			res.ModerationStatus = "pending_review"
			res.ModerationPending = true
			return res, nil
		}
		return s.uploadCloudinary(userID, filename, data)
	}
	if !s.cfg.AllowLocalMedia {
		return nil, fmt.Errorf("media upload unavailable")
	}
	res, err := s.saveLocal(userID, filename, data)
	if err != nil {
		return nil, err
	}
	if !mod.Enabled || mod.Provider == "admin_only" {
		res.ModerationStatus = "pending_review"
		res.ModerationPending = true
	}
	return res, nil
}

// UploadReceiptImage stores a payment receipt image and returns a public URL.
func (s *AvatarService) UploadReceiptImage(userID, filename, contentType string, data []byte) (string, error) {
	if err := validateImage(contentType, data); err != nil {
		return "", err
	}
	if s.ReadyCloudinary() {
		res, err := s.uploadCloudinaryFolder(userID, filename, data, "dama/receipts")
		if err != nil {
			return "", err
		}
		return res.AvatarFullURL, nil
	}
	if !s.cfg.AllowLocalMedia {
		return "", fmt.Errorf("media upload unavailable")
	}
	res, err := s.saveLocal(userID, filename, data)
	if err != nil {
		return "", err
	}
	return res.AvatarFullURL, nil
}

// UploadAdCreativeImage stores an ad thumbnail/gallery image and returns a public URL.
func (s *AvatarService) UploadAdCreativeImage(userID, filename, contentType string, data []byte) (string, error) {
	if err := validateImage(contentType, data); err != nil {
		return "", err
	}
	if s.ReadyCloudinary() {
		res, err := s.uploadCloudinaryFolder(userID, filename, data, "dama/ads")
		if err != nil {
			return "", err
		}
		return res.AvatarFullURL, nil
	}
	if !s.cfg.AllowLocalMedia {
		return "", fmt.Errorf("media upload unavailable")
	}
	res, err := s.saveLocal(userID, filename, data)
	if err != nil {
		return "", err
	}
	return res.AvatarFullURL, nil
}

// UploadKycImage stores a government-ID / selfie KYC image and returns a public URL.
func (s *AvatarService) UploadKycImage(userID, filename, contentType string, data []byte) (string, error) {
	if err := validateImage(contentType, data); err != nil {
		return "", err
	}
	if s.ReadyCloudinary() {
		res, err := s.uploadCloudinaryFolder(userID, filename, data, "dama/kyc")
		if err != nil {
			return "", err
		}
		return res.AvatarFullURL, nil
	}
	if !s.cfg.AllowLocalMedia {
		return "", fmt.Errorf("media upload unavailable")
	}
	res, err := s.saveLocalFolder(userID, filename, data, "kyc")
	if err != nil {
		return "", err
	}
	return res.AvatarFullURL, nil
}

// IsAllowedChatImageURL accepts only URLs produced by UploadChatImage
// (CDN MediaPublicBase + dama/chat, or local /api/v1/media/chat/...).
func (s *AvatarService) IsAllowedChatImageURL(raw string) bool {
	u := strings.TrimSpace(raw)
	if u == "" || s == nil {
		return false
	}
	lower := strings.ToLower(u)
	if strings.HasPrefix(lower, "javascript:") || strings.HasPrefix(lower, "data:") {
		return false
	}
	// Relative local media path from saveLocalFolder.
	if strings.HasPrefix(u, "/api/v1/media/chat/") {
		return true
	}
	// Absolute local media: must be under PublicAPIBase + /api/v1/media/chat/.
	if strings.Contains(lower, "/api/v1/media/chat/") {
		if pub := strings.TrimRight(strings.TrimSpace(s.cfg.PublicAPIBase), "/"); pub != "" {
			return strings.HasPrefix(u, pub+"/api/v1/media/chat/")
		}
	}
	base := strings.TrimRight(strings.TrimSpace(s.cfg.MediaPublicBase), "/")
	if base == "" {
		return false
	}
	if !strings.HasPrefix(u, base+"/") && u != base {
		return false
	}
	return strings.Contains(u, "dama/chat")
}

// UploadChatImage stores a game-chat / DM image (image types only) and returns a public URL.
func (s *AvatarService) UploadChatImage(userID, filename, contentType string, data []byte) (string, error) {
	if err := validateImage(contentType, data); err != nil {
		return "", err
	}
	if s.ReadyCloudinary() {
		res, err := s.uploadCloudinaryFolder(userID, filename, data, "dama/chat")
		if err != nil {
			return "", err
		}
		return res.AvatarFullURL, nil
	}
	if !s.cfg.AllowLocalMedia {
		return "", fmt.Errorf("media upload unavailable")
	}
	res, err := s.saveLocalFolder(userID, filename, data, "chat")
	if err != nil {
		return "", err
	}
	return res.AvatarFullURL, nil
}

// UploadTournamentPrizeImage stores a tournament prize/gallery image and returns a public URL.
func (s *AvatarService) UploadTournamentPrizeImage(userID, filename, contentType string, data []byte) (string, error) {
	if err := validateImage(contentType, data); err != nil {
		return "", err
	}
	if s.ReadyCloudinary() {
		res, err := s.uploadCloudinaryFolder(userID, filename, data, "dama/tournaments")
		if err != nil {
			return "", err
		}
		return res.AvatarFullURL, nil
	}
	if !s.cfg.AllowLocalMedia {
		return "", fmt.Errorf("media upload unavailable")
	}
	res, err := s.saveLocal(userID, filename, data)
	if err != nil {
		return "", err
	}
	return res.AvatarFullURL, nil
}

func validateImage(contentType string, data []byte) error {
	if len(data) == 0 {
		return fmt.Errorf("empty file")
	}
	if len(data) > 8*1024*1024 {
		return fmt.Errorf("file too large (max 8MB)")
	}
	ct := strings.ToLower(strings.TrimSpace(contentType))
	if ct != "" && !strings.HasPrefix(ct, "image/") {
		return fmt.Errorf("only image uploads allowed")
	}
	if !sniffImageBytes(data) {
		return fmt.Errorf("file is not a recognized image")
	}
	return nil
}

// sniffImageBytes checks magic bytes for JPEG/PNG/GIF/WEBP (fail closed).
func sniffImageBytes(data []byte) bool {
	if len(data) < 3 {
		return false
	}
	if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return true // JPEG
	}
	if len(data) >= 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return true // PNG
	}
	if len(data) >= 6 {
		sig := string(data[0:6])
		if sig == "GIF87a" || sig == "GIF89a" {
			return true
		}
	}
	if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return true
	}
	return false
}

func (s *AvatarService) uploadCloudinary(userID, filename string, data []byte) (*AvatarResult, error) {
	publicID := fmt.Sprintf("dama/avatars/%s/%d", userID, time.Now().UnixNano())
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	// Include moderation in signature (Cloudinary AI / AWS Rekognition when enabled on the account).
	moderation := "aws_rek"
	toSign := fmt.Sprintf("moderation=%s&public_id=%s&timestamp=%s%s", moderation, publicID, timestamp, s.cfg.CloudinaryAPISecret)
	sum := sha1.Sum([]byte(toSign))
	signature := hex.EncodeToString(sum[:])

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	_ = w.WriteField("api_key", s.cfg.CloudinaryAPIKey)
	_ = w.WriteField("timestamp", timestamp)
	_ = w.WriteField("public_id", publicID)
	_ = w.WriteField("moderation", moderation)
	_ = w.WriteField("signature", signature)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(data); err != nil {
		return nil, err
	}
	_ = w.Close()

	url := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", s.cfg.CloudinaryCloudName)
	req, err := http.NewRequest(http.MethodPost, url, &body)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		// If account lacks moderation add-on, retry without moderation and leave pending for admin review.
		msg := strings.ToLower(string(raw))
		if strings.Contains(msg, "moderation") || strings.Contains(msg, "rekognition") || strings.Contains(msg, "subscription") {
			res, err := s.uploadCloudinaryNoModeration(userID, filename, data)
			if err != nil {
				return nil, err
			}
			res.ModerationStatus = "pending_review"
			res.ModerationPending = true
			return res, nil
		}
		return nil, fmt.Errorf("media upload unavailable")
	}
	var parsed struct {
		PublicID   string `json:"public_id"`
		SecureURL  string `json:"secure_url"`
		Moderation []struct {
			Status string `json:"status"`
			Kind   string `json:"kind"`
		} `json:"moderation"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	thumb, err := s.deliveryURL("c_fill,w_128,h_128,f_auto,q_auto", parsed.PublicID)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	full, err := s.deliveryURL("c_fill,w_1024,h_1024,f_auto,q_auto", parsed.PublicID)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	// Moderation was requested: empty response means still pending, never invent approved.
	modStatus := "pending"
	pending := true
	if len(parsed.Moderation) > 0 {
		modStatus = parsed.Moderation[0].Status
		pending = modStatus == "pending" || modStatus == ""
		if modStatus == "" {
			modStatus = "pending"
		}
	}
	return &AvatarResult{
		PublicID:          parsed.PublicID,
		AvatarThumbURL:    thumb,
		AvatarFullURL:     full,
		Provider:          "cdn",
		ModerationStatus:  modStatus,
		ModerationPending: pending,
	}, nil
}

func (s *AvatarService) uploadCloudinaryFolder(userID, filename string, data []byte, folder string) (*AvatarResult, error) {
	publicID := fmt.Sprintf("%s/%s/%d", strings.Trim(folder, "/"), userID, time.Now().Unix())
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	toSign := fmt.Sprintf("public_id=%s&timestamp=%s%s", publicID, timestamp, s.cfg.CloudinaryAPISecret)
	sum := sha1.Sum([]byte(toSign))
	signature := hex.EncodeToString(sum[:])

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	_ = w.WriteField("api_key", s.cfg.CloudinaryAPIKey)
	_ = w.WriteField("timestamp", timestamp)
	_ = w.WriteField("public_id", publicID)
	_ = w.WriteField("signature", signature)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(data); err != nil {
		return nil, err
	}
	_ = w.Close()

	url := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", s.cfg.CloudinaryCloudName)
	req, err := http.NewRequest(http.MethodPost, url, &body)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("media upload unavailable")
	}
	var parsed struct {
		PublicID string `json:"public_id"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	full, err := s.deliveryURL("f_auto,q_auto", parsed.PublicID)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	return &AvatarResult{
		PublicID:       parsed.PublicID,
		AvatarThumbURL: full,
		AvatarFullURL:  full,
		Provider:       "cdn",
	}, nil
}

func (s *AvatarService) uploadCloudinaryNoModeration(userID, filename string, data []byte) (*AvatarResult, error) {
	publicID := fmt.Sprintf("dama/avatars/%s/%d", userID, time.Now().UnixNano())
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	toSign := fmt.Sprintf("public_id=%s&timestamp=%s%s", publicID, timestamp, s.cfg.CloudinaryAPISecret)
	sum := sha1.Sum([]byte(toSign))
	signature := hex.EncodeToString(sum[:])

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	_ = w.WriteField("api_key", s.cfg.CloudinaryAPIKey)
	_ = w.WriteField("timestamp", timestamp)
	_ = w.WriteField("public_id", publicID)
	_ = w.WriteField("signature", signature)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(data); err != nil {
		return nil, err
	}
	_ = w.Close()

	url := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", s.cfg.CloudinaryCloudName)
	req, err := http.NewRequest(http.MethodPost, url, &body)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("media upload unavailable")
	}
	var parsed struct {
		PublicID  string `json:"public_id"`
		SecureURL string `json:"secure_url"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	thumb, err := s.deliveryURL("c_fill,w_128,h_128,f_auto,q_auto", parsed.PublicID)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	full, err := s.deliveryURL("c_fill,w_1024,h_1024,f_auto,q_auto", parsed.PublicID)
	if err != nil {
		return nil, fmt.Errorf("media upload unavailable")
	}
	return &AvatarResult{
		PublicID:         parsed.PublicID,
		AvatarThumbURL:   thumb,
		AvatarFullURL:    full,
		Provider:         "cdn",
		ModerationStatus: "pending_review",
	}, nil
}

// deliveryURL builds client-facing media URLs from DAMA_MEDIA_PUBLIC_BASE (custom CDN/CNAME).
// Never falls back to an upstream vendor hostname.
func (s *AvatarService) deliveryURL(transform, publicID string) (string, error) {
	base := strings.TrimRight(s.cfg.MediaPublicBase, "/")
	if base == "" {
		return "", fmt.Errorf("media public base required")
	}
	transform = strings.Trim(transform, "/")
	publicID = strings.TrimLeft(publicID, "/")
	if transform == "" {
		return fmt.Sprintf("%s/image/upload/%s", base, publicID), nil
	}
	return fmt.Sprintf("%s/image/upload/%s/%s", base, transform, publicID), nil
}

func (s *AvatarService) saveLocal(userID, filename string, data []byte) (*AvatarResult, error) {
	return s.saveLocalFolder(userID, filename, data, "avatars")
}

func (s *AvatarService) saveLocalFolder(userID, filename string, data []byte, folder string) (*AvatarResult, error) {
	folder = strings.Trim(folder, "/\\")
	if folder == "" {
		folder = "avatars"
	}
	dir := filepath.Join(s.cfg.UploadDir, folder, userID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".png"
	}
	ts := time.Now().UnixNano()
	thumbName := fmt.Sprintf("%d_thumb%s", ts, ext)
	fullName := fmt.Sprintf("%d_full%s", ts, ext)
	if err := os.WriteFile(filepath.Join(dir, thumbName), data, 0o644); err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(dir, fullName), data, 0o644); err != nil {
		return nil, err
	}
	// Local smoke stores distinct paths; CDN path applies resize transforms in production.
	thumbRel := filepath.ToSlash(filepath.Join(folder, userID, thumbName))
	fullRel := filepath.ToSlash(filepath.Join(folder, userID, fullName))
	thumbPath := "/api/v1/media/" + thumbRel
	fullPath := "/api/v1/media/" + fullRel
	// Absolute URLs so web (separate origin) can preview/send without inventing hosts.
	if pub := strings.TrimRight(strings.TrimSpace(s.cfg.PublicAPIBase), "/"); pub != "" {
		thumbPath = pub + thumbPath
		fullPath = pub + fullPath
	}
	return &AvatarResult{
		PublicID:         fullRel,
		AvatarThumbURL:   thumbPath,
		AvatarFullURL:    fullPath,
		Provider:         "local",
		ModerationStatus: "pending_review",
	}, nil
}
