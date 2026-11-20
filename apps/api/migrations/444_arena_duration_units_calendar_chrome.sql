-- Arena duration UX: minutes/hours/days/weeks + calendar ends-at (still stored as arena_duration_minutes).
-- Only Arena format uses a timed clock; classic formats finish by bracket/organizer close.

UPDATE platform_settings
SET value = value || '{
  "arena_duration_label": "Arena duration",
  "arena_duration_required": "Enter arena duration",
  "arena_duration_unit_label": "Unit",
  "arena_duration_unit_minutes": "Minutes",
  "arena_duration_unit_hours": "Hours",
  "arena_duration_unit_days": "Days",
  "arena_duration_unit_weeks": "Weeks",
  "arena_duration_mode_length": "Length",
  "arena_duration_mode_ends_at": "Ends at",
  "arena_duration_ends_at_label": "End date & time",
  "arena_duration_ends_at_placeholder": "mm/dd/yyyy --:-- --",
  "arena_duration_ends_at_past": "Pick an end time in the future",
  "arena_duration_blurb": "Clock runs for this length after the arena starts.",
  "arena_settings_label_default_duration": "Default duration"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || '{
  "arena_duration_label": "Arena duration",
  "arena_duration_required": "Enter arena duration",
  "arena_duration_unit_label": "Unit",
  "arena_duration_unit_minutes": "Minutes",
  "arena_duration_unit_hours": "Hours",
  "arena_duration_unit_days": "Days",
  "arena_duration_unit_weeks": "Weeks",
  "arena_duration_mode_length": "Length",
  "arena_duration_mode_ends_at": "Ends at",
  "arena_duration_ends_at_label": "End date & time",
  "arena_duration_ends_at_placeholder": "mm/dd/yyyy --:-- --",
  "arena_duration_ends_at_past": "Pick an end time in the future",
  "arena_duration_blurb": "Clock runs for this length after the arena starts."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';
