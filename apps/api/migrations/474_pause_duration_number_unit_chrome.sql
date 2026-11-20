-- Pause duration admin CRUD: simple number + Seconds/Minutes unit (not calendar).
-- Stored value remains match_clock.pause_duration_seconds.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "pause_duration_blurb": "How long a seated player may freeze the match clock and moves. Enter a number, then choose Seconds or Minutes. The match resumes automatically when this time runs out.",
    "pause_duration_placeholder": "e.g. 5",
    "pause_duration_unit_aria": "Pause duration unit",
    "pause_duration_seconds_label": "Seconds",
    "pause_duration_minutes_label": "Minutes",
    "err_pause_duration": "Pause duration must be greater than 0 when pause is enabled"
  }'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
