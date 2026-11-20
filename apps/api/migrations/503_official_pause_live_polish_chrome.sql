-- Official pause live-table search + store-update chrome (soft-fill, idempotent).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'live_search_placeholder', COALESCE(
    NULLIF(trim(value->>'live_search_placeholder'), ''),
    'Search match, players, reason'
  ),
  'err_update_failed', COALESCE(
    NULLIF(trim(value->>'err_update_failed'), ''),
    'Could not update the match pause state. Try again.'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
