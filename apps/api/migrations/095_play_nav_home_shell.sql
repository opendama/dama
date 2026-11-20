-- Single Play hub on `/` (remove duplicate Home). Play is open VS-AI lobby for everyone.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  (
    SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT
        CASE
          WHEN e.elem->>'route_key' = 'play'
            THEN e.elem || '{"href":"/","title":"Play"}'::jsonb
          ELSE e.elem
        END AS elem,
        e.ord
      FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'player', '[]'::jsonb))
        WITH ORDINALITY AS e(elem, ord)
      WHERE e.elem->>'route_key' IS DISTINCT FROM 'home'
    ) AS filtered
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  (
    SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT
        CASE
          WHEN e.elem->>'route_key' = 'play'
            THEN e.elem || '{"href":"/","title":"Play"}'::jsonb
          ELSE e.elem
        END AS elem,
        e.ord
      FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb))
        WITH ORDINALITY AS e(elem, ord)
      WHERE e.elem->>'route_key' IS DISTINCT FROM 'home'
    ) AS filtered
  )
),
updated_at = NOW()
WHERE key = 'client_nav';
