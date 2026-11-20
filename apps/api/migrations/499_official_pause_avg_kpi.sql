-- Organizer KPI: average completed official pause duration (seconds).
-- Soft-fill only. Idempotent.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'kpi_paused_avg_label', COALESCE(
    NULLIF(trim(value->>'kpi_paused_avg_label'), ''),
    'Avg official pause (sec)'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
