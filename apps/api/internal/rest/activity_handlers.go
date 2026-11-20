package rest

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/presence"
	"dama/apps/api/internal/store"
)

type ActivityAPI struct {
	Activity *store.ActivityStore
	Presence *presence.Service
	Games    *gamestore.Store
	Settings *store.SettingsStore
}

func chromeString(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return strings.TrimSpace(v)
}

func periodLabelFromChrome(m map[string]any, period string) string {
	switch period {
	case store.ActivityPeriodDay:
		return chromeString(m, "period_day_label")
	case store.ActivityPeriodWeek:
		return chromeString(m, "period_week_label")
	case store.ActivityPeriodMonth:
		return chromeString(m, "period_month_label")
	case store.ActivityPeriodYear:
		return chromeString(m, "period_year_label")
	default:
		return ""
	}
}

func (a *ActivityAPI) loadChromeMap(r *http.Request, admin bool) (map[string]any, error) {
	if a.Settings == nil {
		return nil, errActivityChrome
	}
	var raw []byte
	var err error
	if admin {
		raw, err = a.Settings.AdminConsoleChromeJSON(r.Context())
		if err != nil {
			return nil, err
		}
		var root map[string]any
		if err := json.Unmarshal(raw, &root); err != nil {
			return nil, err
		}
		sec, _ := root["activity"].(map[string]any)
		if sec == nil {
			return nil, errActivityChrome
		}
		return sec, nil
	}
	raw, err = a.Settings.PlatformStatsChromeJSON(r.Context())
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return m, nil
}

var errActivityChrome = errString("activity chrome unavailable")

type errString string

func (e errString) Error() string { return string(e) }

func (a *ActivityAPI) enrichLabeled(snap *store.ActivitySnapshot, chrome map[string]any, admin bool) error {
	opts := make([]store.ActivityPeriodOption, 0, len(snap.Periods))
	for _, p := range snap.Periods {
		label := periodLabelFromChrome(chrome, p)
		if label == "" {
			return errActivityChrome
		}
		opts = append(opts, store.ActivityPeriodOption{ID: p, Label: label})
	}
	if len(opts) == 0 {
		return errActivityChrome
	}
	snap.PeriodOptions = opts

	kpi := func(id, labelKey string, value int64) (store.ActivityKpiItem, bool) {
		label := chromeString(chrome, labelKey)
		if label == "" {
			return store.ActivityKpiItem{}, false
		}
		return store.ActivityKpiItem{ID: id, Label: label, Value: value}, true
	}

	if admin {
		liveTitle := chromeString(chrome, "live_section_title")
		periodTitle := chromeString(chrome, "period_section_title")
		engTitle := chromeString(chrome, "engagement_section_title")
		if liveTitle == "" || periodTitle == "" || engTitle == "" {
			return errActivityChrome
		}
		online, ok1 := kpi("online_now", "kpi_online_now", snap.OnlineNow)
		playing, ok2 := kpi("playing_now", "kpi_playing_now", snap.PlayingNow)
		users, ok3 := kpi("users_total", "kpi_users_total", snap.UsersTotal)
		visited, ok4 := kpi("visited", "kpi_visited", snap.Visited)
		played, ok5 := kpi("played", "kpi_played", snap.Played)
		games, ok6 := kpi("games_finished", "kpi_games_finished", snap.GamesDone)
		newU, ok7 := kpi("new_users", "kpi_new_users", snap.NewUsers)
		dau, ok8 := kpi("dau", "kpi_dau", snap.DAU)
		wau, ok9 := kpi("wau", "kpi_wau", snap.WAU)
		mau, ok10 := kpi("mau", "kpi_mau", snap.MAU)
		if !ok1 || !ok2 || !ok3 || !ok4 || !ok5 || !ok6 || !ok7 || !ok8 || !ok9 || !ok10 {
			return errActivityChrome
		}
		snap.KpiSections = []store.ActivityKpiSection{
			{ID: "live", Title: liveTitle, Items: []store.ActivityKpiItem{online, playing, users}},
			{ID: "period", Title: periodTitle, Items: []store.ActivityKpiItem{visited, played, games, newU}},
			{ID: "engagement", Title: engTitle, Items: []store.ActivityKpiItem{dau, wau, mau}},
		}

		if err := enrichSeriesChrome(snap, chrome, true); err != nil {
			return err
		}
		return nil
	}

	// Public Status page: community KPIs + Trim-style stacked activity series.
	sectionTitle := chromeString(chrome, "section_title")
	if sectionTitle == "" {
		return errActivityChrome
	}
	online, ok1 := kpi("online_now", "kpi_online_now", snap.OnlineNow)
	playing, ok2 := kpi("playing_now", "kpi_playing_now", snap.PlayingNow)
	users, ok3 := kpi("users_total", "kpi_users_total", snap.UsersTotal)
	visited, ok4 := kpi("visited", "kpi_visited", snap.Visited)
	played, ok5 := kpi("played", "kpi_played", snap.Played)
	games, ok6 := kpi("games_finished", "kpi_games_finished", snap.GamesDone)
	dau, ok7 := kpi("dau", "kpi_dau", snap.DAU)
	wau, ok8 := kpi("wau", "kpi_wau", snap.WAU)
	mau, ok9 := kpi("mau", "kpi_mau", snap.MAU)
	if !ok1 || !ok2 || !ok3 || !ok4 || !ok5 || !ok6 || !ok7 || !ok8 || !ok9 {
		return errActivityChrome
	}
	snap.KpiSections = []store.ActivityKpiSection{
		{ID: "community", Title: sectionTitle, Items: []store.ActivityKpiItem{
			online, playing, users, visited, played, games, dau, wau, mau,
		}},
	}
	if err := enrichSeriesChrome(snap, chrome, false); err != nil {
		return err
	}
	return nil
}

