-- Admin Live boards OpsDataTable empty copy (soft-fill, idempotent). ASCII only.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'live_boards_empty', COALESCE(
    NULLIF(trim(value->>'live_boards_empty'), ''),
    'No live boards'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
