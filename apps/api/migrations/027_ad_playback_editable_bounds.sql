-- Non-skippable (and related timing) bounds live in DB so admin can increase/decrease
-- freely within platform limits. Seed default non_skippable remains 10; value is never static in clients.

UPDATE platform_settings
SET value = value || '{
  "non_skippable_min": 1,
  "non_skippable_max": 120,
  "first_show_min": 0,
  "first_show_max": 3600,
  "interval_min": 30,
  "interval_max": 86400
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_playback';

-- Ensure current value is present and within bounds (default 10 if somehow missing).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{non_skippable_seconds}',
  COALESCE(value->'non_skippable_seconds', '10'::jsonb)
),
updated_at = NOW()
WHERE key = 'ad_playback';
