-- Phase display labels for bracket section titles (DB chrome only).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'phase_swiss_label', COALESCE(NULLIF(trim(value->>'phase_swiss_label'), ''), 'Swiss'),
  'phase_round_robin_label', COALESCE(NULLIF(trim(value->>'phase_round_robin_label'), ''), 'Round robin')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'phase_swiss_label', COALESCE(NULLIF(trim(value->>'phase_swiss_label'), ''), 'Swiss'),
  'phase_round_robin_label', COALESCE(NULLIF(trim(value->>'phase_round_robin_label'), ''), 'Round robin')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
