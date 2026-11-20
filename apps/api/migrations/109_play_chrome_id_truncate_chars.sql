-- Play chrome: DB-driven game-id display length (no client invent of slice(0,8)).
UPDATE platform_settings
SET value = value || '{
  "id_truncate_chars": "8"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';
