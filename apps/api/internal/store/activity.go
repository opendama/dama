package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"dama/apps/api/internal/db"
)

// Activity period kinds (must match platform_settings.activity_analytics.periods).
const (
	ActivityPeriodDay   = "day"
	ActivityPeriodWeek  = "week"
	ActivityPeriodMonth = "month"
	ActivityPeriodYear  = "year"
)

type ActivityAnalyticsConfig struct {
	Periods          []string       `json:"periods"`
	DefaultPeriod    string         `json:"default_period"`
	SeriesMaxBuckets int            `json:"series_max_buckets"`
	PeriodWindowDays map[string]int `json:"period_window_days"`
	DAUDays          int            `json:"dau_days"`
	WAUDays          int            `json:"wau_days"`
	MAUDays          int            `json:"mau_days"`
}

type ActivityStore struct {
	db *db.Handle
}

func NewActivityStore(handle *db.Handle) *ActivityStore {
	return &ActivityStore{db: handle}
}

func (s *ActivityStore) requireDB() error {
	if s == nil || s.db == nil || s.db.Pool == nil {
		return fmt.Errorf("database unavailable")
	}
	return nil
}

func (s *ActivityStore) LoadConfig(ctx context.Context) (ActivityAnalyticsConfig, error) {
	var cfg ActivityAnalyticsConfig
	if err := s.requireDB(); err != nil {
		return cfg, err
	}
	var raw []byte
	err := s.db.Pool.QueryRow(ctx, `
		SELECT value FROM platform_settings WHERE key = 'activity_analytics'
	`).Scan(&raw)
	if err != nil || len(raw) == 0 {
		return cfg, fmt.Errorf("activity_analytics settings unavailable")
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return cfg, fmt.Errorf("activity_analytics settings invalid")
	}
	cfg.DefaultPeriod = strings.TrimSpace(strings.ToLower(cfg.DefaultPeriod))
	out := make([]string, 0, len(cfg.Periods))
	seen := map[string]bool{}
	for _, p := range cfg.Periods {
		p = strings.TrimSpace(strings.ToLower(p))
		if p == "" || seen[p] {
			continue
		}
		switch p {
		case ActivityPeriodDay, ActivityPeriodWeek, ActivityPeriodMonth, ActivityPeriodYear:
			seen[p] = true
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return cfg, fmt.Errorf("activity_analytics periods empty")
	}
	cfg.Periods = out
	if !seen[cfg.DefaultPeriod] {
		return cfg, fmt.Errorf("activity_analytics default_period invalid")
	}
	if cfg.SeriesMaxBuckets <= 0 {
		return cfg, fmt.Errorf("activity_analytics series_max_buckets invalid")
	}
	if cfg.PeriodWindowDays == nil {
		return cfg, fmt.Errorf("activity_analytics period_window_days missing")
	}
	maxWindow := 0
	for _, p := range out {
		days, ok := cfg.PeriodWindowDays[p]
		if !ok || days <= 0 {
			return cfg, fmt.Errorf("activity_analytics period_window_days.%s invalid", p)
		}
		if days > maxWindow {
			maxWindow = days
		}
	}
	// Fail closed: buckets must cover the widest period window (else year truncates silently).
	if cfg.SeriesMaxBuckets < maxWindow {
		return cfg, fmt.Errorf("activity_analytics series_max_buckets below max period_window_days")
	}
	if cfg.DAUDays <= 0 || cfg.WAUDays <= 0 || cfg.MAUDays <= 0 {
		return cfg, fmt.Errorf("activity_analytics engagement day spans invalid")
	}
	return cfg, nil
}

func (s *ActivityStore) ResolvePeriod(period string, cfg ActivityAnalyticsConfig, now time.Time) (kind string, start, end time.Time, err error) {
	kind = strings.TrimSpace(strings.ToLower(period))
	if kind == "" {
		kind = cfg.DefaultPeriod
	}
	allowed := false
	for _, p := range cfg.Periods {
		if p == kind {
			allowed = true
			break
		}
	}
	if !allowed {
		return "", time.Time{}, time.Time{}, fmt.Errorf("invalid period")
	}
	days, ok := cfg.PeriodWindowDays[kind]
	if !ok || days <= 0 {
		return "", time.Time{}, time.Time{}, fmt.Errorf("invalid period window")
	}
	now = now.UTC()
	end = now
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	// Inclusive window of N calendar days ending today ⇒ start = today - (N-1).
	start = dayStart.AddDate(0, 0, -(days - 1))
	return kind, start, end, nil
}

// RecordUserVisit upserts today's authenticated visit row (UTC day).
func (s *ActivityStore) RecordUserVisit(ctx context.Context, userID string) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return fmt.Errorf("user required")
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO user_activity_days (user_id, activity_date, visit_count, first_seen_at, last_seen_at)
		VALUES ($1::uuid, (NOW() AT TIME ZONE 'UTC')::date, 1, NOW(), NOW())
		ON CONFLICT (user_id, activity_date) DO UPDATE
		SET visit_count = user_activity_days.visit_count + 1,
		    last_seen_at = NOW()
	`, userID)
	return err
}

// RecordAnonVisit upserts today's anonymous visitor row.
func (s *ActivityStore) RecordAnonVisit(ctx context.Context, visitorKey string) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	visitorKey = strings.TrimSpace(visitorKey)
	if len(visitorKey) < 8 || len(visitorKey) > 128 {
		return fmt.Errorf("visitor_key invalid")
	}
	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO platform_visit_days (visitor_key, activity_date, hit_count, first_seen_at, last_seen_at)
		VALUES ($1, (NOW() AT TIME ZONE 'UTC')::date, 1, NOW(), NOW())
		ON CONFLICT (visitor_key, activity_date) DO UPDATE
		SET hit_count = platform_visit_days.hit_count + 1,
		    last_seen_at = NOW()
	`, visitorKey)
	return err
}

