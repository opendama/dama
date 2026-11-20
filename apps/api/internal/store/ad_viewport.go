package store

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Viewport creative slots (IAB-style aspect ratios for in-match / lobby).
const (
	ViewportDesktop = "desktop" // 16:9
	ViewportTablet  = "tablet"  // 4:3
	ViewportMobile  = "mobile"  // 9:16
)

// ViewportAspect is width:height for a slot.
type ViewportAspect struct {
	W int
	H int
}

// ParseAspectRatioLabel parses DB chrome labels like "16:9" or "4 / 3" into W:H.
func ParseAspectRatioLabel(label string) (ViewportAspect, bool) {
	s := strings.TrimSpace(label)
	s = strings.ReplaceAll(s, " ", "")
	parts := strings.Split(s, ":")
	if len(parts) != 2 {
		parts = strings.Split(s, "/")
	}
	if len(parts) != 2 {
		return ViewportAspect{}, false
	}
	var w, h int
	if _, err := fmt.Sscanf(parts[0], "%d", &w); err != nil || w < 1 {
		return ViewportAspect{}, false
	}
	if _, err := fmt.Sscanf(parts[1], "%d", &h); err != nil || h < 1 {
		return ViewportAspect{}, false
	}
	return ViewportAspect{W: w, H: h}, true
}

// ViewportAspectForLabel prefers a DB chrome ratio label; fails closed if invalid.
func ViewportAspectForLabel(slot, ratioLabel string) (ViewportAspect, bool) {
	if !IsValidViewportSlot(slot) {
		return ViewportAspect{}, false
	}
	return ParseAspectRatioLabel(ratioLabel)
}

// NormalizeViewportSlot lowercases and trims a slot key.
func NormalizeViewportSlot(slot string) string {
	return strings.ToLower(strings.TrimSpace(slot))
}

// IsValidViewportSlot reports whether slot is desktop|tablet|mobile.
func IsValidViewportSlot(slot string) bool {
	switch NormalizeViewportSlot(slot) {
	case ViewportDesktop, ViewportTablet, ViewportMobile:
		return true
	default:
		return false
	}
}

// ViewportRatioChromeKey returns the ad_runtime_chrome key for a slot ratio label.
func ViewportRatioChromeKey(slot string) string {
	switch NormalizeViewportSlot(slot) {
	case ViewportDesktop:
		return "viewport_desktop_ratio_label"
	case ViewportTablet:
		return "viewport_tablet_ratio_label"
	case ViewportMobile:
		return "viewport_mobile_ratio_label"
	default:
		return ""
	}
}

// AspectMatches reports whether w/h is within tolerance of target (e.g. 0.08 = 8%).
func AspectMatches(width, height, targetW, targetH int, tolerance float64) bool {
	if width <= 0 || height <= 0 || targetW <= 0 || targetH <= 0 {
		return false
	}
	got := float64(width) / float64(height)
	want := float64(targetW) / float64(targetH)
	diff := got - want
	if diff < 0 {
		diff = -diff
	}
	return diff <= want*tolerance
}

// ResolveViewportCreative picks image URL + video id for a requested viewport.
// Exact slot only (desktop/tablet/mobile never cross). Legacy creative_url /
// youtube_video_id only when no viewport slot is filled.
func ResolveViewportCreative(c *AdCampaign, slot string) (imageURL, videoID, usedSlot string) {
	if c == nil {
		return "", "", ""
	}
	slot = NormalizeViewportSlot(slot)
	if !IsValidViewportSlot(slot) {
		return "", "", ""
	}
	if img, vid := c.viewportPair(slot); img != "" || vid != "" {
		return img, vid, slot
	}
	if c.hasAnyViewportCreative() {
		return "", "", ""
	}
	legacyImg := strings.TrimSpace(c.CreativeURL)
	legacyVid := strings.TrimSpace(c.YouTubeVideoID)
	if legacyImg != "" || legacyVid != "" {
		return legacyImg, legacyVid, "legacy"
	}
	return "", "", ""
}

