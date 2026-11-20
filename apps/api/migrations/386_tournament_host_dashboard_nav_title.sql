-- Mig 386: Host portal dashboard nav tab - Hosting (not generic Events Dashboard).
-- Soft-force known legacy titles. Idempotent.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{events}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(elem->>'route_key', '') = 'events_dashboard'
            AND COALESCE(elem->>'title', '') IN ('Dashboard', 'Events', 'Events dashboard')
          THEN jsonb_set(elem, '{title}', to_jsonb('Hosting'::text))
          ELSE elem
        END
      )
      FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) AS elem
    ),
    '[]'::jsonb
  )
),
updated_at = NOW()
WHERE key = 'client_nav' AND value ? 'events';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,events}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(elem->>'route_key', '') = 'events_dashboard'
            AND COALESCE(elem->>'title', '') IN ('Dashboard', 'Events', 'Events dashboard')
          THEN jsonb_set(elem, '{title}', to_jsonb('Hosting'::text))
          ELSE elem
        END
      )
      FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) AS elem
    ),
    '[]'::jsonb
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav'
  AND value->'bottom_nav' ? 'events';
