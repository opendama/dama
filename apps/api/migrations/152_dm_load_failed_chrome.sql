-- DM thread load-failure chrome (distinct from empty history).

UPDATE platform_settings
SET value = value || '{
  "dm_load_failed_label": "Could not load messages"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
