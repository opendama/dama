-- Company classic sizes: allow groups→knockout on size_128 / size_256.
-- Idempotent merge into allowed_format_ids (dedupe). Does not add round_robin.
-- Does not change other sizes or force-enable the global format flag.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sizes}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN trim(COALESCE(elem->>'id', '')) IN ('size_128', 'size_256') THEN
          elem || jsonb_build_object(
            'allowed_format_ids',
            (
              SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x), '[]'::jsonb)
              FROM (
                SELECT DISTINCT trim(x) AS x
                FROM jsonb_array_elements_text(
                  COALESCE(elem->'allowed_format_ids', '[]'::jsonb)
                    || '["groups_knockout"]'::jsonb
                ) AS x
                WHERE trim(x) <> ''
              ) d
            )
          )
        ELSE elem
      END
      ORDER BY (elem->>'sort_order')::int NULLS LAST, elem->>'id'
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'events_catalog'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) s
    WHERE trim(COALESCE(s->>'id', '')) IN ('size_128', 'size_256')
  );
