-- Dialog loading height + branding preview height from DB chrome (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'dialog_shell_loading_height', COALESCE(NULLIF(trim(value->>'dialog_shell_loading_height'), ''), '96'),
  'branding_preview_height', COALESCE(NULLIF(trim(value->>'branding_preview_height'), ''), '72')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'dialog_shell_loading_height', COALESCE(NULLIF(trim(value->>'dialog_shell_loading_height'), ''), '96'),
  'branding_preview_height', COALESCE(NULLIF(trim(value->>'branding_preview_height'), ''), '56')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
