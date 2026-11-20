-- Heal size_unlimited.allowed_format_ids to client_enums.hosted_event_arena_format
-- (never assume the literal id "arena" if the enum was customized).

UPDATE platform_settings AS cat
SET value = jsonb_set(
  cat.value,
  '{sizes}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN trim(COALESCE(s->>'id', '')) = 'size_unlimited'
          AND NULLIF(trim(enums.value->>'hosted_event_arena_format'), '') IS NOT NULL
        THEN jsonb_set(
          s,
          '{allowed_format_ids}',
          jsonb_build_array(trim(enums.value->>'hosted_event_arena_format'))
        )
        ELSE s
      END
      ORDER BY (s->>'sort_order')::int NULLS LAST, s->>'id'
    )
    FROM jsonb_array_elements(COALESCE(cat.value->'sizes', '[]'::jsonb)) AS s
    CROSS JOIN LATERAL (
      SELECT value
      FROM platform_settings
      WHERE key = 'client_enums'
      LIMIT 1
    ) AS enums
  ), COALESCE(cat.value->'sizes', '[]'::jsonb))
),
updated_at = NOW()
WHERE cat.key = 'events_catalog'
  AND EXISTS (
    SELECT 1
    FROM platform_settings e
    WHERE e.key = 'client_enums'
      AND NULLIF(trim(e.value->>'hosted_event_arena_format'), '') IS NOT NULL
  );