// enrichSeriesChrome fills Trim Usage-parity chart chrome + series_meta (fail closed).
// includeNewUsers: admin chart includes new_users series; public Status does not.
func enrichSeriesChrome(snap *store.ActivitySnapshot, chrome map[string]any, includeNewUsers bool) error {
	seriesTitle := chromeString(chrome, "series_title")
	seriesSubtitle := chromeString(chrome, "series_subtitle")
	seriesYAxis := chromeString(chrome, "series_y_axis")
	seriesEmpty := chromeString(chrome, "series_empty")
	seriesLegendAria := chromeString(chrome, "series_legend_aria")
	seriesToday := chromeString(chrome, "series_today_label")
	if seriesTitle == "" || seriesSubtitle == "" || seriesYAxis == "" || seriesEmpty == "" || seriesLegendAria == "" || seriesToday == "" {
		return errActivityChrome
	}
	snap.SeriesTitle = seriesTitle
	snap.SeriesSubtitle = seriesSubtitle
	snap.SeriesYAxis = seriesYAxis
	snap.SeriesEmpty = seriesEmpty
	snap.SeriesLegendAria = seriesLegendAria
	snap.SeriesTodayLabel = seriesToday

	metaKeys := []struct {
		key, labelKey, colorKey string
	}{
		{"visited", "series_visited_label", "series_visited_color"},
		{"played", "series_played_label", "series_played_color"},
		{"games", "series_games_label", "series_games_color"},
	}
	if includeNewUsers {
		metaKeys = append(metaKeys, struct {
			key, labelKey, colorKey string
		}{"new_users", "series_new_users_label", "series_new_users_color"})
	}
	meta := make([]store.ActivitySeriesMeta, 0, len(metaKeys))
	for _, mk := range metaKeys {
		label := chromeString(chrome, mk.labelKey)
		color := chromeString(chrome, mk.colorKey)
		if label == "" || color == "" {
			return errActivityChrome
		}
		meta = append(meta, store.ActivitySeriesMeta{Key: mk.key, Label: label, ColorClass: color})
	}
	snap.SeriesMeta = meta
	return nil
}

