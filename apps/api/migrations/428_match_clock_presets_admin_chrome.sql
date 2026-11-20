-- Admin Progression: label for read-only DB match_clock.presets (no client invent).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "match_clock_presets_label": "Time control presets"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
