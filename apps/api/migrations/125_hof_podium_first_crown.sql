-- Hall of Fame podium: first-place numeral from DB chrome (parity with 2nd/3rd crowns).

UPDATE platform_settings
SET value = value || '{
  "podium_first_crown": "1"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'leaderboard_chrome';
