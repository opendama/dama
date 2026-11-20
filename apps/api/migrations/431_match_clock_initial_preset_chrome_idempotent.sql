-- Idempotent: ensure progression.err_clock_initial_not_in_presets (fixes 429 top-level / 430 edge).
UPDATE platform_settings
SET value = jsonb_set(
  (COALESCE(value, '{}'::jsonb) - 'err_clock_initial_not_in_presets'),
  '{progression}',
  (COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'err_clock_initial_not_in_presets',
    'Default time control must match a preset'
  )),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
