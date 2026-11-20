-- Parenthetical wrappers and board-size join separators (fail closed).

UPDATE platform_settings
SET value = value || '{
  "paren_open": " (",
  "paren_close": ")"
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || '{
  "paren_open": " (",
  "paren_close": ")",
  "increment_paren_open": " (+",
  "board_size_separator": "x"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = value || '{
  "resolved_paren_open": " (",
  "resolved_paren_close": ")"
}'::jsonb,
updated_at = NOW()
WHERE key = 'theme_chrome';