type ActivitySeriesPoint struct {
	Bucket string `json:"bucket"`
	// Values keyed by series_meta.key (visited|played|games|new_users) - clients must not invent keys.
	Values map[string]int `json:"values"`
}

// ActivityPeriodOption is a DB chrome-labeled period filter (Trim range_options parity).
type ActivityPeriodOption struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// ActivityKpiItem is a labeled metric tile (Trim kpi_items parity).
type ActivityKpiItem struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Value int64  `json:"value"`
}

// ActivityKpiSection groups KPI tiles under a chrome section title.
type ActivityKpiSection struct {
	ID    string            `json:"id"`
	Title string            `json:"title"`
	Items []ActivityKpiItem `json:"items"`
}

// ActivitySeriesMeta labels + color class for one series line (DB chrome only).
type ActivitySeriesMeta struct {
	Key        string `json:"key"`
	Label      string `json:"label"`
	ColorClass string `json:"color_class"`
}

type ActivitySnapshot struct {
	Period        string `json:"period"`
	PeriodStart   string `json:"period_start"`
	PeriodEnd     string `json:"period_end"`
	DefaultPeriod string `json:"default_period"`
	OnlineNow     int64  `json:"online_now"`
	PlayingNow    int64  `json:"playing_now"`
	UsersTotal    int64  `json:"users_total"`
	NewUsers      int64  `json:"new_users"`
	Visited       int64  `json:"visited"`
	Played        int64  `json:"played"`
	GamesDone     int64  `json:"games_finished"`
	DAU           int64  `json:"dau"`
	WAU           int64  `json:"wau"`
	MAU           int64  `json:"mau"`
	// Series + SeriesMeta filled for admin /activity and public Status (Trim Usage parity).
	Series           []ActivitySeriesPoint  `json:"series,omitempty"`
	Periods          []string               `json:"periods"`
	PeriodOptions    []ActivityPeriodOption `json:"period_options"`
	KpiSections      []ActivityKpiSection   `json:"kpi_sections"`
	SeriesMeta       []ActivitySeriesMeta   `json:"series_meta,omitempty"`
	SeriesTitle      string                 `json:"series_title,omitempty"`
	SeriesSubtitle   string                 `json:"series_subtitle,omitempty"`
	SeriesYAxis      string                 `json:"series_y_axis,omitempty"`
	SeriesEmpty      string                 `json:"series_empty,omitempty"`
	SeriesLegendAria string                 `json:"series_legend_aria,omitempty"`
	SeriesTodayLabel string                 `json:"series_today_label,omitempty"`
	TodayDay         string                 `json:"today_day,omitempty"`

	// Trim dashboard section parity (heatmap / cumulative / breakdowns) - DB chrome labels.
	HeatmapTitle             string                `json:"heatmap_title,omitempty"`
	HeatmapEmpty             string                `json:"heatmap_empty,omitempty"`
	HeatmapTotalLabel        string                `json:"heatmap_total_label,omitempty"`
	HeatmapStatLongestStreak string                `json:"heatmap_stat_longest_streak,omitempty"`
	HeatmapStatCurrentStreak string                `json:"heatmap_stat_current_streak,omitempty"`
	HeatmapStatPeakDay       string                `json:"heatmap_stat_peak_day,omitempty"`
	HeatmapStatPeakMonth     string                `json:"heatmap_stat_peak_month,omitempty"`
	HeatmapStreakUnit        string                `json:"heatmap_streak_unit,omitempty"`
	HeatmapStats             []ActivityHeatmapStat `json:"heatmap_stats,omitempty"`

	CumulativeTitle       string `json:"cumulative_title,omitempty"`
	CumulativeEmpty       string `json:"cumulative_empty,omitempty"`
	CumulativeSeriesLabel string `json:"cumulative_series_label,omitempty"`

	BreakdownModesTitle string `json:"breakdown_modes_title,omitempty"`
	BreakdownModesEmpty string `json:"breakdown_modes_empty,omitempty"`
	// Always emit arrays (even empty) so day/week clients never see a missing key.
	BreakdownModes         []ActivityNamedCount `json:"breakdown_modes"`
	BreakdownOutcomesTitle string               `json:"breakdown_outcomes_title,omitempty"`
	BreakdownOutcomesEmpty string               `json:"breakdown_outcomes_empty,omitempty"`
	BreakdownOutcomesMeta  string               `json:"breakdown_outcomes_meta,omitempty"`
	BreakdownOutcomes      []ActivityNamedCount `json:"breakdown_outcomes"`
	BreakdownEntryTitle    string               `json:"breakdown_entry_title,omitempty"`
	BreakdownEntryEmpty    string               `json:"breakdown_entry_empty,omitempty"`
	BreakdownEntry         []ActivityNamedCount `json:"breakdown_entry"`
}

