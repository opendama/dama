-- Flutter events dialog shell metrics from DB chrome (no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'dialog_shell_max_height_ratio', COALESCE(NULLIF(trim(value->>'dialog_shell_max_height_ratio'), ''), '0.8'),
  'dialog_shell_max_width', COALESCE(NULLIF(trim(value->>'dialog_shell_max_width'), ''), '420'),
  'dialog_shell_inset_h', COALESCE(NULLIF(trim(value->>'dialog_shell_inset_h'), ''), '16'),
  'dialog_shell_inset_v', COALESCE(NULLIF(trim(value->>'dialog_shell_inset_v'), ''), '24')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'dialog_shell_max_height_ratio', COALESCE(NULLIF(trim(value->>'dialog_shell_max_height_ratio'), ''), '0.8'),
  'dialog_shell_max_width', COALESCE(NULLIF(trim(value->>'dialog_shell_max_width'), ''), '360'),
  'dialog_shell_inset_h', COALESCE(NULLIF(trim(value->>'dialog_shell_inset_h'), ''), '16'),
  'dialog_shell_inset_v', COALESCE(NULLIF(trim(value->>'dialog_shell_inset_v'), ''), '24')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
