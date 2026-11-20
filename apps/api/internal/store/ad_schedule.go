package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// CampaignScheduleInput is admin/publisher schedule configuration for in-match ads.
type CampaignScheduleInput struct {
	ScheduleEnabled       bool
	FirstShowAfterSeconds *int
	IntervalSeconds       *int
	NonSkippableSeconds   *int
	DailyImpressionCap    *int
	WeeklyImpressionCap   *int
	MonthlyImpressionCap  *int
	YearlyImpressionCap   *int
}

// PeriodImpressionCounts are calendar-period impression totals for a campaign.
type PeriodImpressionCounts struct {
	Day   int64 `json:"day"`
	Week  int64 `json:"week"`
	Month int64 `json:"month"`
	Year  int64 `json:"year"`
}

func (s *AdStore) scanCampaignCols() string {
	return `
		id, publisher_id, title, status, daily_spend_cap, geo_targets::text, creative_type,
		COALESCE(creative_url,''),
		COALESCE(creative_desktop_url,''), COALESCE(creative_tablet_url,''), COALESCE(creative_mobile_url,''),
		COALESCE(thumbnail_url,''), COALESCE(gallery,'[]'::jsonb),
		COALESCE(youtube_video_id,''),
		COALESCE(youtube_video_id_desktop,''), COALESCE(youtube_video_id_tablet,''), COALESCE(youtube_video_id_mobile,''),
		impressions, clicks,
		COALESCE(video_completions,0), COALESCE(unique_reach,0), created_at, updated_at,
		COALESCE(schedule_enabled,false), first_show_after_seconds, interval_seconds,
		non_skippable_seconds, daily_impression_cap, weekly_impression_cap,
		monthly_impression_cap, yearly_impression_cap,
		ends_at, closed_at, COALESCE(auto_closed,false)
	`
}

func scanAdCampaign(scan func(dest ...any) error) (*AdCampaign, error) {
	var c AdCampaign
	var geo, galleryRaw []byte
	err := scan(
		&c.ID, &c.PublisherID, &c.Title, &c.Status, &c.DailySpendCap, &geo,
		&c.CreativeType, &c.CreativeURL,
		&c.CreativeDesktopURL, &c.CreativeTabletURL, &c.CreativeMobileURL,
		&c.ThumbnailURL, &galleryRaw, &c.YouTubeVideoID,
		&c.YouTubeVideoIDDesktop, &c.YouTubeVideoIDTablet, &c.YouTubeVideoIDMobile,
		&c.Impressions, &c.Clicks,
		&c.VideoCompletions, &c.UniqueReach, &c.CreatedAt, &c.UpdatedAt,
		&c.ScheduleEnabled, &c.FirstShowAfterSeconds, &c.IntervalSeconds,
		&c.NonSkippableSeconds, &c.DailyImpressionCap, &c.WeeklyImpressionCap,
		&c.MonthlyImpressionCap, &c.YearlyImpressionCap,
		&c.EndsAt, &c.ClosedAt, &c.AutoClosed,
	)
	if err != nil {
		return nil, err
	}
	c.GeoTargets = geo
	c.Gallery = []string{}
	_ = json.Unmarshal(galleryRaw, &c.Gallery)
	return &c, nil
}

func (s *AdStore) ListAll(ctx context.Context, limit int) ([]AdCampaign, error) {
	list, _, err := s.ListAllPaged(ctx, 0, limit, CampaignListFilter{})
	return list, err
}

