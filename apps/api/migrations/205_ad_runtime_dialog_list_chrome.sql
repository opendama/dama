-- Ensure ads publisher dialog/list chrome keys exist and are served via schedule_chrome.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'cancel_action', COALESCE(NULLIF(trim(value->>'cancel_action'), ''), 'Cancel'),
  'dialog_close_label', COALESCE(NULLIF(trim(value->>'dialog_close_label'), ''), 'Close'),
  'search_campaigns_label', COALESCE(NULLIF(trim(value->>'search_campaigns_label'), ''), 'Search'),
  'search_campaigns_placeholder', COALESCE(NULLIF(trim(value->>'search_campaigns_placeholder'), ''), 'Search by title, status, or creative…'),
  'filter_status_label', COALESCE(NULLIF(trim(value->>'filter_status_label'), ''), 'Status'),
  'filter_status_all', COALESCE(NULLIF(trim(value->>'filter_status_all'), ''), 'All statuses'),
  'view_action', COALESCE(NULLIF(trim(value->>'view_action'), ''), 'View')
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