// ActivityNamedCount is a labeled breakdown slice (Trim model/status/mode rows).
type ActivityNamedCount struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Count int64  `json:"count"`
}

// ActivityHeatmapStat is a streak/peak tile under the activity calendar (Trim loc_heatmap_stats).
type ActivityHeatmapStat struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Value string `json:"value"`
}

func (s *ActivityStore) CountUsersTotal(ctx context.Context) (int64, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	var n int64
	err := s.db.Pool.QueryRow(ctx, `SELECT COUNT(*)::bigint FROM users`).Scan(&n)
	return n, err
}

func (s *ActivityStore) CountNewUsers(ctx context.Context, start, end time.Time) (int64, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	var n int64
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::bigint FROM users
		WHERE created_at >= $1 AND created_at < $2
	`, start, end).Scan(&n)
	return n, err
}

func (s *ActivityStore) CountVisitedUsers(ctx context.Context, start, end time.Time) (int64, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	startDay := start.UTC().Format("2006-01-02")
	endDay := end.UTC().Format("2006-01-02")
	var n int64
	// Same DISTINCT-across-union semantics as series visited (no double-count invent).
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT actor)::bigint FROM (
			SELECT user_id::text AS actor FROM user_activity_days
			WHERE activity_date >= $1::date AND activity_date <= $2::date
			UNION
			SELECT visitor_key AS actor FROM platform_visit_days
			WHERE activity_date >= $1::date AND activity_date <= $2::date
		) v
	`, startDay, endDay).Scan(&n)
	return n, err
}

