-- Profile inspect modal: backend-driven page size for recent matches / placements lists.
UPDATE platform_settings
SET value = value || '{
  "list_page_size": "8"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'profile_inspect_chrome';
