-- RBAC / users / telemetry OpsDataTable selection + view/dialog chrome.
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'select_all_label', COALESCE(NULLIF(trim(value->>'select_all_label'), ''), 'Select all'),
    'select_row_label', COALESCE(NULLIF(trim(value->>'select_row_label'), ''), 'Select row'),
    'selected_count_fmt', COALESCE(NULLIF(trim(value->>'selected_count_fmt'), ''), '{count} selected'),
    'clear_selection_action', COALESCE(NULLIF(trim(value->>'clear_selection_action'), ''), 'Clear selection'),
    'view_action', COALESCE(NULLIF(trim(value->>'view_action'), ''), 'View details'),
    'edit_action', COALESCE(NULLIF(trim(value->>'edit_action'), ''), 'Edit'),
    'add_permission_action', COALESCE(NULLIF(trim(value->>'add_permission_action'), ''), 'Add permission'),
    'dialog_close_label', COALESCE(NULLIF(trim(value->>'dialog_close_label'), ''), 'Close'),
    'cancel_action', COALESCE(NULLIF(trim(value->>'cancel_action'), ''), 'Cancel'),
    'row_actions_label', COALESCE(NULLIF(trim(value->>'row_actions_label'), ''), 'Row actions'),
    'search_placeholder', COALESCE(NULLIF(trim(value->>'search_placeholder'), ''), 'Search permissions'),
    'detail_title', COALESCE(NULLIF(trim(value->>'detail_title'), ''), 'Permission details')
  ),
  updated_at = NOW()
WHERE key = 'rbac_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{users}',
    COALESCE(value->'users', '{}'::jsonb) || jsonb_build_object(
      'view_detail_action', COALESCE(NULLIF(trim(value->'users'->>'view_detail_action'), ''), 'View details'),
      'dialog_close_label', COALESCE(NULLIF(trim(value->'users'->>'dialog_close_label'), ''), 'Close'),
      'cancel_action', COALESCE(NULLIF(trim(value->'users'->>'cancel_action'), ''), 'Cancel'),
      'detail_title', COALESCE(NULLIF(trim(value->'users'->>'detail_title'), ''), 'User details'),
      'col_email_label', COALESCE(NULLIF(trim(value->'users'->>'col_email_label'), ''), 'Email'),
      'col_xp_label', COALESCE(NULLIF(trim(value->'users'->>'col_xp_label'), ''), 'XP'),
      'col_rating_label', COALESCE(NULLIF(trim(value->'users'->>'col_rating_label'), ''), 'Rating'),
      'col_draws_label', COALESCE(NULLIF(trim(value->'users'->>'col_draws_label'), ''), 'Draws'),
      'col_created_label', COALESCE(NULLIF(trim(value->'users'->>'col_created_label'), ''), 'Created'),
      'search_placeholder', COALESCE(NULLIF(trim(value->'users'->>'search_placeholder'), ''), 'Search users')
    )
  ),
  '{telemetry}',
  COALESCE(value->'telemetry', '{}'::jsonb) || jsonb_build_object(
    'view_detail_action', COALESCE(NULLIF(trim(value->'telemetry'->>'view_detail_action'), ''), 'View details'),
    'dialog_close_label', COALESCE(NULLIF(trim(value->'telemetry'->>'dialog_close_label'), ''), 'Close'),
    'cancel_action', COALESCE(NULLIF(trim(value->'telemetry'->>'cancel_action'), ''), 'Cancel'),
    'col_user', COALESCE(NULLIF(trim(value->'telemetry'->>'col_user'), ''), 'User'),
    'col_fingerprint', COALESCE(NULLIF(trim(value->'telemetry'->>'col_fingerprint'), ''), 'Fingerprint'),
    'col_platform', COALESCE(NULLIF(trim(value->'telemetry'->>'col_platform'), ''), 'Platform'),
    'col_ip', COALESCE(NULLIF(trim(value->'telemetry'->>'col_ip'), ''), 'IP'),
    'col_seen', COALESCE(NULLIF(trim(value->'telemetry'->>'col_seen'), ''), 'Last seen'),
    'col_country', COALESCE(NULLIF(trim(value->'telemetry'->>'col_country'), ''), 'Country'),
    'col_region', COALESCE(NULLIF(trim(value->'telemetry'->>'col_region'), ''), 'Region'),
    'col_city', COALESCE(NULLIF(trim(value->'telemetry'->>'col_city'), ''), 'City'),
    'col_source', COALESCE(NULLIF(trim(value->'telemetry'->>'col_source'), ''), 'Source'),
    'col_coords', COALESCE(NULLIF(trim(value->'telemetry'->>'col_coords'), ''), 'Coordinates'),
    'col_when', COALESCE(NULLIF(trim(value->'telemetry'->>'col_when'), ''), 'When'),
    'col_action', COALESCE(NULLIF(trim(value->'telemetry'->>'col_action'), ''), 'Action'),
    'col_entity', COALESCE(NULLIF(trim(value->'telemetry'->>'col_entity'), ''), 'Entity'),
    'col_actor', COALESCE(NULLIF(trim(value->'telemetry'->>'col_actor'), ''), 'Actor'),
    'fp_detail_title', COALESCE(NULLIF(trim(value->'telemetry'->>'fp_detail_title'), ''), 'Fingerprint details'),
    'geo_detail_title', COALESCE(NULLIF(trim(value->'telemetry'->>'geo_detail_title'), ''), 'Geo details'),
    'audit_detail_title', COALESCE(NULLIF(trim(value->'telemetry'->>'audit_detail_title'), ''), 'Audit details'),
    'search_placeholder', COALESCE(NULLIF(trim(value->'telemetry'->>'search_placeholder'), ''), 'Search')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
