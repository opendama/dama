package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"dama/apps/api/internal/db"

	"github.com/google/uuid"
)

type AdCampaign struct {
	ID                    string          `json:"id"`
	PublisherID           string          `json:"-"` // owner id - never expose on public serve
	Title                 string          `json:"title"`
	Status                string          `json:"status"`
	StatusLabel           string          `json:"status_label,omitempty"` // DB label; not a column
	DailySpendCap         *float64        `json:"daily_spend_cap,omitempty"`
	GeoTargets            json.RawMessage `json:"geo_targets,omitempty"`
	CreativeType          string          `json:"creative_type"`
	CreativeTypeLabel     string          `json:"creative_type_label,omitempty"` // DB label; not a column
	CreativeURL           string          `json:"creative_url,omitempty"`
	CreativeDesktopURL    string          `json:"creative_desktop_url,omitempty"`
	CreativeTabletURL     string          `json:"creative_tablet_url,omitempty"`
	CreativeMobileURL     string          `json:"creative_mobile_url,omitempty"`
	ThumbnailURL          string          `json:"thumbnail_url,omitempty"`
	Gallery               []string        `json:"gallery,omitempty"`
	YouTubeVideoID        string          `json:"video_id,omitempty"` // external video id; vendor-neutral wire name
	YouTubeVideoIDDesktop string          `json:"video_id_desktop,omitempty"`
	YouTubeVideoIDTablet  string          `json:"video_id_tablet,omitempty"`
	YouTubeVideoIDMobile  string          `json:"video_id_mobile,omitempty"`
	Impressions           int64           `json:"impressions"`
	Clicks                int64           `json:"clicks"`
	VideoCompletions      int64           `json:"video_completions"`
	UniqueReach           int64           `json:"unique_reach"`
	ScheduleEnabled       bool            `json:"schedule_enabled"`
	FirstShowAfterSeconds *int            `json:"first_show_after_seconds,omitempty"`
	IntervalSeconds       *int            `json:"interval_seconds,omitempty"`
	NonSkippableSeconds   *int            `json:"non_skippable_seconds,omitempty"`
	DailyImpressionCap    *int            `json:"daily_impression_cap,omitempty"`
	WeeklyImpressionCap   *int            `json:"weekly_impression_cap,omitempty"`
	MonthlyImpressionCap  *int            `json:"monthly_impression_cap,omitempty"`
	YearlyImpressionCap   *int            `json:"yearly_impression_cap,omitempty"`
	EndsAt                *time.Time      `json:"ends_at,omitempty"`
	ClosedAt              *time.Time      `json:"closed_at,omitempty"`
	AutoClosed            bool            `json:"auto_closed"`
	CreatedAt             time.Time       `json:"created_at"`
	UpdatedAt             time.Time       `json:"-"`
}

type AdStore struct {
	db  *db.Handle
	mu  sync.RWMutex
	mem map[string]*AdCampaign
}

func NewAdStore(handle *db.Handle) *AdStore {
	return &AdStore{db: handle, mem: map[string]*AdCampaign{}}
}

func (s *AdStore) requireDB() error {
	if s.db != nil && s.db.Ready() {
		return nil
	}
	if allowMemoryMode() {
		return nil
	}
	return fmt.Errorf("service temporarily unavailable")
}

type CreateAdInput struct {
	PublisherID   string
	Title         string
	Status        string
	DailySpendCap *float64
	GeoTargets    []any
	CreativeType  string
	CreativeURL   string
	EndsAt        *time.Time
}

