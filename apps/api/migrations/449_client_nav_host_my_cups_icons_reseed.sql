-- Re-seed Host a tournament + My cups on player rail (idempotent).
-- Titles/hrefs DB-owned; clients map distinct icons by route_key.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'host_tournament'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Host a tournament',
      'href', '/events/events?create=1',
      'route_key', 'host_tournament'
    ))
  END
),
    updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'tournaments_mine'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'My cups',
      'href', '/?view=tournaments&mine=1',
      'route_key', 'tournaments_mine'
    ))
  END
),
    updated_at = NOW()
WHERE key = 'client_nav';
