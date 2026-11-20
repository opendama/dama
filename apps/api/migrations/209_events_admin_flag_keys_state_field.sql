-- Events admin: DB-driven feature flag keys (no client hardcode).
-- Feature flag catalog: public_events_enabled was missing state_field (fail-closed GraphQL bind).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'public_events_flag_key', COALESCE(NULLIF(trim(value->>'public_events_flag_key'), ''), 'public_events_enabled'),
  'public_rated_flag_key', COALESCE(NULLIF(trim(value->>'public_rated_flag_key'), ''), 'public_event_matches_rated')
),
    updated_at = NOW()
WHERE key = 'events_admin_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{toggles}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'key' = 'public_events_enabled'
          THEN elem || jsonb_build_object('state_field', 'publicEventsEnabled')
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) AS elem
  )
),
    updated_at = NOW()
WHERE key = 'feature_flag_catalog'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) AS t
    WHERE t->>'key' = 'public_events_enabled'
      AND NULLIF(trim(COALESCE(t->>'state_field', '')), '') IS NULL
  );
