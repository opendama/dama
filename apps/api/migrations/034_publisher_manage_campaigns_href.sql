-- Publisher dashboard manage-campaigns path (DB only; no client invent).

UPDATE platform_settings
SET value = value || '{
  "publisher_manage_campaigns_href": "/ads/campaigns"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
