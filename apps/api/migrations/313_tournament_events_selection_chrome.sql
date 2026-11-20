-- Selection chrome on dedicated tournament/events settings rows (not admin_console_chrome nested).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'select_all_label', COALESCE(NULLIF(trim(value->>'select_all_label'), ''), 'Select all'),
  'select_row_label', COALESCE(NULLIF(trim(value->>'select_row_label'), ''), 'Select row'),
  'selected_count_fmt', COALESCE(NULLIF(trim(value->>'selected_count_fmt'), ''), '{count} selected'),
  'clear_selection_action', COALESCE(NULLIF(trim(value->>'clear_selection_action'), ''), 'Clear selection')
),
  updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'select_all_label', COALESCE(NULLIF(trim(value->>'select_all_label'), ''), 'Select all'),
  'select_row_label', COALESCE(NULLIF(trim(value->>'select_row_label'), ''), 'Select row'),
  'selected_count_fmt', COALESCE(NULLIF(trim(value->>'selected_count_fmt'), ''), '{count} selected'),
  'clear_selection_action', COALESCE(NULLIF(trim(value->>'clear_selection_action'), ''), 'Clear selection')
),
  updated_at = NOW()
WHERE key = 'events_admin_chrome';
