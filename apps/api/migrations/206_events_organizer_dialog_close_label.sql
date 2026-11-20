-- Events organizer dialogs: dedicated close label (do not reuse cancel_action / "Cancel event").
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'dialog_close_label', COALESCE(NULLIF(trim(value->>'dialog_close_label'), ''), 'Close')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';
