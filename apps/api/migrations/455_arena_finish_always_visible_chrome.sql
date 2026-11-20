-- Finish arena stays visible on all cup statuses; explain when not actionable yet.
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'arena_finish_requires_started', COALESCE(NULLIF(trim(value->>'arena_finish_requires_started'), ''), 'Start the cup before finishing the arena.'),
    'arena_finish_already_finished', COALESCE(NULLIF(trim(value->>'arena_finish_already_finished'), ''), 'This arena is already finished.')
  ),
  updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'arena_finish_requires_started', COALESCE(NULLIF(trim(value->>'arena_finish_requires_started'), ''), 'Start the cup before finishing the arena.'),
    'arena_finish_already_finished', COALESCE(NULLIF(trim(value->>'arena_finish_already_finished'), ''), 'This arena is already finished.')
  ),
  updated_at = NOW()
WHERE key = 'events_organizer_chrome';
