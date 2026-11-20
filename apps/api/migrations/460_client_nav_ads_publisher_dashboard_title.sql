-- Public player rail: Ad publisher (parity Host a tournament / My cups).
-- route_key ads_publisher is NOT an ops key so it stays on the home discovery rail.
-- Also rename player/admin "Overview" home labels → "Dashboard" (clearer IA).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_publisher'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Ad publisher',
      'href', '/ads/dashboard',
      'route_key', 'ads_publisher'
    ))
  END
),
    updated_at = NOW()
WHERE key = 'client_nav';

-- Player portal page title (user menu + portal chrome).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard_page_title}',
  to_jsonb('Dashboard'::text),
  true
),
    updated_at = NOW()
WHERE key = 'client_nav'
  AND COALESCE(NULLIF(trim(value->>'dashboard_page_title'), ''), '') IN ('', 'Overview');

-- Force Overview → Dashboard when still the legacy seed.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard_page_title}',
  to_jsonb('Dashboard'::text),
  true
),
    updated_at = NOW()
WHERE key = 'client_nav'
  AND lower(trim(COALESCE(value->>'dashboard_page_title', ''))) = 'overview';

-- Player nav row titled Overview (route_key dashboard).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'route_key' = 'dashboard'
             AND lower(trim(COALESCE(elem->>'title', ''))) = 'overview'
          THEN elem || jsonb_build_object('title', 'Dashboard')
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) elem
  )
),
    updated_at = NOW()
WHERE key = 'client_nav'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'dashboard'
      AND lower(trim(COALESCE(e->>'title', ''))) = 'overview'
  );

-- Admin console modules leaf + grouped nav label.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN lower(trim(COALESCE(elem->>'title', ''))) = 'overview'
             AND COALESCE(elem->>'href', '') IN ('/dashboard', '/dashboard/')
          THEN elem || jsonb_build_object('title', 'Dashboard')
        ELSE elem
      END
      ORDER BY ordinality
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) WITH ORDINALITY AS t(elem, ordinality)
  )
),
    updated_at = NOW()
WHERE key = 'console_nav'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) e
    WHERE lower(trim(COALESCE(e->>'title', ''))) = 'overview'
      AND COALESCE(e->>'href', '') IN ('/dashboard', '/dashboard/')
  );

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{groups}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE(elem->>'id', '') = 'overview'
             AND lower(trim(COALESCE(elem->>'label', ''))) = 'overview'
          THEN jsonb_set(
            elem || jsonb_build_object('label', 'Dashboard'),
            '{items}',
            (
              SELECT COALESCE(jsonb_agg(
                CASE
                  WHEN COALESCE(it->>'id', '') = 'dashboard'
                       AND lower(trim(COALESCE(it->>'label', ''))) = 'overview'
                    THEN it || jsonb_build_object('label', 'Dashboard')
                  ELSE it
                END
                ORDER BY it_ord
              ), COALESCE(elem->'items', '[]'::jsonb))
              FROM jsonb_array_elements(COALESCE(elem->'items', '[]'::jsonb)) WITH ORDINALITY AS i(it, it_ord)
            )
          )
        ELSE elem
      END
      ORDER BY ordinality
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'groups', '[]'::jsonb)) WITH ORDINALITY AS t(elem, ordinality)
  )
),
    updated_at = NOW()
WHERE key = 'console_nav'
  AND value ? 'groups';

-- Admin dashboard chrome page title.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard,page_title}',
  to_jsonb('Dashboard'::text),
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'dashboard'
  AND lower(trim(COALESCE(value->'dashboard'->>'page_title', ''))) IN ('', 'overview');

-- Portal "back to Overview" CTAs → Dashboard (Hosting + Ads publisher).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'portal_overview_label',
  CASE
    WHEN lower(trim(COALESCE(value->>'portal_overview_label', ''))) = 'overview'
      THEN 'Dashboard'
    ELSE COALESCE(NULLIF(trim(value->>'portal_overview_label'), ''), 'Dashboard')
  END
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    lower(trim(COALESCE(value->>'portal_overview_label', ''))) = 'overview'
    OR NULLIF(trim(value->>'portal_overview_label'), '') IS NULL
  );

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{publisher_portal_overview_label}',
  to_jsonb(
    CASE
      WHEN lower(trim(COALESCE(value->>'publisher_portal_overview_label', ''))) = 'overview'
        THEN 'Dashboard'
      ELSE COALESCE(NULLIF(trim(value->>'publisher_portal_overview_label'), ''), 'Dashboard')
    END
  ),
  true
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome'
  AND (
    lower(trim(COALESCE(value->>'publisher_portal_overview_label', ''))) = 'overview'
    OR NULLIF(trim(value->>'publisher_portal_overview_label'), '') IS NULL
  );
