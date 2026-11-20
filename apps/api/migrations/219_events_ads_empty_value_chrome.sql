-- Organizer + ads publisher list cells: DB empty_value (no client invent "-" / 0).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'empty_value',
    COALESCE(NULLIF(trim(value->>'empty_value'), ''), '-')
  ),
  updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Ads schedule_chrome is served from ad_runtime_chrome (not ad_playback).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'empty_value',
    COALESCE(NULLIF(trim(value->>'empty_value'), ''), '-')
  ),
  updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
