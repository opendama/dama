-- Fail-closed chrome when admin default TC is not in match_clock.presets.
-- (Kept for chain history; 430 places the key under progression correctly.)
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_clock_initial_not_in_presets', 'Default time control must match a preset'
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
