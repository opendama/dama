-- Meta separators for remaining list/detail surfaces (fail closed).

UPDATE platform_settings
SET value = value || '{
  "meta_separator": " · "
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || '{
  "meta_separator": " · "
}'::jsonb,
updated_at = NOW()
WHERE key = 'matchmaking_chrome';

UPDATE platform_settings
SET value = value || '{
  "meta_separator": " · "
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
