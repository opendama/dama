-- Server-authoritative match pause.
-- Migrations re-apply on every boot, so match_clock defaults are merged underneath
-- the stored document (right-hand side wins) and admin pause settings are kept.
-- Chrome seeds use value || seed, same as other play/admin chrome migrations.

UPDATE platform_settings
SET value = '{
  "pause_enabled": true,
  "pause_duration_seconds": 300
}'::jsonb || COALESCE(value, '{}'::jsonb),
    updated_at = NOW()
WHERE key = 'match_clock';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "pause_game_action": "Pause",
  "resume_game_action": "Resume",
  "pause_game_pending": "Pausing…",
  "resume_game_pending": "Resuming…",
  "toast_paused": "Game paused",
  "toast_resumed": "Game resumed",
  "toast_pause_failed": "Could not pause the match. Try again.",
  "toast_resume_failed": "Could not resume the match. Try again.",
  "toast_auto_resumed": "Pause time ended. The match has resumed.",
  "pause_disabled": "Pause is turned off.",
  "game_paused_blurb": "This match is paused. The clock is frozen and moves are blocked.",
  "floating_resume_label": "Resume",
  "floating_resume_aria": "Resume the paused match",
  "nav_paused_label": "Paused",
  "err_pause_disabled": "Pause is disabled",
  "err_already_paused": "This match is already paused",
  "err_not_paused": "This match is not paused",
  "err_game_paused": "The match is paused"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "pause_enabled_label": "Pause enabled",
    "pause_duration_label": "Pause duration",
    "pause_duration_blurb": "How long a seated player may freeze the match clock and moves. Pick hours and minutes; the match resumes automatically when this time runs out.",
    "err_pause_duration": "Pause duration must be greater than 0 when pause is enabled",
    "pause_duration_picker_aria": "Choose pause duration",
    "pause_duration_hours_aria": "Hours",
    "pause_duration_minutes_aria": "Minutes"
  }'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