// ListAllPaged returns skip/limit page + total (Trim BuildMeta).
func (s *AdStore) ListAllPaged(ctx context.Context, skip, limit int, filter CampaignListFilter) ([]AdCampaign, int, error) {
	if limit <= 0 {
		limit = 200
	}
	if skip < 0 {
		skip = 0
	}
	filter.Q = strings.TrimSpace(filter.Q)
	filter.Status = strings.TrimSpace(filter.Status)
	if s.db == nil || !s.db.Ready() {
		return nil, 0, fmt.Errorf("service temporarily unavailable")
	}
	where := "TRUE"
	args := []any{}
	argN := 1
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

func (s *AdStore) ListScheduleEnabled(ctx context.Context, servableStatus string) ([]AdCampaign, error) {
	if servableStatus == "" {
		return nil, fmt.Errorf("servable status required")
	}
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT `+s.scanCampaignCols()+`
		FROM ad_campaigns
		WHERE status=$1 AND schedule_enabled=true
		ORDER BY created_at DESC
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
	return out, rows.Err()
}

func (s *AdStore) UpdateSchedule(ctx context.Context, id string, in CampaignScheduleInput) (*AdCampaign, error) {
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	// Cap floor is enforced only by AdsAPI.validateScheduleOverrides (ad_playback.impression_cap_min).
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE ad_campaigns SET
			schedule_enabled=$2,
			first_show_after_seconds=$3,
			interval_seconds=$4,
			non_skippable_seconds=$5,
			daily_impression_cap=$6,
			weekly_impression_cap=$7,
			monthly_impression_cap=$8,
			yearly_impression_cap=$9,
			updated_at=NOW()
		WHERE id=$1
	`, id, in.ScheduleEnabled, in.FirstShowAfterSeconds, in.IntervalSeconds, in.NonSkippableSeconds,
		in.DailyImpressionCap, in.WeeklyImpressionCap, in.MonthlyImpressionCap, in.YearlyImpressionCap)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.Get(ctx, id)
}

func (s *AdStore) UpdateScheduleForPublisher(ctx context.Context, id, publisherID string, in CampaignScheduleInput) (*AdCampaign, error) {
	c, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if c.PublisherID != publisherID {
		return nil, ErrNotFound
	}
	return s.UpdateSchedule(ctx, id, in)
}

func (s *AdStore) SetStatusAdmin(ctx context.Context, id, status string) (*AdCampaign, error) {
	if status == "" {
		return nil, ErrInvalidAdStatus
	}
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	cur, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	// Auto-closed campaigns stay archived until a dedicated reopen path exists for console.
	if cur.AutoClosed {
		return nil, ErrCampaignCannotReopen
	}
	tag, err := s.db.Pool.Exec(ctx, `
		UPDATE ad_campaigns SET status=$2, updated_at=NOW()
		WHERE id=$1 AND auto_closed = FALSE`, id, status)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.Get(ctx, id)
}

func (s *AdStore) CountImpressionsByPeriod(ctx context.Context, campaignID string, now time.Time) (PeriodImpressionCounts, error) {
	var out PeriodImpressionCounts
	if s.db == nil || !s.db.Ready() {
		return out, fmt.Errorf("service temporarily unavailable")
	}
	now = now.UTC()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	// ISO week: Monday start
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	weekStart := dayStart.AddDate(0, 0, -(weekday - 1))
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	yearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)

	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE created_at >= $2),
			COUNT(*) FILTER (WHERE created_at >= $3),
			COUNT(*) FILTER (WHERE created_at >= $4),
			COUNT(*) FILTER (WHERE created_at >= $5)
		FROM ad_impression_events
		WHERE campaign_id=$1
	`, campaignID, dayStart, weekStart, monthStart, yearStart).Scan(&out.Day, &out.Week, &out.Month, &out.Year)
	return out, err
}

// WithinPeriodCaps returns false when any configured calendar-period impression cap is exhausted.
func (c *AdCampaign) WithinPeriodCaps(counts PeriodImpressionCounts) bool {
	if c == nil {
		return false
	}
	if c.DailyImpressionCap != nil && counts.Day >= int64(*c.DailyImpressionCap) {
		return false
	}
	if c.WeeklyImpressionCap != nil && counts.Week >= int64(*c.WeeklyImpressionCap) {
		return false
	}
	if c.MonthlyImpressionCap != nil && counts.Month >= int64(*c.MonthlyImpressionCap) {
		return false
	}
	if c.YearlyImpressionCap != nil && counts.Year >= int64(*c.YearlyImpressionCap) {
		return false
	}
	return true
}

