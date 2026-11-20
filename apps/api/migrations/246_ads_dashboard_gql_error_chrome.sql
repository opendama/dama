-- Publisher GraphQL dashboard/list load errors from DB chrome (no invent English in GQL).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_dashboard_failed": "Unable to load dashboard"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
