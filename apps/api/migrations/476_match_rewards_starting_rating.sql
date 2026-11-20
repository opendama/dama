-- New-account starting rating is admin-owned via platform_settings.match_rewards.starting_rating
-- (Progression CRUD). Soft-fill only when the key is missing or non-numeric (default 1200).
-- Do NOT force starting_rating >= 100 here: rating_floor is admin-owned (mig 477) and
-- starting_rating must be >= rating_floor (enforced in SetMatchRewards / ReloadProgression).
-- Column users.rating DEFAULT 1200 stays as a DB safety net; OAuth create uses this setting.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{starting_rating}',
  '1200'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'match_rewards'
  AND (
    NOT (value ? 'starting_rating')
    OR jsonb_typeof(value->'starting_rating') <> 'number'
  );

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "match_rewards_blurb": "How much career XP and rating change when a rated human vs human match ends, plus the starting rating assigned to brand-new accounts. Queue games are always rated. Invites can be rated or unrated. VS-AI practice never uses match deltas. Rating deltas may be negative for losses. Starting rating must be at or above the minimum rating floor. Changing starting rating does not rewrite existing players.",
    "starting_rating_label": "New player starting rating",
    "err_starting_rating": "Starting rating must be a whole number at or above the minimum rating floor"
  }'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