// SecondsUntilPeriodCapReset returns the soonest UTC calendar boundary that clears a
// currently exhausted period cap (Meta/YT-style: do not re-poll until the period resets).
// Returns 0 when no configured period cap is exhausted.
func (c *AdCampaign) SecondsUntilPeriodCapReset(counts PeriodImpressionCounts, now time.Time) int {
	if c == nil {
		return 0
	}
	now = now.UTC()
	soonest := 0
	consider := func(exhausted bool, next time.Time) {
		if !exhausted {
			return
		}
		w := int(next.Sub(now).Seconds())
		if w < 1 {
			w = 1
		}
		if soonest == 0 || w < soonest {
			soonest = w
		}
	}
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	consider(c.DailyImpressionCap != nil && counts.Day >= int64(*c.DailyImpressionCap), dayStart.AddDate(0, 0, 1))

	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	weekStart := dayStart.AddDate(0, 0, -(weekday - 1))
	consider(c.WeeklyImpressionCap != nil && counts.Week >= int64(*c.WeeklyImpressionCap), weekStart.AddDate(0, 0, 7))

	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	consider(c.MonthlyImpressionCap != nil && counts.Month >= int64(*c.MonthlyImpressionCap), monthStart.AddDate(0, 1, 0))

	yearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	consider(c.YearlyImpressionCap != nil && counts.Year >= int64(*c.YearlyImpressionCap), yearStart.AddDate(1, 0, 0))

	return soonest
}

func (s *AdStore) RecordImpressionEvent(ctx context.Context, campaignID, viewerKey, placement string) error {
	if s.db == nil || !s.db.Ready() {
		return fmt.Errorf("service temporarily unavailable")
	}
	viewerKey = strings.TrimSpace(viewerKey)
	placement = strings.TrimSpace(placement)
	if placement == "" {
		return fmt.Errorf("placement required")
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO ad_impression_events (campaign_id, viewer_key, placement)
		VALUES ($1, $2, $3)
	`, campaignID, viewerKey, placement)
	return err
}

// UpsertPermission inserts or updates a permission catalog row.
func (s *RBACStore) UpsertPermission(ctx context.Context, key, title, description string) (*RBACPermission, error) {
	key = strings.TrimSpace(key)
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if key == "" || title == "" {
		return nil, fmt.Errorf("key and title required")
	}
	if s.db == nil || !s.db.Ready() {
		return nil, fmt.Errorf("service temporarily unavailable")
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO rbac_permissions (key, title, description)
		VALUES ($1,$2,$3)
		ON CONFLICT (key) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description
	`, key, title, description)
	if err != nil {
		return nil, err
	}
	return &RBACPermission{Key: key, Title: title, Description: description}, nil
}

func (s *RBACStore) DeletePermission(ctx context.Context, key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return fmt.Errorf("key required")
	}
	if s.db == nil || !s.db.Ready() {
		return fmt.Errorf("service temporarily unavailable")
	}
	tag, err := s.db.Pool.Exec(ctx, `DELETE FROM rbac_permissions WHERE key=$1`, key)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// CountRolesWithPermission counts distinct roles holding permissionKey.
// If excludeRole is non-empty, that role is omitted from the count.
func (s *RBACStore) CountRolesWithPermission(ctx context.Context, permissionKey, excludeRole string) (int64, error) {
	permissionKey = strings.TrimSpace(permissionKey)
	excludeRole = strings.TrimSpace(excludeRole)
	if permissionKey == "" {
		return 0, fmt.Errorf("permission required")
	}
	if s.db == nil || !s.db.Ready() {
		return 0, fmt.Errorf("service temporarily unavailable")
	}
	var n int64
	var err error
	if excludeRole == "" {
		err = s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(DISTINCT role) FROM rbac_role_permissions WHERE permission_key=$1
		`, permissionKey).Scan(&n)
	} else {
		err = s.db.Pool.QueryRow(ctx, `
			SELECT COUNT(DISTINCT role) FROM rbac_role_permissions
			WHERE permission_key=$1 AND role <> $2
		`, permissionKey, excludeRole).Scan(&n)
	}
	return n, err
}

func (s *RBACStore) IsProtectedPermission(key string, protected []string) bool {
	key = strings.TrimSpace(key)
	for _, p := range protected {
		if strings.TrimSpace(p) == key {
			return true
		}
	}
	return false
}

func (s *RBACStore) DeleteRoleGrants(ctx context.Context, role string) error {
	role = strings.TrimSpace(role)
	if role == "" {
		return fmt.Errorf("role required")
	}
	if s.db == nil || !s.db.Ready() {
		return fmt.Errorf("service temporarily unavailable")
	}
	_, err := s.db.Pool.Exec(ctx, `DELETE FROM rbac_role_permissions WHERE role=$1`, role)
	return err
}
