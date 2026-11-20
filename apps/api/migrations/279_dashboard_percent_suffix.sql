-- Player dashboard win-rate percent suffix from DB chrome (no client invent of "%").

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'dashboard_percent_suffix',
  COALESCE(
    NULLIF(trim(value->>'dashboard_percent_suffix'), ''),
    '%'
  )
),
    updated_at = NOW()
WHERE key = 'client_nav';
