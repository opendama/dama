-- 515: Live boards inner tab labels (All live / Officially) + ASCII KPI count separator.
-- Force-heal filter label brevity; soft-fill kpi_count_separator (no middle-dot).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'filter_official_paused', 'Officially',
  'kpi_count_separator',
  COALESCE(
    NULLIF(trim(value->>'kpi_count_separator'), ''),
    ' - '
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
