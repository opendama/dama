-- Name truncate suffix: plain ellipsis only (not parenthesized "(...)").

UPDATE platform_settings
SET value = value || '{
  "name_truncate_suffix": "..."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
