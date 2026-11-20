-- Mig 388: Player portal ops card - Hosting (not "Host events" / "Open Events").
-- Dashboard card title feeds pickOpsPlayerNavLinks (rail + hamburger ops).
-- Host shell bottom_nav was fixed in 378/386; this card was missed. Idempotent.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE(elem->>'route_key', '') IN ('events_dashboard', 'events')
          AND (
            COALESCE(elem->>'href', '') LIKE '/events/%'
            OR COALESCE(elem->>'href', '') = '/events'
          )
        THEN elem
          || jsonb_build_object('title', 'Hosting')
          || CASE
               WHEN COALESCE(elem->>'cta', '') <> ''
                 THEN jsonb_build_object('cta', 'Open Hosting')
               ELSE '{}'::jsonb
             END
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'dashboard'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) AS elem
    WHERE COALESCE(elem->>'route_key', '') IN ('events_dashboard', 'events')
      AND (
        COALESCE(elem->>'href', '') LIKE '/events/%'
        OR COALESCE(elem->>'href', '') = '/events'
      )
      AND (
        COALESCE(elem->>'title', '') ILIKE '%event%'
        OR COALESCE(elem->>'cta', '') ILIKE '%event%'
      )
  );
