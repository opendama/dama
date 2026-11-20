-- Mig 378: Host portal nav + join page - Tournament wording; no second public browse.
-- Soft-fill / force known legacy "Events" titles players who host still see.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Organizer chrome: dashboard / feature copy players see when hosting.
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'dashboard_title',
  COALESCE(NULLIF(trim(value->>'dashboard_title'), ''), 'Hosting dashboard'),
  'feature_disabled',
  COALESCE(NULLIF(trim(value->>'feature_disabled'), ''),
    'Community tournaments are temporarily unavailable')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{dashboard_title}',
    to_jsonb('Hosting dashboard'::text)
  ),
  '{feature_disabled}',
  to_jsonb('Community tournaments are temporarily unavailable'::text)
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(value->>'dashboard_title', '') IN ('Events dashboard', 'Events')
    OR COALESCE(value->>'feature_disabled', '') ILIKE 'Events are %'
  );

-- ---------------------------------------------------------------------------
-- client_nav.events + bottom_nav.events: My events / Events → hosted tournaments.
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{events}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN COALESCE(elem->>'route_key', '') = 'events_list'
            AND COALESCE(elem->>'title', '') IN ('My events', 'Events', 'Event')
          THEN jsonb_set(elem, '{title}', to_jsonb('My hosted tournaments'::text))
          WHEN COALESCE(elem->>'route_key', '') = 'events_join'
            AND COALESCE(elem->>'title', '') = 'Join'
          THEN jsonb_set(elem, '{title}', to_jsonb('Join with code'::text))
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
          WHEN COALESCE(elem->>'route_key', '') = 'events_list'
            AND COALESCE(elem->>'title', '') IN ('My events', 'Events', 'Event')
          THEN jsonb_set(elem, '{title}', to_jsonb('My hosted tournaments'::text))
          WHEN COALESCE(elem->>'route_key', '') = 'events_join'
            AND COALESCE(elem->>'title', '') = 'Join'
          THEN jsonb_set(elem, '{title}', to_jsonb('Join with code'::text))
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

-- Re-assert public list href (Community discovery only).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{portal_public_list_href}',
  to_jsonb('/?view=tournaments&source=community'::text)
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
