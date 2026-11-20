-- Activity chart legend aria (Trim ChartLegendList) - DB chrome only; no client invent.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{activity}',
  (value->'activity')
    || CASE WHEN COALESCE(value->'activity'->>'series_legend_aria', '') = ''
        THEN jsonb_build_object('series_legend_aria', 'Activity series legend') ELSE '{}'::jsonb END
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'activity';
