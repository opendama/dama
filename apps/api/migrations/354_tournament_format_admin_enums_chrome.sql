-- Idempotent: tournament format enums + admin tournament chrome (format picker).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'tournament_formats', COALESCE(value->'tournament_formats', '["knockout","round_robin","swiss","groups_knockout"]'::jsonb),
  'tournament_default_format', COALESCE(NULLIF(trim(value->>'tournament_default_format'), ''), 'knockout')
),
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'format_label', COALESCE(NULLIF(trim(value->>'format_label'), ''), 'Format'),
  'format_required', COALESCE(NULLIF(trim(value->>'format_required'), ''), 'Select a format')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
