-- Mig 398: Soft-fill leftover player dashboard Tournaments card Event-sport copy.
-- Seeded in 012/015 as body "Enroll in paid or free events." / cta "Browse events".
-- Later nav prune may drop the card; heal any leftover row so players never see Event sport.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE(elem->>'route_key', '') = 'tournaments'
          AND (
            COALESCE(elem->>'body', '') ~* '\mevents?\M'
            OR COALESCE(elem->>'cta', '') ~* '\mevents?\M'
          )
        THEN elem
          || jsonb_build_object(
            'body', 'Enroll in paid or free tournaments.',
            'cta', 'Browse tournaments'
          )
          || CASE
               WHEN COALESCE(elem->>'href', '') IN ('/tournaments', '/tournaments/')
                 OR COALESCE(elem->>'href', '') LIKE '/tournaments?%'
               THEN jsonb_build_object('href', '/?view=tournaments')
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
    WHERE COALESCE(elem->>'route_key', '') = 'tournaments'
      AND (
        COALESCE(elem->>'body', '') ~* '\mevents?\M'
        OR COALESCE(elem->>'cta', '') ~* '\mevents?\M'
      )
  );
