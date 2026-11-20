-- DB-backed list_page_size for events organizer/player + ads publisher lists.
-- top_up_href on organizer chrome (parity with events_player_chrome).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_page_size', '25',
  'top_up_href', '/wallet'
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_page_size', '25'
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_page_size', '25'
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