func (s *ActivityStore) CountPlayedUsers(ctx context.Context, start, end time.Time) (int64, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	var n int64
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT uid)::bigint FROM (
			SELECT player1_id AS uid FROM match_history
			WHERE finished_at >= $1 AND finished_at < $2 AND player1_id IS NOT NULL
			UNION
			SELECT player2_id AS uid FROM match_history
			WHERE finished_at >= $1 AND finished_at < $2 AND player2_id IS NOT NULL
		) t
	`, start, end).Scan(&n)
	return n, err
}

func (s *ActivityStore) CountGamesFinished(ctx context.Context, start, end time.Time) (int64, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	var n int64
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::bigint FROM match_history
		WHERE finished_at >= $1 AND finished_at < $2
	`, start, end).Scan(&n)
	return n, err
}

// CountDistinctActiveInDays = authenticated visit users + anonymous visitors in last N UTC days.
func (s *ActivityStore) CountDistinctActiveInDays(ctx context.Context, days int) (int64, error) {
	if err := s.requireDB(); err != nil {
		return 0, err
	}
	if days <= 0 {
		return 0, fmt.Errorf("days required")
	}
	var n int64
	err := s.db.Pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT actor)::bigint FROM (
			SELECT user_id::text AS actor FROM user_activity_days
			WHERE activity_date >= ((NOW() AT TIME ZONE 'UTC')::date - ($1::int - 1))
			UNION
			SELECT visitor_key AS actor FROM platform_visit_days
			WHERE activity_date >= ((NOW() AT TIME ZONE 'UTC')::date - ($1::int - 1))
		) v
	`, days).Scan(&n)
	return n, err
}

func (s *ActivityStore) Series(ctx context.Context, start, end time.Time, maxBuckets int) ([]ActivitySeriesPoint, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	if maxBuckets <= 0 {
		return nil, fmt.Errorf("series_max_buckets required")
	}
	startDay := start.UTC().Truncate(24 * time.Hour)
	endDay := time.Date(end.UTC().Year(), end.UTC().Month(), end.UTC().Day(), 0, 0, 0, 0, time.UTC)

	type dayAgg struct {
		visited  int
		played   int
		games    int
		newUsers int
	}
	byDay := map[string]*dayAgg{}

	scanDay := func(rows interface {
		Next() bool
		Scan(dest ...any) error
		Err() error
		Close()
	}, apply func(a *dayAgg, n int)) error {
		defer rows.Close()
		for rows.Next() {
			var day string
			var n int
			if err := rows.Scan(&day, &n); err != nil {
				return err
			}
			a := byDay[day]
			if a == nil {
				a = &dayAgg{}
				byDay[day] = a
			}
			apply(a, n)
		}
		return rows.Err()
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT activity_date::text, COUNT(DISTINCT actor)::int FROM (
			SELECT activity_date, user_id::text AS actor FROM user_activity_days
			WHERE activity_date >= $1::date AND activity_date <= $2::date
			UNION ALL
			SELECT activity_date, visitor_key AS actor FROM platform_visit_days
			WHERE activity_date >= $1::date AND activity_date <= $2::date
		) v
		GROUP BY activity_date
	`, startDay.Format("2006-01-02"), endDay.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	if err := scanDay(rows, func(a *dayAgg, n int) { a.visited = n }); err != nil {
		return nil, err
	}

	rows, err = s.db.Pool.Query(ctx, `
		SELECT (finished_at AT TIME ZONE 'UTC')::date::text, COUNT(*)::int
		FROM match_history
		WHERE finished_at >= $1 AND finished_at < $2
		GROUP BY 1
	`, start, end)
	if err != nil {
		return nil, err
	}
	if err := scanDay(rows, func(a *dayAgg, n int) { a.games = n }); err != nil {
		return nil, err
	}

	rows, err = s.db.Pool.Query(ctx, `
		SELECT d::text, COUNT(DISTINCT uid)::int FROM (
			SELECT (finished_at AT TIME ZONE 'UTC')::date AS d, player1_id AS uid
			FROM match_history
			WHERE finished_at >= $1 AND finished_at < $2 AND player1_id IS NOT NULL
			UNION ALL
			SELECT (finished_at AT TIME ZONE 'UTC')::date AS d, player2_id AS uid
			FROM match_history
			WHERE finished_at >= $1 AND finished_at < $2 AND player2_id IS NOT NULL
		) t
		GROUP BY d
	`, start, end)
	if err != nil {
		return nil, err
	}
	if err := scanDay(rows, func(a *dayAgg, n int) { a.played = n }); err != nil {
		return nil, err
	}

	rows, err = s.db.Pool.Query(ctx, `
		SELECT (created_at AT TIME ZONE 'UTC')::date::text, COUNT(*)::int
		FROM users
		WHERE created_at >= $1 AND created_at < $2
		GROUP BY 1
	`, start, end)
	if err != nil {
		return nil, err
	}
	if err := scanDay(rows, func(a *dayAgg, n int) { a.newUsers = n }); err != nil {
		return nil, err
	}

	// Most-recent maxBuckets days ending at endDay (year must not truncate to oldest N).
	dayKeys := make([]string, 0, maxBuckets)
	for d := endDay; !d.Before(startDay); d = d.AddDate(0, 0, -1) {
		dayKeys = append(dayKeys, d.Format("2006-01-02"))
		if len(dayKeys) >= maxBuckets {
			break
		}
	}
	for i, j := 0, len(dayKeys)-1; i < j; i, j = i+1, j-1 {
		dayKeys[i], dayKeys[j] = dayKeys[j], dayKeys[i]
	}

	out := make([]ActivitySeriesPoint, 0, len(dayKeys))
	for _, key := range dayKeys {
		a := byDay[key]
		vals := map[string]int{
			"visited":   0,
			"played":    0,
			"games":     0,
			"new_users": 0,
		}
		if a != nil {
			vals["visited"] = a.visited
			vals["played"] = a.played
			vals["games"] = a.games
			vals["new_users"] = a.newUsers
		}
		out = append(out, ActivitySeriesPoint{Bucket: key, Values: vals})
	}
	return out, nil
}

