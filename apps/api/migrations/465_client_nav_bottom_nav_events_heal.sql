-- Heal empty client_nav.bottom_nav.events from surface events (Hosting tabs).
-- Some envs lost bottom tabs after public-browse prune left an empty array.
-- Idempotent: only fills when bottom_nav.events is missing or length 0 and surface events has rows.

UPDATE platform_settings
SET value = jsonb_set(
  CASE
    WHEN value ? 'bottom_nav' THEN value
    ELSE value || jsonb_build_object('bottom_nav', '{}'::jsonb)
  END,
  '{bottom_nav,events}',
  (
    SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb))
      WITH ORDINALITY AS t(elem, ord)
    WHERE COALESCE(elem->>'route_key', '') NOT IN ('events_public', 'events')
      AND COALESCE(elem->>'href', '') NOT LIKE '/events/public%'
      AND COALESCE(elem->>'href', '') <> ''
      AND COALESCE(elem->>'title', '') <> ''
  )
),
    updated_at = NOW()
WHERE key = 'client_nav'
  AND jsonb_typeof(COALESCE(value->'events', 'null'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(value->'events', '[]'::jsonb)) > 0
  AND (
    NOT (value ? 'bottom_nav')
    OR NOT (value->'bottom_nav' ? 'events')
    OR jsonb_typeof(value->'bottom_nav'->'events') <> 'array'
    OR jsonb_array_length(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) = 0
  );
