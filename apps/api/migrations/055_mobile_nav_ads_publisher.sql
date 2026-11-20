-- Add Ad Publisher portal entries to mobile client nav (parity with web ads surface).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{mobile}',
  COALESCE(value->'mobile', '[]'::jsonb) || '[
    {"title": "Ads", "route_key": "ads"},
    {"title": "Campaigns", "route_key": "ads_campaigns"},
    {"title": "Analytics", "route_key": "ads_analytics"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'mobile', '[]'::jsonb)) AS el
    WHERE el->>'route_key' IN ('ads', 'ads_dashboard')
  );