// BreakdownByMode counts finished matches grouped by mode in [start, end).
func (s *ActivityStore) BreakdownByMode(ctx context.Context, start, end time.Time) ([]ActivityNamedCount, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	rows, err := s.db.Pool.Query(ctx, `
		SELECT COALESCE(NULLIF(TRIM(mode), ''), 'unknown') AS mode, COUNT(*)::bigint
		FROM match_history
		WHERE finished_at >= $1 AND finished_at < $2
		GROUP BY 1
		ORDER BY 2 DESC, 1 ASC
	`, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]ActivityNamedCount, 0, 8)
	for rows.Next() {
		var id string
		var n int64
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		out = append(out, ActivityNamedCount{ID: id, Label: id, Count: n})
	}
	return out, rows.Err()
}

// BreakdownOutcomes counts draw vs decisive finished matches in [start, end).
func (s *ActivityStore) BreakdownOutcomes(ctx context.Context, start, end time.Time) (decisive, draw int64, err error) {
	if err := s.requireDB(); err != nil {
		return 0, 0, err
	}
	err = s.db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE is_draw IS TRUE)::bigint,
			COUNT(*) FILTER (WHERE is_draw IS NOT TRUE)::bigint
		FROM match_history
		WHERE finished_at >= $1 AND finished_at < $2
	`, start, end).Scan(&draw, &decisive)
	return decisive, draw, err
}

// BreakdownByEntry counts free vs paid finished matches in [start, end).
func (s *ActivityStore) BreakdownByEntry(ctx context.Context, start, end time.Time) (free, paid int64, err error) {
	if err := s.requireDB(); err != nil {
		return 0, 0, err
	}
	err = s.db.Pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE is_free IS TRUE)::bigint,
			COUNT(*) FILTER (WHERE is_free IS NOT TRUE)::bigint
		FROM match_history
		WHERE finished_at >= $1 AND finished_at < $2
	`, start, end).Scan(&free, &paid)
	return free, paid, err
}
