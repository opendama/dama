-- Catalog format/size display labels (DB-only; clients must not invent English names).

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{formats}',
    (
      SELECT COALESCE(jsonb_agg(
        CASE elem->>'id'
          WHEN 'knockout' THEN elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), 'Knockout'))
          WHEN 'round_robin' THEN elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), 'Round robin'))
          WHEN 'groups_knockout' THEN elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), 'Groups to knockout'))
          WHEN 'swiss' THEN elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), 'Swiss'))
          ELSE elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), elem->>'id'))
        END
        ORDER BY (elem->>'sort_order')::int NULLS LAST, elem->>'id'
      ), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(value->'formats', '[]'::jsonb)) AS elem
    )
  ),
  '{sizes}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE elem->>'id'
        WHEN 'size_8' THEN elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), '8 players'))
        WHEN 'size_16' THEN elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), '16 players'))
        WHEN 'size_32' THEN elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), '32 players'))
        WHEN 'size_64' THEN elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), '64 players'))
        ELSE elem || jsonb_build_object('label', COALESCE(NULLIF(trim(elem->>'label'), ''), elem->>'id'))
      END
      ORDER BY (elem->>'sort_order')::int NULLS LAST, elem->>'id'
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'events_catalog';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'catalog_item_label', 'Display label',
  'catalog_item_label_blurb', 'Shown to organizers and players when creating or browsing events. Format and size ids stay machine keys.'
),
updated_at = NOW()
WHERE key = 'events_admin_chrome'
  AND (
    NULLIF(trim(COALESCE(value->>'catalog_item_label', '')), '') IS NULL
    OR NULLIF(trim(COALESCE(value->>'catalog_item_label_blurb', '')), '') IS NULL
  );
