-- Admin tournament detail: cup lifecycle labels (started / finished / arena ends).
-- Fail-closed chrome keys; idempotent.

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'cup_started_at_label', COALESCE(NULLIF(trim(value->>'cup_started_at_label'), ''), 'Cup started'),
    'cup_finished_at_label', COALESCE(NULLIF(trim(value->>'cup_finished_at_label'), ''), 'Cup finished'),
    'cup_not_started_value', COALESCE(NULLIF(trim(value->>'cup_not_started_value'), ''), 'Not started'),
    'cup_not_finished_value', COALESCE(NULLIF(trim(value->>'cup_not_finished_value'), ''), 'In progress')
  ),
  updated_at = NOW()
WHERE key = 'tournament_chrome';
