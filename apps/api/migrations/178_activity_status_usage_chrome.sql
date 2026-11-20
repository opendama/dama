-- Trim Usage-section chrome for admin activity + public Status page charts.
-- series_subtitle / series_y_axis / series_today_label + public series meta/colors.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{activity}',
  (value->'activity')
    || CASE WHEN COALESCE(value->'activity'->>'series_subtitle', '') = ''
        THEN jsonb_build_object('series_subtitle', 'Activity per day in the selected period') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'series_y_axis', '') = ''
        THEN jsonb_build_object('series_y_axis', 'Counts') ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(value->'activity'->>'series_today_label', '') = ''
        THEN jsonb_build_object('series_today_label', 'Today') ELSE '{}'::jsonb END
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'activity';

UPDATE platform_settings
SET value = value
  || CASE WHEN COALESCE(value->>'series_title', '') = ''
      THEN jsonb_build_object('series_title', 'Platform activity') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_subtitle', '') = ''
      THEN jsonb_build_object('series_subtitle', 'Visits, play, and games per day') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_y_axis', '') = ''
      THEN jsonb_build_object('series_y_axis', 'Counts') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_empty', '') = ''
      THEN jsonb_build_object('series_empty', 'No activity in this period yet') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_legend_aria', '') = ''
      THEN jsonb_build_object('series_legend_aria', 'Activity series legend') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_today_label', '') = ''
      THEN jsonb_build_object('series_today_label', 'Today') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_visited_label', '') = ''
      THEN jsonb_build_object('series_visited_label', 'Visited') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_played_label', '') = ''
      THEN jsonb_build_object('series_played_label', 'Played') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_games_label', '') = ''
      THEN jsonb_build_object('series_games_label', 'Games') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_visited_color', '') = ''
      THEN jsonb_build_object('series_visited_color', 'var(--dama-gold)') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_played_color', '') = ''
      THEN jsonb_build_object('series_played_color', 'var(--dama-text)') ELSE '{}'::jsonb END
  || CASE WHEN COALESCE(value->>'series_games_color', '') = ''
      THEN jsonb_build_object('series_games_color', 'var(--dama-muted)') ELSE '{}'::jsonb END,
updated_at = NOW()
WHERE key = 'platform_stats_chrome';
