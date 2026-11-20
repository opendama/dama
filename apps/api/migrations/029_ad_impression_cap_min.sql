-- Impression cap floor is platform policy (DB), not a client invent of min=1.

UPDATE platform_settings
SET value = value || '{
  "impression_cap_min": 1
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_playback';
