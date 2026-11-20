-- Home tournament cards: separate empty list copy from missing-field placeholder.
-- empty_live = list has zero tournaments; empty_value = dash for omitted card cells.

UPDATE platform_settings
SET value = value || '{
  "empty_value": "-",
  "empty_live": "No tournaments available right now."
}'::jsonb,
updated_at = NOW()
WHERE key = 'home_surface_chrome';
