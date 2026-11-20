-- Prize pool: home live cards need the same entry-fees trust note as tournaments/events chrome.
-- Safe upsert: only fills empty keys; never overwrites admin-edited copy.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_entry_fees_note', COALESCE(
    NULLIF(trim(value->>'prize_pool_entry_fees_note'), ''),
    'From player entry fees. Declared prize_pool.total is the guarantee when set.'
  )
),
updated_at = NOW()
WHERE key = 'home_surface_chrome';
