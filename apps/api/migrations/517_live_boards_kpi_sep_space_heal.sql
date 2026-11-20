-- 517: Force-heal Live boards KPI count separator to spaced ASCII hyphen (readable "label - N").
-- Idempotent.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'kpi_count_separator', ' - '
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
