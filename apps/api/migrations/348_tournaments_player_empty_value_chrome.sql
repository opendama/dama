-- Tournament cards: empty_value is the missing-cell placeholder ("-").
-- empty / empty_web remain list-empty copy only (never card meta fallback).

UPDATE platform_settings
SET value = value || '{
  "empty_value": "-"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';
