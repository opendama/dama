-- Dedicated public Status (platform stats) page - left rail / hamburger, NOT on play hub.
-- Idempotent append to client_nav.player + bottom_nav.mobile (Flutter shell).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) ||
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
    WHERE e->>'route_key' IN ('status', 'platform_stats')
  ) THEN '[]'::jsonb
    ELSE '[{"title":"Status","href":"/?view=status","route_key":"status"}]'::jsonb END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,mobile}',
  COALESCE(value->'bottom_nav'->'mobile', '[]'::jsonb) ||
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'mobile', '[]'::jsonb)) e
    WHERE e->>'route_key' IN ('status', 'platform_stats')
  ) THEN '[]'::jsonb
    ELSE '[{"title":"Status","href":"/?view=status","route_key":"status"}]'::jsonb END
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';