// enrichDashboardSections fills Trim heatmap/cumulative/breakdown chrome + labeled rows (fail closed).
func enrichDashboardSections(
	snap *store.ActivitySnapshot,
	chrome map[string]any,
	modes []store.ActivityNamedCount,
	decisive, draw, free, paid int64,
) error {
	keys := []string{
		"heatmap_title", "heatmap_empty", "heatmap_total_label",
		"heatmap_stat_longest_streak", "heatmap_stat_current_streak",
		"heatmap_stat_peak_day", "heatmap_stat_peak_month", "heatmap_streak_unit",
		"cumulative_title", "cumulative_empty", "cumulative_series_label",
		"breakdown_modes_title", "breakdown_modes_empty",
		"breakdown_outcomes_title", "breakdown_outcomes_empty", "breakdown_outcomes_meta_fmt",
		"outcome_decisive_label", "outcome_draw_label",
		"breakdown_entry_title", "breakdown_entry_empty",
		"entry_free_label", "entry_paid_label",
	}
	vals := make(map[string]string, len(keys))
	for _, k := range keys {
		v := chromeString(chrome, k)
		if v == "" {
			return errActivityChrome
		}
		vals[k] = v
	}

	snap.HeatmapTitle = vals["heatmap_title"]
	snap.HeatmapEmpty = vals["heatmap_empty"]
	snap.HeatmapTotalLabel = vals["heatmap_total_label"]
	snap.HeatmapStatLongestStreak = vals["heatmap_stat_longest_streak"]
	snap.HeatmapStatCurrentStreak = vals["heatmap_stat_current_streak"]
	snap.HeatmapStatPeakDay = vals["heatmap_stat_peak_day"]
	snap.HeatmapStatPeakMonth = vals["heatmap_stat_peak_month"]
	snap.HeatmapStreakUnit = vals["heatmap_streak_unit"]
	snap.HeatmapStats = computeHeatmapStats(snap.Series, vals)

	snap.CumulativeTitle = vals["cumulative_title"]
	snap.CumulativeEmpty = vals["cumulative_empty"]
	snap.CumulativeSeriesLabel = vals["cumulative_series_label"]

	snap.BreakdownModesTitle = vals["breakdown_modes_title"]
	snap.BreakdownModesEmpty = vals["breakdown_modes_empty"]
	if modes == nil {
		modes = []store.ActivityNamedCount{}
	}
	snap.BreakdownModes = modes

	snap.BreakdownOutcomesTitle = vals["breakdown_outcomes_title"]
	snap.BreakdownOutcomesEmpty = vals["breakdown_outcomes_empty"]
	totalMatches := decisive + draw
	pct := 0.0
	if totalMatches > 0 {
		pct = float64(decisive) * 100.0 / float64(totalMatches)
	}
	meta := vals["breakdown_outcomes_meta_fmt"]
	meta = strings.ReplaceAll(meta, "{pct}", strconv.FormatFloat(pct, 'f', 1, 64))
	meta = strings.ReplaceAll(meta, "{n}", strconv.FormatInt(totalMatches, 10))
	snap.BreakdownOutcomesMeta = meta
	snap.BreakdownOutcomes = []store.ActivityNamedCount{
		{ID: "decisive", Label: vals["outcome_decisive_label"], Count: decisive},
		{ID: "draw", Label: vals["outcome_draw_label"], Count: draw},
	}

	snap.BreakdownEntryTitle = vals["breakdown_entry_title"]
	snap.BreakdownEntryEmpty = vals["breakdown_entry_empty"]
	snap.BreakdownEntry = []store.ActivityNamedCount{
		{ID: "free", Label: vals["entry_free_label"], Count: free},
		{ID: "paid", Label: vals["entry_paid_label"], Count: paid},
	}
	return nil
}

func computeHeatmapStats(series []store.ActivitySeriesPoint, labels map[string]string) []store.ActivityHeatmapStat {
	unit := labels["heatmap_streak_unit"]
	active := make([]bool, len(series))
	var peakDay string
	var peakVal int
	monthTotals := map[string]int{}
	for i, pt := range series {
		v := 0
		if pt.Values != nil {
			v = pt.Values["visited"]
			if p := pt.Values["played"]; p > v {
				v = p
			}
			if g := pt.Values["games"]; g > v {
				v = g
			}
		}
		active[i] = v > 0
		if v > peakVal {
			peakVal = v
			peakDay = pt.Bucket
		}
		if len(pt.Bucket) >= 7 {
			ym := pt.Bucket[:7]
			monthTotals[ym] += v
		}
	}
	longest, current := 0, 0
	run := 0
	for _, a := range active {
		if a {
			run++
			if run > longest {
				longest = run
			}
		} else {
			run = 0
		}
	}
	for i := len(active) - 1; i >= 0; i-- {
		if !active[i] {
			break
		}
		current++
	}
	peakMonth := ""
	peakMonthVal := 0
	for ym, tot := range monthTotals {
		if tot > peakMonthVal || (tot == peakMonthVal && (peakMonth == "" || ym < peakMonth)) {
			peakMonthVal = tot
			peakMonth = ym
		}
	}
	return []store.ActivityHeatmapStat{
		{ID: "longest_streak", Label: labels["heatmap_stat_longest_streak"], Value: strconv.Itoa(longest) + unit},
		{ID: "current_streak", Label: labels["heatmap_stat_current_streak"], Value: strconv.Itoa(current) + unit},
		{ID: "peak_day", Label: labels["heatmap_stat_peak_day"], Value: peakDay},
		{ID: "peak_month", Label: labels["heatmap_stat_peak_month"], Value: peakMonth},
	}
}

