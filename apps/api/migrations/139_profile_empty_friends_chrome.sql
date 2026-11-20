-- Profile page: empty friends copy + empty cell label (no client-invented em dash).

UPDATE platform_settings
SET value = value || '{
  "no_friends": "No friends to show yet.",
  "empty_value": "-"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'profile_inspect_chrome';
