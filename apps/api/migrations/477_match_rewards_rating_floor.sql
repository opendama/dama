-- Admin-owned career rating floor (replaces hard-coded GREATEST(100, ...)).
-- Soft-fill existing rows to 100 so current product behavior is preserved until admin changes it.
-- starting_rating must remain >= rating_floor (enforced in SetMatchRewards / ReloadProgression).

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{rating_floor}',
  '100'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'match_rewards'
  AND (
    NOT (value ? 'rating_floor')
    OR jsonb_typeof(value->'rating_floor') <> 'number'
    OR (value->>'rating_floor')::numeric < 0
  );

-- Ensure starting_rating is not below the floor after soft-fill.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{starting_rating}',
  to_jsonb(GREATEST(COALESCE((value->>'starting_rating')::int, 1200), COALESCE((value->>'rating_floor')::int, 100))),
  true
),
    updated_at = NOW()
WHERE key = 'match_rewards'
  AND COALESCE((value->>'starting_rating')::int, 0) < COALESCE((value->>'rating_floor')::int, 0);

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "match_rewards_blurb": "How much career XP and rating change when a rated human vs human match ends, plus the minimum rating floor and the starting rating for brand-new accounts. Queue games are always rated. Invites can be rated or unrated. VS-AI practice never uses match deltas. Rating deltas may be negative for losses. Profile rating never drops below the floor you set (0 or more). Starting rating must be at least the floor. Changing these does not rewrite existing players except future match results use the new floor.",
    "rating_floor_label": "Minimum rating floor",
    "err_rating_floor": "Minimum rating floor must be a whole number of 0 or more",
    "err_starting_rating": "Starting rating must be a whole number at or above the minimum rating floor"
  }'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
