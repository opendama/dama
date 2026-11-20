-- Player overview: DB joiner between played count and matches suffix (no client invent space).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'dashboard_matches_joiner', COALESCE(NULLIF(trim(value->>'dashboard_matches_joiner'), ''), ' · ')
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NULLIF(trim(COALESCE(value->>'dashboard_matches_joiner', '')), '') IS NULL;
