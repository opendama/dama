-- DB list_page_size for wallet money lists + events admin console lists.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_page_size', '25'
),
    updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_page_size', '25'
),
    updated_at = NOW()
WHERE key = 'events_admin_chrome';
