-- Prize pool: admin tournament console needs frozen blurb + entry-fees trust note
-- (same honesty copy as player/home surfaces). Safe upsert only fills empty keys.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_frozen_blurb', COALESCE(
    NULLIF(trim(value->>'prize_pool_frozen_blurb'), ''),
    'Pot locked when enrollment closed.'
  ),
  'prize_pool_entry_fees_note', COALESCE(
    NULLIF(trim(value->>'prize_pool_entry_fees_note'), ''),
    'From player entry fees. Declared prize_pool.total is the guarantee when set.'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
