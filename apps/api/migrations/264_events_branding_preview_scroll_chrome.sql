-- Branding preview max width + dialog scroll max height from DB chrome (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'branding_preview_max_width', COALESCE(NULLIF(trim(value->>'branding_preview_max_width'), ''), '128'),
  'dialog_scroll_max_height', COALESCE(NULLIF(trim(value->>'dialog_scroll_max_height'), ''), '288')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'branding_preview_max_width', COALESCE(NULLIF(trim(value->>'branding_preview_max_width'), ''), '128'),
  'dialog_scroll_max_height', COALESCE(NULLIF(trim(value->>'dialog_scroll_max_height'), ''), '288')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
