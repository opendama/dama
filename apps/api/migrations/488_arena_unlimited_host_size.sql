-- Arena Unlimited: nullable hosted_events.max_players (parity with tournaments),
-- catalog size may use null max_players for Arena-only open enroll,
-- DB chrome labels for Unlimited (admin + organizer + player + tournament admin).

-- 1) Hosted cups: allow NULL max_players (open enroll). Existing rows stay capped.
ALTER TABLE hosted_events DROP CONSTRAINT IF EXISTS hosted_events_max_players_check;
ALTER TABLE hosted_events ALTER COLUMN max_players DROP NOT NULL;
ALTER TABLE hosted_events
  ADD CONSTRAINT hosted_events_max_players_check
  CHECK (max_players IS NULL OR max_players >= 2);

-- 2) Seed Arena-only Unlimited catalog size when missing (null max_players).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sizes}',
  COALESCE(value->'sizes', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) s
      WHERE trim(COALESCE(s->>'id', '')) = 'size_unlimited'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(
      jsonb_build_object(
        'id', 'size_unlimited',
        'label', 'Unlimited',
        'enabled', true,
        'sort_order', 100,
        'max_players', NULL,
        'host_fee_amount', 500,
        'host_fee_currency', 'ETB',
        'host_fee_ethiopia_amount', 500,
        'host_fee_ethiopia_currency', 'ETB',
        'host_fee_global_amount', 50,
        'host_fee_global_currency', 'USD',
        'allowed_format_ids', jsonb_build_array(
          trim((
            SELECT value->>'hosted_event_arena_format'
            FROM platform_settings
            WHERE key = 'client_enums'
            LIMIT 1
          ))
        )
      )
    )
  END
),
updated_at = NOW()
WHERE key = 'events_catalog'
  AND NULLIF(trim((
    SELECT value->>'hosted_event_arena_format'
    FROM platform_settings
    WHERE key = 'client_enums'
    LIMIT 1
  )), '') IS NOT NULL;

-- 3) Events admin chrome: Unlimited size editor labels.
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'unlimited_players_label', COALESCE(
    NULLIF(trim(value->>'unlimited_players_label'), ''),
    'Unlimited'
  ),
  'sizes_unlimited_toggle_label', COALESCE(
    NULLIF(trim(value->>'sizes_unlimited_toggle_label'), ''),
    'Unlimited (Arena open enroll, no seat cap)'
  ),
  'sizes_unlimited_blurb', COALESCE(
    NULLIF(trim(value->>'sizes_unlimited_blurb'), ''),
    'Leave max empty for true open enroll, or set a high safety ceiling. Unlimited sizes may allow Arena only.'
  ),
  'sizes_max_players_placeholder', COALESCE(
    NULLIF(trim(value->>'sizes_max_players_placeholder'), ''),
    'Empty = Unlimited'
  ),
  'err_unlimited_arena_only', COALESCE(
    NULLIF(trim(value->>'err_unlimited_arena_only'), ''),
    'Unlimited (no max players) is allowed for Arena only'
  )
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- 4) Organizer chrome: show Unlimited on host create / list.
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'unlimited_players_label', COALESCE(
    NULLIF(trim(value->>'unlimited_players_label'), ''),
    'Unlimited'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- 5) Player chrome: join / cards when uncapped.
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'unlimited_players_label', COALESCE(
    NULLIF(trim(value->>'unlimited_players_label'), ''),
    'Unlimited'
  )
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

-- 6) Tournament admin chrome: Official cups empty max = Unlimited.
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'unlimited_players_label', COALESCE(
    NULLIF(trim(value->>'unlimited_players_label'), ''),
    'Unlimited'
  ),
  'prize_pool_max_players_unlimited_blurb', COALESCE(
    NULLIF(trim(value->>'prize_pool_max_players_unlimited_blurb'), ''),
    'Leave empty for Unlimited open enroll (recommended for Arena). Or set a high safety ceiling.'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

-- 7) Tournaments player chrome: display Unlimited when no max.
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'unlimited_players_label', COALESCE(
    NULLIF(trim(value->>'unlimited_players_label'), ''),
    'Unlimited'
  )
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';
