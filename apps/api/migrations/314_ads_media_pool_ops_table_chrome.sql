-- Console ads + media-pool OpsDataTable selection / view chrome (Trim parity).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'select_all_label', COALESCE(NULLIF(trim(value->>'select_all_label'), ''), 'Select all'),
    'select_row_label', COALESCE(NULLIF(trim(value->>'select_row_label'), ''), 'Select row'),
    'selected_count_fmt', COALESCE(NULLIF(trim(value->>'selected_count_fmt'), ''), '{count} selected'),
    'clear_selection_action', COALESCE(NULLIF(trim(value->>'clear_selection_action'), ''), 'Clear selection'),
    'edit_action', COALESCE(NULLIF(trim(value->>'edit_action'), ''), 'Edit schedule')
  ),
  updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value,
      '{media_pool}',
      COALESCE(value->'media_pool', '{}'::jsonb) || jsonb_build_object(
        'view_detail_action', COALESCE(NULLIF(trim(value->'media_pool'->>'view_detail_action'), ''), 'View details'),
        'dialog_close_label', COALESCE(NULLIF(trim(value->'media_pool'->>'dialog_close_label'), ''), 'Close'),
        'cancel_action', COALESCE(NULLIF(trim(value->'media_pool'->>'cancel_action'), ''), 'Cancel'),
        'search_placeholder', COALESCE(NULLIF(trim(value->'media_pool'->>'search_placeholder'), ''), 'Search channels'),
        'col_channel_id', COALESCE(NULLIF(trim(value->'media_pool'->>'col_channel_id'), ''), 'Channel ID'),
        'col_quota', COALESCE(NULLIF(trim(value->'media_pool'->>'col_quota'), ''), 'Quota'),
        'col_status', COALESCE(NULLIF(trim(value->'media_pool'->>'col_status'), ''), 'Status'),
        'detail_title', COALESCE(NULLIF(trim(value->'media_pool'->>'detail_title'), ''), 'Channel details'),
        'last_error_label', COALESCE(NULLIF(trim(value->'media_pool'->>'last_error_label'), ''), 'Last error')
      )
    ),
    '{banks}',
    COALESCE(value->'banks', '{}'::jsonb) || jsonb_build_object(
      'col_provider', COALESCE(NULLIF(trim(value->'banks'->>'col_provider'), ''), 'Provider'),
      'col_currency', COALESCE(NULLIF(trim(value->'banks'->>'col_currency'), ''), 'Currency'),
      'col_status', COALESCE(NULLIF(trim(value->'banks'->>'col_status'), ''), 'Status'),
      'view_detail_action', COALESCE(NULLIF(trim(value->'banks'->>'view_detail_action'), ''), 'View details'),
      'detail_title', COALESCE(NULLIF(trim(value->'banks'->>'detail_title'), ''), 'Bank details'),
      'search_label', COALESCE(NULLIF(trim(value->'banks'->>'search_label'), ''), 'Search'),
      'search_placeholder', COALESCE(NULLIF(trim(value->'banks'->>'search_placeholder'), ''), 'Search banks')
    )
  ),
  '{avatars}',
  COALESCE(value->'avatars', '{}'::jsonb) || jsonb_build_object(
    'view_detail_action', COALESCE(NULLIF(trim(value->'avatars'->>'view_detail_action'), ''), 'View details'),
    'dialog_close_label', COALESCE(NULLIF(trim(value->'avatars'->>'dialog_close_label'), ''), 'Close'),
    'cancel_action', COALESCE(NULLIF(trim(value->'avatars'->>'cancel_action'), ''), 'Cancel'),
    'detail_title', COALESCE(NULLIF(trim(value->'avatars'->>'detail_title'), ''), 'Avatar details'),
    'col_user', COALESCE(NULLIF(trim(value->'avatars'->>'col_user'), ''), 'User'),
    'col_rating', COALESCE(NULLIF(trim(value->'avatars'->>'col_rating'), ''), 'Rating'),
    'search_placeholder', COALESCE(NULLIF(trim(value->'avatars'->>'search_placeholder'), ''), 'Search users')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'select_all_label', COALESCE(NULLIF(trim(value->'progression'->>'select_all_label'), ''), 'Select all'),
    'select_row_label', COALESCE(NULLIF(trim(value->'progression'->>'select_row_label'), ''), 'Select row'),
    'selected_count_fmt', COALESCE(NULLIF(trim(value->'progression'->>'selected_count_fmt'), ''), '{count} selected'),
    'clear_selection_action', COALESCE(NULLIF(trim(value->'progression'->>'clear_selection_action'), ''), 'Clear selection'),
    'xp_search_label', COALESCE(NULLIF(trim(value->'progression'->>'xp_search_label'), ''), 'Search levels'),
    'xp_search_placeholder', COALESCE(NULLIF(trim(value->'progression'->>'xp_search_placeholder'), ''), 'Search XP levels')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