func (s *AdStore) Create(ctx context.Context, in CreateAdInput) (*AdCampaign, error) {
	if in.CreativeType == "" {
		return nil, fmt.Errorf("creative_type required")
	}
	if in.Status == "" {
		return nil, fmt.Errorf("status required")
	}
	geo, _ := json.Marshal(in.GeoTargets)
	if in.GeoTargets == nil {
		geo = []byte("[]")
	}
	now := time.Now().UTC()
	c := &AdCampaign{
		ID:            uuid.NewString(),
		PublisherID:   in.PublisherID,
		Title:         in.Title,
		Status:        in.Status,
		DailySpendCap: in.DailySpendCap,
		GeoTargets:    geo,
		CreativeType:  in.CreativeType,
		CreativeURL:   in.CreativeURL,
		EndsAt:        in.EndsAt,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			INSERT INTO ad_campaigns (
				id, publisher_id, title, status, daily_spend_cap, geo_targets, creative_type, creative_url, ends_at, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,NOW(),NOW())
		`, c.ID, c.PublisherID, c.Title, c.Status, c.DailySpendCap, string(geo), c.CreativeType, c.CreativeURL, c.EndsAt)
		if err != nil {
			return nil, err
		}
		cp := *c
		return &cp, nil
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.mem[c.ID] = c
	s.mu.Unlock()
	cp := *c
	return &cp, nil
}

// DeleteOwned removes a campaign owned by publisher (used to roll back unpaid create).
func (s *AdStore) DeleteOwned(ctx context.Context, id, publisherID string) error {
	id = strings.TrimSpace(id)
	publisherID = strings.TrimSpace(publisherID)
	if id == "" || publisherID == "" {
		return fmt.Errorf("id and publisher required")
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			DELETE FROM ad_campaigns WHERE id=$1 AND publisher_id=$2
		`, id, publisherID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("campaign not found")
		}
		return nil
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	c, ok := s.mem[id]
	if !ok || c.PublisherID != publisherID {
		return fmt.Errorf("campaign not found")
	}
	delete(s.mem, id)
	return nil
}

// CampaignListFilter optional Trim-style list filters (empty = no constraint).
type CampaignListFilter struct {
	Q      string
	Status string
}

func campaignMatchesListFilter(c AdCampaign, filter CampaignListFilter) bool {
	if s := strings.TrimSpace(filter.Status); s != "" && c.Status != s {
		return false
	}
	q := strings.ToLower(strings.TrimSpace(filter.Q))
	if q == "" {
		return true
	}
	hay := strings.ToLower(strings.Join([]string{c.Title, c.ID, c.Status, c.CreativeType}, " "))
	return strings.Contains(hay, q)
}

func (s *AdStore) ListByPublisher(ctx context.Context, publisherID string) ([]AdCampaign, error) {
	list, _, err := s.ListByPublisherPaged(ctx, publisherID, 0, 100, CampaignListFilter{})
	return list, err
}

