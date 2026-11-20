-- Organizer "My hosted tournaments" OpsDataTable selection + row-actions chrome.
-- Heal-only. Mirrors ads/campaigns + admin events selection pattern.
-- No delete keys: hosted events have no DELETE API.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'select_all_label',
  COALESCE(NULLIF(trim(value->>'select_all_label'), ''), 'Select all'),
  'select_row_label',
  COALESCE(NULLIF(trim(value->>'select_row_label'), ''), 'Select row'),
  'selected_count_fmt',
  COALESCE(NULLIF(trim(value->>'selected_count_fmt'), ''), '{count} selected'),
  'clear_selection_action',
  COALESCE(NULLIF(trim(value->>'clear_selection_action'), ''), 'Clear selection'),
  'row_actions_label',
  COALESCE(NULLIF(trim(value->>'row_actions_label'), ''), 'Row actions'),
  'bulk_close_action',
  COALESCE(NULLIF(trim(value->>'bulk_close_action'), ''), 'Close selected'),
  'bulk_reopen_action',
  COALESCE(NULLIF(trim(value->>'bulk_reopen_action'), ''), 'Reopen selected'),
  'bulk_action_pending',
  COALESCE(NULLIF(trim(value->>'bulk_action_pending'), ''), 'Working…')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
