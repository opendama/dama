-- Play rail: DB-backed rating parentheses (no client invent of "(" / ")").
INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'play_rail_chrome',
  '{
    "rating_paren_open": " (",
    "rating_paren_close": ")"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();
