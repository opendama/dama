-- Classic company sizes: seed host sizes 128 and 256, and extend
-- swiss_rounds_by_max_players so the classic seat ceiling includes them.
-- Idempotent: do not overwrite admin-edited swiss keys or existing size ids.
-- Formats match size_64 (knockout + swiss). Round robin omitted (too many games).

-- 1) Swiss map: add 128→7 and 256→8 only when those keys are missing.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{swiss_rounds_by_max_players}',
  COALESCE(value->'swiss_rounds_by_max_players', '{}'::jsonb)
    || CASE
      WHEN COALESCE(value->'swiss_rounds_by_max_players', '{}'::jsonb) ? '128'
        THEN '{}'::jsonb
      ELSE '{"128":7}'::jsonb
    END
    || CASE
      WHEN COALESCE(value->'swiss_rounds_by_max_players', '{}'::jsonb) ? '256'
        THEN '{}'::jsonb
      ELSE '{"256":8}'::jsonb
    END
),
updated_at = NOW()
WHERE key = 'events_catalog';

-- 2) Seed size_128 when missing (classic fixed; knockout + swiss).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sizes}',
  COALESCE(value->'sizes', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) s
      WHERE trim(COALESCE(s->>'id', '')) = 'size_128'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(
      jsonb_build_object(
        'id', 'size_128',
        'label', '128 players',
        'enabled', true,
        'sort_order', 5,
        'max_players', 128,
        'host_fee_amount', 600,
        'host_fee_currency', 'ETB',
        'host_fee_ethiopia_amount', 600,
        'host_fee_ethiopia_currency', 'ETB',
        'host_fee_global_amount', 60,
        'host_fee_global_currency', 'USD',
        'allowed_format_ids', '["knockout","swiss"]'::jsonb
      )
    )
  END
),
updated_at = NOW()
WHERE key = 'events_catalog';

-- 3) Seed size_256 when missing (classic fixed; knockout + swiss).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sizes}',
  COALESCE(value->'sizes', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) s
      WHERE trim(COALESCE(s->>'id', '')) = 'size_256'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(
      jsonb_build_object(
        'id', 'size_256',
        'label', '256 players',
        'enabled', true,
        'sort_order', 6,
        'max_players', 256,
        'host_fee_amount', 800,
        'host_fee_currency', 'ETB',
        'host_fee_ethiopia_amount', 800,
        'host_fee_ethiopia_currency', 'ETB',
        'host_fee_global_amount', 80,
        'host_fee_global_currency', 'USD',
        'allowed_format_ids', '["knockout","swiss"]'::jsonb
      )
    )
  END
),
updated_at = NOW()
WHERE key = 'events_catalog';
