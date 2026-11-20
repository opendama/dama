-- Console campaign list page size is platform policy (DB), not a handler invent of 500.

UPDATE platform_settings
SET value = value || '{
  "console_campaigns_limit": 500
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_playback';
