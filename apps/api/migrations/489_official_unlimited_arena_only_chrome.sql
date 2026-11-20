-- Official cups: Unlimited (null max_players) is Arena-only.
-- Chrome errors for admin create/update when classic formats omit max.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_unlimited_arena_only', COALESCE(
    NULLIF(trim(value->>'err_unlimited_arena_only'), ''),
    'Unlimited (no max players) is allowed for Arena only'
  ),
  'err_max_players_required', COALESCE(
    NULLIF(trim(value->>'err_max_players_required'), ''),
    'Max players is required for this format'
  ),
  'unlimited_players_label', COALESCE(
    NULLIF(trim(value->>'unlimited_players_label'), ''),
    'Unlimited'
  ),
  'prize_pool_max_players_unlimited_blurb', COALESCE(
    NULLIF(trim(value->>'prize_pool_max_players_unlimited_blurb'), ''),
    'Leave empty for Unlimited open enroll (Arena only). Or set a high safety ceiling.'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
