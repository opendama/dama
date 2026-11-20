-- Arena duration: Months unit (30-day length) for week/month organizers.
-- Still stored as arena_duration_minutes; classic formats remain without timed duration.

UPDATE platform_settings
SET value = value || '{
  "arena_duration_unit_months": "Months"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || '{
  "arena_duration_unit_months": "Months"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';