func (c *AdCampaign) hasAnyViewportCreative() bool {
	for _, s := range []string{ViewportDesktop, ViewportTablet, ViewportMobile} {
		img, vid := c.viewportPair(s)
		if img != "" || vid != "" {
			return true
		}
	}
	return false
}

func (c *AdCampaign) viewportPair(slot string) (imageURL, videoID string) {
	switch NormalizeViewportSlot(slot) {
	case ViewportDesktop:
		return strings.TrimSpace(c.CreativeDesktopURL), strings.TrimSpace(c.YouTubeVideoIDDesktop)
	case ViewportTablet:
		return strings.TrimSpace(c.CreativeTabletURL), strings.TrimSpace(c.YouTubeVideoIDTablet)
	case ViewportMobile:
		return strings.TrimSpace(c.CreativeMobileURL), strings.TrimSpace(c.YouTubeVideoIDMobile)
	default:
		return "", ""
	}
}

// SetViewportImage sets one slot image URL and mirrors into legacy creative_url when empty or same slot preferred.
func (s *AdStore) SetViewportImage(ctx context.Context, id, publisherID, slot, imageURL, creativeType string) (*AdCampaign, error) {
	slot = NormalizeViewportSlot(slot)
	if !IsValidViewportSlot(slot) {
		return nil, fmt.Errorf("invalid viewport slot")
	}
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return nil, fmt.Errorf("creative_url required")
	}
	if strings.TrimSpace(creativeType) == "" {
		return nil, fmt.Errorf("creative_type required")
	}
	col := viewportImageColumn(slot)
	if col == "" {
		return nil, fmt.Errorf("invalid viewport slot")
	}
	if s.db != nil && s.db.Ready() {
		q := fmt.Sprintf(`
			UPDATE ad_campaigns
			SET %s=$2,
			    creative_type=$3,
			    creative_url = CASE
			      WHEN TRIM(COALESCE(creative_url,'')) = '' THEN $2
			      ELSE creative_url
			    END,
			    updated_at=NOW()
			WHERE id=$1 AND publisher_id=$4 AND COALESCE(auto_closed, false) = false
		`, col)
		tag, err := s.db.Pool.Exec(ctx, q, id, imageURL, creativeType, publisherID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, s.errCampaignMediaUpdateMiss(ctx, id, publisherID)
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.mem[id]
	if !ok || c.PublisherID != publisherID {
		return nil, ErrNotFound
	}
	if c.AutoClosed {
		return nil, ErrCampaignAutoClosed
	}
	switch slot {
	case ViewportDesktop:
		c.CreativeDesktopURL = imageURL
	case ViewportTablet:
		c.CreativeTabletURL = imageURL
	case ViewportMobile:
		c.CreativeMobileURL = imageURL
	}
	c.CreativeType = creativeType
	if strings.TrimSpace(c.CreativeURL) == "" {
		c.CreativeURL = imageURL
	}
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

// ClearViewportImage clears one slot image URL.
func (s *AdStore) ClearViewportImage(ctx context.Context, id, publisherID, slot string) (*AdCampaign, error) {
	slot = NormalizeViewportSlot(slot)
	col := viewportImageColumn(slot)
	if col == "" {
		return nil, fmt.Errorf("invalid viewport slot")
	}
	if s.db != nil && s.db.Ready() {
		q := fmt.Sprintf(`
			UPDATE ad_campaigns
			SET %s='', updated_at=NOW()
			WHERE id=$1 AND publisher_id=$2 AND COALESCE(auto_closed, false) = false
		`, col)
		tag, err := s.db.Pool.Exec(ctx, q, id, publisherID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, s.errCampaignMediaUpdateMiss(ctx, id, publisherID)
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.mem[id]
	if !ok || c.PublisherID != publisherID {
		return nil, ErrNotFound
	}
	if c.AutoClosed {
		return nil, ErrCampaignAutoClosed
	}
	switch slot {
	case ViewportDesktop:
		c.CreativeDesktopURL = ""
	case ViewportTablet:
		c.CreativeTabletURL = ""
	case ViewportMobile:
		c.CreativeMobileURL = ""
	}
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

// AttachYouTubeViewport sets youtube id for one slot (+ legacy when empty).
func (s *AdStore) AttachYouTubeViewport(ctx context.Context, id, publisherID, slot, videoID, creativeType string) (*AdCampaign, error) {
	slot = NormalizeViewportSlot(slot)
	col := viewportVideoColumn(slot)
	if col == "" {
		return nil, fmt.Errorf("invalid viewport slot")
	}
	videoID = strings.TrimSpace(videoID)
	if videoID == "" {
		return nil, fmt.Errorf("video_id required")
	}
	if strings.TrimSpace(creativeType) == "" {
		return nil, fmt.Errorf("creative_type required")
	}
	if s.db != nil && s.db.Ready() {
		q := fmt.Sprintf(`
			UPDATE ad_campaigns
			SET %s=$2,
			    creative_type=$3,
			    youtube_video_id = CASE
			      WHEN TRIM(COALESCE(youtube_video_id,'')) = '' THEN $2
			      ELSE youtube_video_id
			    END,
			    updated_at=NOW()
			WHERE id=$1 AND publisher_id=$4 AND COALESCE(auto_closed, false) = false
		`, col)
		tag, err := s.db.Pool.Exec(ctx, q, id, videoID, creativeType, publisherID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, s.errCampaignMediaUpdateMiss(ctx, id, publisherID)
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.mem[id]
	if !ok || c.PublisherID != publisherID {
		return nil, ErrNotFound
	}
	if c.AutoClosed {
		return nil, ErrCampaignAutoClosed
	}
	switch slot {
	case ViewportDesktop:
		c.YouTubeVideoIDDesktop = videoID
	case ViewportTablet:
		c.YouTubeVideoIDTablet = videoID
	case ViewportMobile:
		c.YouTubeVideoIDMobile = videoID
	}
	c.CreativeType = creativeType
	if strings.TrimSpace(c.YouTubeVideoID) == "" {
		c.YouTubeVideoID = videoID
	}
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

// ClearViewportVideo clears one slot youtube id.
func (s *AdStore) ClearViewportVideo(ctx context.Context, id, publisherID, slot string) (*AdCampaign, error) {
	slot = NormalizeViewportSlot(slot)
	col := viewportVideoColumn(slot)
	if col == "" {
		return nil, fmt.Errorf("invalid viewport slot")
	}
	if s.db != nil && s.db.Ready() {
		q := fmt.Sprintf(`
			UPDATE ad_campaigns
			SET %s='', updated_at=NOW()
			WHERE id=$1 AND publisher_id=$2 AND COALESCE(auto_closed, false) = false
		`, col)
		tag, err := s.db.Pool.Exec(ctx, q, id, publisherID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, s.errCampaignMediaUpdateMiss(ctx, id, publisherID)
		}
		return s.Get(ctx, id)
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.mem[id]
	if !ok || c.PublisherID != publisherID {
		return nil, ErrNotFound
	}
	if c.AutoClosed {
		return nil, ErrCampaignAutoClosed
	}
	switch slot {
	case ViewportDesktop:
		c.YouTubeVideoIDDesktop = ""
	case ViewportTablet:
		c.YouTubeVideoIDTablet = ""
	case ViewportMobile:
		c.YouTubeVideoIDMobile = ""
	}
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

func viewportImageColumn(slot string) string {
	switch NormalizeViewportSlot(slot) {
	case ViewportDesktop:
		return "creative_desktop_url"
	case ViewportTablet:
		return "creative_tablet_url"
	case ViewportMobile:
		return "creative_mobile_url"
	default:
		return ""
	}
}

func viewportVideoColumn(slot string) string {
	switch NormalizeViewportSlot(slot) {
	case ViewportDesktop:
		return "youtube_video_id_desktop"
	case ViewportTablet:
		return "youtube_video_id_tablet"
	case ViewportMobile:
		return "youtube_video_id_mobile"
	default:
		return ""
	}
}
