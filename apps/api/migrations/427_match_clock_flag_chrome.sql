-- Authoritative match clock: player-facing flag-fall chrome (DB-driven; no client invent).

UPDATE platform_settings
SET value = value || '{
  "toast_clock_flag": "Time ran out",
  "toast_clock_flag_failed": "Clock still running"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_chrome';
