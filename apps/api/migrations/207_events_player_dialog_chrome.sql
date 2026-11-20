-- Player report/join dialogs: dedicated close + cancel labels (no empty invent).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'dialog_close_label', COALESCE(NULLIF(trim(value->>'dialog_close_label'), ''), 'Close'),
  'cancel_action', COALESCE(NULLIF(trim(value->>'cancel_action'), ''), 'Cancel')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