func (a *ActivityAPI) buildSnapshot(r *http.Request, periodQ string, admin bool) (store.ActivitySnapshot, int, string) {
	empty := store.ActivitySnapshot{}
	if a.Activity == nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	cfg, err := a.Activity.LoadConfig(r.Context())
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	kind, start, end, err := a.Activity.ResolvePeriod(periodQ, cfg, time.Now().UTC())
	if err != nil {
		return empty, http.StatusBadRequest, "invalid period"
	}
	now := time.Now().UTC()
	windowEnd := now
	if !windowEnd.After(start) {
		windowEnd = start.Add(24 * time.Hour)
	}

	snap := store.ActivitySnapshot{
		Period:        kind,
		PeriodStart:   start.Format(time.RFC3339),
		PeriodEnd:     now.Format(time.RFC3339),
		DefaultPeriod: cfg.DefaultPeriod,
		Periods:       cfg.Periods,
		PeriodOptions: []store.ActivityPeriodOption{},
		KpiSections:   []store.ActivityKpiSection{},
	}

	if a.Presence == nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	online, err := a.Presence.CountOnline(r.Context())
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.OnlineNow = online

	if a.Games == nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	playing, err := a.Games.CountPlaying(r.Context())
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.PlayingNow = playing

	n, err := a.Activity.CountUsersTotal(r.Context())
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.UsersTotal = n

	n, err = a.Activity.CountNewUsers(r.Context(), start, windowEnd)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.NewUsers = n

	n, err = a.Activity.CountVisitedUsers(r.Context(), start, windowEnd)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.Visited = n

	n, err = a.Activity.CountPlayedUsers(r.Context(), start, windowEnd)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.Played = n

	n, err = a.Activity.CountGamesFinished(r.Context(), start, windowEnd)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.GamesDone = n

	n, err = a.Activity.CountDistinctActiveInDays(r.Context(), cfg.DAUDays)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.DAU = n

	n, err = a.Activity.CountDistinctActiveInDays(r.Context(), cfg.WAUDays)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.WAU = n

	n, err = a.Activity.CountDistinctActiveInDays(r.Context(), cfg.MAUDays)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.MAU = n

	series, err := a.Activity.Series(r.Context(), start, windowEnd, cfg.SeriesMaxBuckets)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	snap.Series = series
	snap.TodayDay = now.Format("2006-01-02")

	modes, err := a.Activity.BreakdownByMode(r.Context(), start, windowEnd)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	decisive, draw, err := a.Activity.BreakdownOutcomes(r.Context(), start, windowEnd)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	free, paid, err := a.Activity.BreakdownByEntry(r.Context(), start, windowEnd)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}

	chrome, err := a.loadChromeMap(r, admin)
	if err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	if err := a.enrichLabeled(&snap, chrome, admin); err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	if err := enrichDashboardSections(&snap, chrome, modes, decisive, draw, free, paid); err != nil {
		return empty, http.StatusServiceUnavailable, "activity unavailable"
	}
	_ = end
	return snap, http.StatusOK, ""
}

// ConsoleActivity GET /console/activity?period=
func (a *ActivityAPI) ConsoleActivity(w http.ResponseWriter, r *http.Request) {
	snap, status, errMsg := a.buildSnapshot(r, r.URL.Query().Get("period"), true)
	if status != http.StatusOK {
		writeClientError(w, status, errMsg)
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

// PublicPlatformStats GET /public/platform-stats?period=
func (a *ActivityAPI) PublicPlatformStats(w http.ResponseWriter, r *http.Request) {
	snap, status, errMsg := a.buildSnapshot(r, r.URL.Query().Get("period"), false)
	if status != http.StatusOK {
		writeClientError(w, status, errMsg)
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

type anonVisitBody struct {
	VisitorKey string `json:"visitor_key"`
}

// PublicPlatformVisit POST /public/platform-stats/visit
func (a *ActivityAPI) PublicPlatformVisit(w http.ResponseWriter, r *http.Request) {
	if a.Activity == nil {
		writeClientError(w, http.StatusServiceUnavailable, "activity unavailable")
		return
	}
	var body anonVisitBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeClientError(w, http.StatusBadRequest, "visitor_key invalid")
		return
	}
	key := strings.TrimSpace(body.VisitorKey)
	if err := a.Activity.RecordAnonVisit(r.Context(), key); err != nil {
		writeClientError(w, http.StatusBadRequest, "visitor_key invalid")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// RecordAuthVisit is called from heartbeat (best-effort; never invents rows on failure).
func (a *ActivityAPI) RecordAuthVisit(r *http.Request, userID string) {
	if a == nil || a.Activity == nil {
		return
	}
	_ = a.Activity.RecordUserVisit(r.Context(), userID)
}
