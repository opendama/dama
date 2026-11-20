-- Mig 399: Hosting nav = manage only (no second public browse under Hosting).
-- Drop leftover events_public / /events/public rows from client_nav events surfaces.
-- Soft-fill Community lobby chrome if still Event-sport.
-- Idempotent.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{events}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) AS elem
    WHERE COALESCE(elem->>'route_key', '') NOT IN ('events_public', 'events')
      AND COALESCE(elem->>'href', '') NOT LIKE '/events/public%'
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'events'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) AS elem
    WHERE COALESCE(elem->>'route_key', '') IN ('events_public', 'events')
       OR COALESCE(elem->>'href', '') LIKE '/events/public%'
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,events}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) AS elem
    WHERE COALESCE(elem->>'route_key', '') NOT IN ('events_public', 'events')
      AND COALESCE(elem->>'href', '') NOT LIKE '/events/public%'
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav'
  AND value->'bottom_nav' ? 'events'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) AS elem
    WHERE COALESCE(elem->>'route_key', '') IN ('events_public', 'events')
       OR COALESCE(elem->>'href', '') LIKE '/events/public%'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'lobby_title', 'Cup lobby',
  'lobby_unavailable', 'Cup lobby unavailable'
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(value->>'lobby_title', '') ILIKE '%event%'
    OR COALESCE(value->>'lobby_unavailable', '') ILIKE '%event%'
  );
