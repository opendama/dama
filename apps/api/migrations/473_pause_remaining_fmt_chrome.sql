-- Pause countdown copy (board + shells). {time} → m:ss from pause_remaining_ms.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "pause_remaining_fmt": "Resumes in {time}"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_chrome';
