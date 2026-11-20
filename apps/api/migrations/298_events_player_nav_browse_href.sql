-- Player discovery: never re-seed a second Event browse world.
-- Historical: mig 182 incorrectly seeded client_nav.player Events to /events/dashboard;
-- this file once forced /?view=events. Tournament UX (376+) owns /?view=tournaments only.
-- Soft-fill: if a legacy route_key=events row still exists mid-migrate, point it at
-- Tournaments Community (title Tournament-safe). Do NOT insert a new Events browse row.
-- Dashboard ops: Hosting card must use events_dashboard (not public events key).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'route_key' = 'events'
        THEN jsonb_set(
          jsonb_set(elem, '{href}', '"/?view=tournaments&source=community"'::jsonb),
          '{title}',
          to_jsonb(COALESCE(NULLIF(trim(elem->>'title'), ''), 'Tournaments'))
        )
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) AS elem
  )
),
    updated_at = NOW()
WHERE key = 'client_nav'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'events'
  );

-- Do not ensure a player Events browse row (376 drops leftovers; Tournaments is canonical).

-- Bottom player nav: remap legacy events browse → Tournaments Community (no new insert).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'route_key' = 'events'
        THEN jsonb_set(
          jsonb_set(elem, '{href}', '"/?view=tournaments&source=community"'::jsonb),
          '{title}',
          to_jsonb(COALESCE(NULLIF(trim(elem->>'title'), ''), 'Tournaments'))
        )
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'player', '[]'::jsonb)) AS elem
  )
),
    updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'player', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'events'
  );

-- Dashboard ops: Hosting card must use events_dashboard (not public events key).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'route_key' = 'events'
          AND COALESCE(elem->>'href', '') LIKE '/events/%'
        THEN jsonb_set(elem, '{route_key}', '"events_dashboard"'::jsonb)
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) AS elem
  )
),
    updated_at = NOW()
WHERE key = 'client_nav';
