-- Pause duration admin picker: same DateTimeField chrome as tournament Ends at.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "pause_duration_blurb": "How long a seated player may freeze the match clock and moves. Pick a future date and time with the calendar (same picker as tournament end time); the match resumes automatically when that duration runs out.",
    "pause_duration_ends_at_placeholder": "Pick date and time",
    "pause_duration_ends_at_past": "Pause duration must end in the future"
  }'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
