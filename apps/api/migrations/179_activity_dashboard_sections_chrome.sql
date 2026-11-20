-- Trim dashboard section chrome for Status/Activity (heatmap / cumulative / breakdowns).
-- Domain: visits heatmap+streaks, cumulative games, match mode / outcome / free-vs-paid.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{activity}',
  (value->'activity')
    || CASE WHEN COALESCE(value->'activity'->>'heatmap_title', '') = ''
        THEN jsonb_build_object('heatmap_title', 'Activity calendar') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'heatmap_empty', '') = ''
        THEN jsonb_build_object('heatmap_empty', 'No activity days in this period') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'heatmap_total_label', '') = ''
        THEN jsonb_build_object('heatmap_total_label', 'Active days') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'heatmap_stat_longest_streak', '') = ''
        THEN jsonb_build_object('heatmap_stat_longest_streak', 'Longest streak') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'heatmap_stat_current_streak', '') = ''
        THEN jsonb_build_object('heatmap_stat_current_streak', 'Current streak') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'heatmap_stat_peak_day', '') = ''
        THEN jsonb_build_object('heatmap_stat_peak_day', 'Most active day') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'heatmap_stat_peak_month', '') = ''
        THEN jsonb_build_object('heatmap_stat_peak_month', 'Most active month') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'heatmap_streak_unit', '') = ''
        THEN jsonb_build_object('heatmap_streak_unit', 'd') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'cumulative_title', '') = ''
        THEN jsonb_build_object('cumulative_title', 'Games finished (cumulative)') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'cumulative_empty', '') = ''
        THEN jsonb_build_object('cumulative_empty', 'No finished games in this period') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'cumulative_series_label', '') = ''
        THEN jsonb_build_object('cumulative_series_label', 'Games') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'breakdown_modes_title', '') = ''
        THEN jsonb_build_object('breakdown_modes_title', 'Game modes') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'breakdown_modes_empty', '') = ''
        THEN jsonb_build_object('breakdown_modes_empty', 'No games by mode yet') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'breakdown_outcomes_title', '') = ''
        THEN jsonb_build_object('breakdown_outcomes_title', 'Match outcomes') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'breakdown_outcomes_empty', '') = ''
        THEN jsonb_build_object('breakdown_outcomes_empty', 'No finished matches yet') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'breakdown_outcomes_meta_fmt', '') = ''
        THEN jsonb_build_object('breakdown_outcomes_meta_fmt', 'Decisive rate {pct}% · {n} matches') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'outcome_decisive_label', '') = ''
        THEN jsonb_build_object('outcome_decisive_label', 'Decisive') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'outcome_draw_label', '') = ''
        THEN jsonb_build_object('outcome_draw_label', 'Draw') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'breakdown_entry_title', '') = ''
        THEN jsonb_build_object('breakdown_entry_title', 'Entry type') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'breakdown_entry_empty', '') = ''
        THEN jsonb_build_object('breakdown_entry_empty', 'No entry-type data yet') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'entry_free_label', '') = ''
        THEN jsonb_build_object('entry_free_label', 'Free') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'entry_paid_label', '') = ''
        THEN jsonb_build_object('entry_paid_label', 'Paid') ELSE '{}'::jsonb END
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'activity';

UPDATE platform_settings
SET value = value
  || CASE WHEN COALESCE(value->>'heatmap_title', '') = ''
      THEN jsonb_build_object('heatmap_title', 'Activity calendar') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'heatmap_empty', '') = ''
      THEN jsonb_build_object('heatmap_empty', 'No activity days in this period') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'heatmap_total_label', '') = ''
      THEN jsonb_build_object('heatmap_total_label', 'Active days') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'heatmap_stat_longest_streak', '') = ''
      THEN jsonb_build_object('heatmap_stat_longest_streak', 'Longest streak') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'heatmap_stat_current_streak', '') = ''
      THEN jsonb_build_object('heatmap_stat_current_streak', 'Current streak') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'heatmap_stat_peak_day', '') = ''
      THEN jsonb_build_object('heatmap_stat_peak_day', 'Most active day') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'heatmap_stat_peak_month', '') = ''
      THEN jsonb_build_object('heatmap_stat_peak_month', 'Most active month') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'heatmap_streak_unit', '') = ''
      THEN jsonb_build_object('heatmap_streak_unit', 'd') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'cumulative_title', '') = ''
      THEN jsonb_build_object('cumulative_title', 'Games finished (cumulative)') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'cumulative_empty', '') = ''
      THEN jsonb_build_object('cumulative_empty', 'No finished games in this period') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'cumulative_series_label', '') = ''
      THEN jsonb_build_object('cumulative_series_label', 'Games') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'breakdown_modes_title', '') = ''
      THEN jsonb_build_object('breakdown_modes_title', 'Game modes') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'breakdown_modes_empty', '') = ''
      THEN jsonb_build_object('breakdown_modes_empty', 'No games by mode yet') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'breakdown_outcomes_title', '') = ''
      THEN jsonb_build_object('breakdown_outcomes_title', 'Match outcomes') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'breakdown_outcomes_empty', '') = ''
      THEN jsonb_build_object('breakdown_outcomes_empty', 'No finished matches yet') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'breakdown_outcomes_meta_fmt', '') = ''
      THEN jsonb_build_object('breakdown_outcomes_meta_fmt', 'Decisive rate {pct}% · {n} matches') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'outcome_decisive_label', '') = ''
      THEN jsonb_build_object('outcome_decisive_label', 'Decisive') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'outcome_draw_label', '') = ''
      THEN jsonb_build_object('outcome_draw_label', 'Draw') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'breakdown_entry_title', '') = ''
      THEN jsonb_build_object('breakdown_entry_title', 'Entry type') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'breakdown_entry_empty', '') = ''
      THEN jsonb_build_object('breakdown_entry_empty', 'No entry-type data yet') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'entry_free_label', '') = ''
      THEN jsonb_build_object('entry_free_label', 'Free') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'entry_paid_label', '') = ''
      THEN jsonb_build_object('entry_paid_label', 'Paid') ELSE '{}'::jsonb END,
updated_at = NOW()
WHERE key = 'platform_stats_chrome';
