-- Live player name truncate suffix: name then (...) when over max chars (play rail).

UPDATE platform_settings
SET value = value || '{
  "name_truncate_suffix": "(...)"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