// ListByPublisherPaged returns a skip/limit page plus total (Trim BuildMeta).
func (s *AdStore) ListByPublisherPaged(ctx context.Context, publisherID string, skip, limit int, filter CampaignListFilter) ([]AdCampaign, int, error) {
	if skip < 0 {
		skip = 0
	}
	if limit < 1 {
		limit = 100
	}
	filter.Q = strings.TrimSpace(filter.Q)
	filter.Status = strings.TrimSpace(filter.Status)
	if s.db != nil && s.db.Ready() {
		where := "publisher_id=$1"
		args := []any{publisherID}
		argN := 2
		if filter.Status != "" {
			where += fmt.Sprintf(" AND status=$%d", argN)
			args = append(args, filter.Status)
			argN++
		}
		if filter.Q != "" {
			where += fmt.Sprintf(" AND (title ILIKE $%d OR id::text ILIKE $%d OR status ILIKE $%d OR creative_type ILIKE $%d)", argN, argN, argN, argN)
			args = append(args, "%"+filter.Q+"%")
			argN++
		}
		var total int
		if err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM ad_campaigns WHERE `+where, args...).Scan(&total); err != nil {
			return nil, 0, err
		}
		listSQL := `
			SELECT ` + s.scanCampaignCols() + `
			FROM ad_campaigns WHERE ` + where + ` ORDER BY created_at DESC
			LIMIT $` + fmt.Sprintf("%d", argN) + ` OFFSET $` + fmt.Sprintf("%d", argN+1)
		args = append(args, limit, skip)
		rows, err := s.db.Pool.Query(ctx, listSQL, args...)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		out := []AdCampaign{}
		for rows.Next() {
			c, err := scanAdCampaign(rows.Scan)
			if err != nil {
				return nil, 0, err
			}
			out = append(out, *c)
		}
		return out, total, rows.Err()
	}
	if err := s.requireDB(); err != nil {
		return nil, 0, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	filtered := []AdCampaign{}
	for _, c := range s.mem {
		if c.PublisherID != publisherID {
			continue
		}
		if !campaignMatchesListFilter(*c, filter) {
			continue
		}
		filtered = append(filtered, *c)
	}
	total := len(filtered)
	if skip >= total {
		return []AdCampaign{}, total, nil
	}
	end := skip + limit
	if end > total {
		end = total
	}
	return filtered[skip:end], total, nil
}

// ErrInvalidAdStatus is returned when status fails platform_settings.client_enums validation.
var ErrInvalidAdStatus = fmt.Errorf("invalid status")

// ErrCampaignTitleLocked is returned when title cannot change (archived or auto-closed).
var ErrCampaignTitleLocked = fmt.Errorf("campaign title locked")

// ErrCampaignAutoClosed is returned when auto_closed blocks media mutations.
var ErrCampaignAutoClosed = fmt.Errorf("campaign auto closed")

func (s *AdStore) errCampaignMediaUpdateMiss(ctx context.Context, id, publisherID string) error {
	cur, err := s.Get(ctx, id)
	if err != nil || cur.PublisherID != publisherID {
		return ErrNotFound
	}
	if cur.AutoClosed {
		return ErrCampaignAutoClosed
	}
	return ErrNotFound
}

// UpdateTitle sets the publisher-owned campaign title while editable.
// archivedStatus (from client_enums) blocks title edits once manually closed.
func (s *AdStore) UpdateTitle(ctx context.Context, id, publisherID, title, archivedStatus string) (*AdCampaign, error) {
	title = strings.TrimSpace(title)
	archivedStatus = strings.TrimSpace(archivedStatus)
	if title == "" {
		return nil, fmt.Errorf("title required")
	}
	if s.db != nil && s.db.Ready() {
		cur, err := s.Get(ctx, id)
		if err != nil || cur.PublisherID != publisherID {
			return nil, ErrNotFound
		}
		if cur.AutoClosed || (archivedStatus != "" && cur.Status == archivedStatus) {
			return nil, ErrCampaignTitleLocked
		}
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET title = $2, updated_at = NOW()
			WHERE id = $1 AND publisher_id = $3 AND auto_closed = FALSE
			  AND ($4 = '' OR status IS DISTINCT FROM $4)
		`, id, title, publisherID, archivedStatus)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			cur2, err2 := s.Get(ctx, id)
			if err2 != nil || cur2.PublisherID != publisherID {
				return nil, ErrNotFound
			}
			if cur2.AutoClosed || (archivedStatus != "" && cur2.Status == archivedStatus) {
				return nil, ErrCampaignTitleLocked
			}
			return nil, ErrNotFound
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
	if c.AutoClosed || (archivedStatus != "" && c.Status == archivedStatus) {
		return nil, ErrCampaignTitleLocked
	}
	c.Title = title
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

func (s *AdStore) SetStatus(ctx context.Context, id, publisherID, status string) (*AdCampaign, error) {
	if status == "" {
		return nil, ErrInvalidAdStatus
	}
	if s.db != nil && s.db.Ready() {
		cur, err := s.Get(ctx, id)
		if err != nil || cur.PublisherID != publisherID {
			return nil, ErrNotFound
		}
		// Auto-closed campaigns cannot be revived via raw status PATCH (use Close/Reopen only).
		if cur.AutoClosed {
			return nil, ErrCampaignCannotReopen
		}
		tag, err := s.db.Pool.Exec(ctx, `UPDATE ad_campaigns SET status=$2, updated_at=NOW() WHERE id=$1 AND publisher_id=$3 AND auto_closed = FALSE`, id, status, publisherID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, ErrNotFound
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
		return nil, ErrCampaignCannotReopen
	}
	c.Status = status
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

// ErrCampaignCannotReopen is returned when auto_closed blocks reopen.
var ErrCampaignCannotReopen = fmt.Errorf("campaign cannot reopen")

// CloseForPublisher archives a campaign manually (auto_closed=false).
func (s *AdStore) CloseForPublisher(ctx context.Context, id, publisherID, archivedStatus string) (*AdCampaign, error) {
	archivedStatus = strings.TrimSpace(archivedStatus)
	if archivedStatus == "" {
		return nil, ErrInvalidAdStatus
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET status = $2, closed_at = NOW(), auto_closed = FALSE, updated_at = NOW()
			WHERE id = $1 AND publisher_id = $3 AND status IS DISTINCT FROM $2
		`, id, archivedStatus, publisherID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			// Already archived or missing: return current row or not found.
			c, err := s.Get(ctx, id)
			if err != nil {
				return nil, ErrNotFound
			}
			if c.PublisherID != publisherID {
				return nil, ErrNotFound
			}
			if c.Status == archivedStatus {
				return c, nil
			}
			return nil, ErrNotFound
		}
		return s.Get(ctx, id)
	}
	return nil, s.requireDB()
}

// ReopenForPublisher restores an archived campaign that was not auto-closed.
func (s *AdStore) ReopenForPublisher(ctx context.Context, id, publisherID, archivedStatus, reopenStatus string) (*AdCampaign, error) {
	archivedStatus = strings.TrimSpace(archivedStatus)
	reopenStatus = strings.TrimSpace(reopenStatus)
	if archivedStatus == "" || reopenStatus == "" {
		return nil, ErrInvalidAdStatus
	}
	if s.db != nil && s.db.Ready() {
		c, err := s.Get(ctx, id)
		if err != nil || c.PublisherID != publisherID {
			return nil, ErrNotFound
		}
		if c.AutoClosed {
			return nil, ErrCampaignCannotReopen
		}
		if c.Status != archivedStatus {
			return nil, ErrCampaignCannotReopen
		}
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET status = $2, closed_at = NULL, auto_closed = FALSE, updated_at = NOW()
			WHERE id = $1 AND publisher_id = $3 AND status = $4 AND auto_closed = FALSE
		`, id, reopenStatus, publisherID, archivedStatus)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, ErrCampaignCannotReopen
		}
		return s.Get(ctx, id)
	}
	return nil, s.requireDB()
}

// AutoCloseExpired archives campaigns past ends_at (auto_closed=true).
// Returns closed campaigns for notification fan-out.
func (s *AdStore) AutoCloseExpired(ctx context.Context, archivedStatus string) ([]AdCampaign, error) {
	archivedStatus = strings.TrimSpace(archivedStatus)
	if archivedStatus == "" || s.db == nil || !s.db.Ready() {
		return nil, nil
	}
	rows, err := s.db.Pool.Query(ctx, `
		UPDATE ad_campaigns
		SET status = $1, closed_at = NOW(), auto_closed = TRUE, updated_at = NOW()
		WHERE ends_at IS NOT NULL
		  AND ends_at <= NOW()
		  AND auto_closed = FALSE
		  AND status IS DISTINCT FROM $1
		RETURNING `+s.scanCampaignCols(), archivedStatus)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AdCampaign{}
	for rows.Next() {
		c, err := scanAdCampaign(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (s *AdStore) AttachYouTube(ctx context.Context, id, publisherID, videoID, creativeType string) (*AdCampaign, error) {
	if strings.TrimSpace(creativeType) == "" {
		return nil, fmt.Errorf("creative_type required")
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns SET
				youtube_video_id=$2,
				creative_type=$4,
				youtube_video_id_desktop = CASE WHEN TRIM(COALESCE(youtube_video_id_desktop,'')) = '' THEN $2 ELSE youtube_video_id_desktop END,
				youtube_video_id_tablet = CASE WHEN TRIM(COALESCE(youtube_video_id_tablet,'')) = '' THEN $2 ELSE youtube_video_id_tablet END,
				youtube_video_id_mobile = CASE WHEN TRIM(COALESCE(youtube_video_id_mobile,'')) = '' THEN $2 ELSE youtube_video_id_mobile END,
				updated_at=NOW()
			WHERE id=$1 AND publisher_id=$3 AND COALESCE(auto_closed, false) = false
		`, id, videoID, publisherID, creativeType)
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
	if c, ok := s.mem[id]; ok && c.PublisherID == publisherID {
		if c.AutoClosed {
			return nil, ErrCampaignAutoClosed
		}
		c.YouTubeVideoID = videoID
		c.CreativeType = creativeType
		if strings.TrimSpace(c.YouTubeVideoIDDesktop) == "" {
			c.YouTubeVideoIDDesktop = videoID
		}
		if strings.TrimSpace(c.YouTubeVideoIDTablet) == "" {
			c.YouTubeVideoIDTablet = videoID
		}
		if strings.TrimSpace(c.YouTubeVideoIDMobile) == "" {
			c.YouTubeVideoIDMobile = videoID
		}
		c.UpdatedAt = time.Now().UTC()
		cp := *c
		return &cp, nil
	}
	return nil, ErrNotFound
}

func (s *AdStore) UpdateCreative(ctx context.Context, id, publisherID, creativeType, creativeURL string) (*AdCampaign, error) {
	if creativeURL == "" {
		return nil, fmt.Errorf("creative_url required")
	}
	if strings.TrimSpace(creativeType) == "" {
		return nil, fmt.Errorf("creative_type required")
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET creative_type=$2,
			    creative_url=$3,
			    creative_desktop_url = CASE WHEN TRIM(COALESCE(creative_desktop_url,'')) = '' THEN $3 ELSE creative_desktop_url END,
			    creative_tablet_url = CASE WHEN TRIM(COALESCE(creative_tablet_url,'')) = '' THEN $3 ELSE creative_tablet_url END,
			    creative_mobile_url = CASE WHEN TRIM(COALESCE(creative_mobile_url,'')) = '' THEN $3 ELSE creative_mobile_url END,
			    updated_at=NOW()
			WHERE id=$1 AND publisher_id=$4 AND COALESCE(auto_closed, false) = false
		`, id, creativeType, creativeURL, publisherID)
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
	c.CreativeType = creativeType
	c.CreativeURL = creativeURL
	if strings.TrimSpace(c.CreativeDesktopURL) == "" {
		c.CreativeDesktopURL = creativeURL
	}
	if strings.TrimSpace(c.CreativeTabletURL) == "" {
		c.CreativeTabletURL = creativeURL
	}
	if strings.TrimSpace(c.CreativeMobileURL) == "" {
		c.CreativeMobileURL = creativeURL
	}
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

// ClearYouTube clears legacy youtube_video_id (slot videos unchanged).
func (s *AdStore) ClearYouTube(ctx context.Context, id, publisherID string) (*AdCampaign, error) {
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET youtube_video_id='', updated_at=NOW()
			WHERE id=$1 AND publisher_id=$2 AND COALESCE(auto_closed, false) = false
		`, id, publisherID)
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
	c.YouTubeVideoID = ""
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

func (s *AdStore) UpdateThumbnail(ctx context.Context, id, publisherID, thumbnailURL string) (*AdCampaign, error) {
	if strings.TrimSpace(thumbnailURL) == "" {
		return nil, fmt.Errorf("thumbnail_url required")
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET thumbnail_url=$2, updated_at=NOW()
			WHERE id=$1 AND publisher_id=$3 AND COALESCE(auto_closed, false) = false
		`, id, strings.TrimSpace(thumbnailURL), publisherID)
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
	c.ThumbnailURL = strings.TrimSpace(thumbnailURL)
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

// ClearThumbnail clears ad_campaigns.thumbnail_url (smart-menu thumbnail remove).
func (s *AdStore) ClearThumbnail(ctx context.Context, id, publisherID string) (*AdCampaign, error) {
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET thumbnail_url=NULL, updated_at=NOW()
			WHERE id=$1 AND publisher_id=$2 AND COALESCE(auto_closed, false) = false
		`, id, publisherID)
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
	c.ThumbnailURL = ""
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	return &cp, nil
}

// AppendGalleryImage appends one media URL to the campaign gallery jsonb array.
func (s *AdStore) AppendGalleryImage(ctx context.Context, id, publisherID, imageURL string) (*AdCampaign, error) {
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return nil, fmt.Errorf("gallery image url required")
	}
	cur, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if cur.PublisherID != publisherID {
		return nil, ErrNotFound
	}
	if cur.AutoClosed {
		return nil, ErrCampaignAutoClosed
	}
	n := 0
	for _, u := range cur.Gallery {
		if strings.TrimSpace(u) != "" {
			n++
		}
	}
	if n >= MaxEntityGalleryImages {
		return nil, ErrGalleryFull
	}
	if s.db != nil && s.db.Ready() {
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET gallery = COALESCE(gallery, '[]'::jsonb) || to_jsonb($2::text), updated_at=NOW()
			WHERE id=$1 AND publisher_id=$3
			  AND COALESCE(auto_closed, false) = false
			  AND jsonb_array_length(COALESCE(gallery, '[]'::jsonb)) < $4
		`, id, imageURL, publisherID, MaxEntityGalleryImages)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			again, gerr := s.Get(ctx, id)
			if gerr != nil || again.PublisherID != publisherID {
				return nil, ErrNotFound
			}
			if again.AutoClosed {
				return nil, ErrCampaignAutoClosed
			}
			filled := 0
			for _, u := range again.Gallery {
				if strings.TrimSpace(u) != "" {
					filled++
				}
			}
			if filled >= MaxEntityGalleryImages {
				return nil, ErrGalleryFull
			}
			return nil, ErrNotFound
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
	if c.Gallery == nil {
		c.Gallery = []string{}
	}
	filled := 0
	for _, u := range c.Gallery {
		if strings.TrimSpace(u) != "" {
			filled++
		}
	}
	if filled >= MaxEntityGalleryImages {
		return nil, ErrGalleryFull
	}
	c.Gallery = append(c.Gallery, imageURL)
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	if cp.Gallery != nil {
		cp.Gallery = append([]string{}, c.Gallery...)
	}
	return &cp, nil
}

func (s *AdStore) UpdateGallery(ctx context.Context, id, publisherID string, gallery []string) (*AdCampaign, error) {
	if gallery == nil {
		gallery = []string{}
	}
	clean := make([]string, 0, len(gallery))
	for _, u := range gallery {
		u = strings.TrimSpace(u)
		if u != "" {
			clean = append(clean, u)
		}
	}
	if len(clean) > MaxEntityGalleryImages {
		return nil, ErrGalleryFull
	}
	if s.db != nil && s.db.Ready() {
		raw, err := json.Marshal(clean)
		if err != nil {
			return nil, fmt.Errorf("gallery invalid")
		}
		tag, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns
			SET gallery=$2::jsonb, updated_at=NOW()
			WHERE id=$1 AND publisher_id=$3 AND COALESCE(auto_closed, false) = false
		`, id, string(raw), publisherID)
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
	c.Gallery = append([]string{}, clean...)
	c.UpdatedAt = time.Now().UTC()
	cp := *c
	cp.Gallery = append([]string{}, clean...)
	return &cp, nil
}

// RemoveGalleryAt removes the gallery image at index (0-based among non-empty URLs).
func (s *AdStore) RemoveGalleryAt(ctx context.Context, id, publisherID string, index int) (*AdCampaign, error) {
	cur, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if cur.PublisherID != publisherID {
		return nil, ErrNotFound
	}
	if cur.AutoClosed {
		return nil, ErrCampaignAutoClosed
	}
	urls := make([]string, 0, len(cur.Gallery))
	for _, u := range cur.Gallery {
		u = strings.TrimSpace(u)
		if u != "" {
			urls = append(urls, u)
		}
	}
	if index < 0 || index >= len(urls) {
		return nil, ErrGalleryIndex
	}
	next := append(append([]string{}, urls[:index]...), urls[index+1:]...)
	return s.UpdateGallery(ctx, id, publisherID, next)
}

func (s *AdStore) RecordVideoCompletion(ctx context.Context, id string) error {
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns SET video_completions = video_completions + 1, updated_at=NOW() WHERE id=$1
		`, id)
		return err
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.mem[id]; ok {
		c.VideoCompletions++
		c.UpdatedAt = time.Now().UTC()
		return nil
	}
	return ErrNotFound
}

func (s *AdStore) ListActive(ctx context.Context, servableStatus string) ([]AdCampaign, error) {
	if servableStatus == "" {
		return nil, fmt.Errorf("servable status required")
	}
	if s.db != nil && s.db.Ready() {
		rows, err := s.db.Pool.Query(ctx, `
			SELECT `+s.scanCampaignCols()+`
			FROM ad_campaigns WHERE status=$1 ORDER BY created_at DESC
		`, servableStatus)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		out := []AdCampaign{}
		for rows.Next() {
			c, err := scanAdCampaign(rows.Scan)
			if err != nil {
				return nil, err
			}
			out = append(out, *c)
		}
		return out, nil
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []AdCampaign{}
	for _, c := range s.mem {
		if c.Status == servableStatus {
			out = append(out, *c)
		}
	}
	return out, nil
}

// WithinDailySpendCap returns false when today's impressions * unitCost meet the daily spend budget.
// dayImpressions must come from CountImpressionsByPeriod (not lifetime Impressions).
// unitCost must come from platform_settings.ad_pricing (fail closed when missing).
func (c *AdCampaign) WithinDailySpendCap(unitCost float64, dayImpressions int64) bool {
	if c == nil || c.DailySpendCap == nil || *c.DailySpendCap <= 0 {
		return true
	}
	if unitCost <= 0 {
		return false
	}
	if dayImpressions < 0 {
		dayImpressions = 0
	}
	return float64(dayImpressions)*unitCost < *c.DailySpendCap
}

// RecordImpressionWithPlacement requires placement + servable status (no invented defaults).
// requireSchedule=true for in-match placement (Meta-style: only scheduled campaigns deliver in-match).
func (s *AdStore) RecordImpressionWithPlacement(ctx context.Context, id string, unitCost float64, viewerKey, placement, servableStatus string, requireSchedule bool) error {
	c, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	if unitCost <= 0 {
		return fmt.Errorf("ad pricing unavailable")
	}
	servableStatus = strings.TrimSpace(servableStatus)
	if servableStatus == "" {
		return fmt.Errorf("servable campaign status unavailable")
	}
	if c.Status != servableStatus {
		return fmt.Errorf("campaign not servable")
	}
	if requireSchedule && !c.ScheduleEnabled {
		return fmt.Errorf("schedule not enabled")
	}
	counts, err := s.CountImpressionsByPeriod(ctx, id, time.Now().UTC())
	if err != nil {
		return err
	}
	if !c.WithinDailySpendCap(unitCost, counts.Day) {
		return fmt.Errorf("daily spend cap reached")
	}
	if !c.WithinPeriodCaps(counts) {
		return fmt.Errorf("period impression cap reached")
	}
	viewerKey = strings.TrimSpace(viewerKey)
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns SET impressions = impressions + 1, updated_at=NOW() WHERE id=$1
		`, id)
		if err != nil {
			return err
		}
		if err := s.RecordImpressionEvent(ctx, id, viewerKey, placement); err != nil {
			return err
		}
		if viewerKey != "" {
			tag, err := s.db.Pool.Exec(ctx, `
				INSERT INTO ad_unique_viewers (campaign_id, viewer_key)
				VALUES ($1, $2)
				ON CONFLICT (campaign_id, viewer_key) DO NOTHING
			`, id, viewerKey)
			if err != nil {
				return err
			}
			if tag.RowsAffected() > 0 {
				_, err = s.db.Pool.Exec(ctx, `
					UPDATE ad_campaigns SET unique_reach = unique_reach + 1, updated_at=NOW() WHERE id=$1
				`, id)
				if err != nil {
					return err
				}
			}
		}
		return nil
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if mem, ok := s.mem[id]; ok {
		mem.Impressions++
		if viewerKey != "" {
			mem.UniqueReach++
		}
		mem.UpdatedAt = time.Now().UTC()
		return nil
	}
	return ErrNotFound
}

func (s *AdStore) RecordClick(ctx context.Context, id string) error {
	if s.db != nil && s.db.Ready() {
		_, err := s.db.Pool.Exec(ctx, `
			UPDATE ad_campaigns SET clicks = clicks + 1, updated_at=NOW() WHERE id=$1
		`, id)
		return err
	}
	if err := s.requireDB(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.mem[id]; ok {
		c.Clicks++
		c.UpdatedAt = time.Now().UTC()
		return nil
	}
	return ErrNotFound
}

func (s *AdStore) Get(ctx context.Context, id string) (*AdCampaign, error) {
	if s.db != nil && s.db.Ready() {
		row := s.db.Pool.QueryRow(ctx, `
			SELECT `+s.scanCampaignCols()+`
			FROM ad_campaigns WHERE id=$1
		`, id)
		c, err := scanAdCampaign(row.Scan)
		if err != nil {
			return nil, ErrNotFound
		}
		return c, nil
	}
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if c, ok := s.mem[id]; ok {
		cp := *c
		return &cp, nil
	}
	return nil, ErrNotFound
}

// GetForPublisher returns a campaign only when owned by publisherID.
func (s *AdStore) GetForPublisher(ctx context.Context, id, publisherID string) (*AdCampaign, error) {
	id = strings.TrimSpace(id)
	publisherID = strings.TrimSpace(publisherID)
	if id == "" || publisherID == "" {
		return nil, ErrNotFound
	}
	c, err := s.Get(ctx, id)
	if err != nil || c == nil {
		return nil, ErrNotFound
	}
	if c.PublisherID != publisherID {
		return nil, ErrNotFound
	}
	return c, nil
}
