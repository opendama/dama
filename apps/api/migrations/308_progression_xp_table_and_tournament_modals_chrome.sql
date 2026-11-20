-- Progression: XP levels table/modal chrome + geo create-fee blurb.
-- Tournaments: OpsDataTable columns, create/edit/detail/delete modal chrome, search debounce.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'xp_col_label', COALESCE(NULLIF(trim(value->'progression'->>'xp_col_label'), ''), 'Level'),
    'xp_col_min_xp', COALESCE(NULLIF(trim(value->'progression'->>'xp_col_min_xp'), ''), 'Min XP'),
    'xp_actions_label', COALESCE(NULLIF(trim(value->'progression'->>'xp_actions_label'), ''), 'Actions'),
    'xp_add_action', COALESCE(NULLIF(trim(value->'progression'->>'xp_add_action'), ''), 'Add level'),
    'xp_view_action', COALESCE(NULLIF(trim(value->'progression'->>'xp_view_action'), ''), 'View details'),
    'xp_edit_action', COALESCE(NULLIF(trim(value->'progression'->>'xp_edit_action'), ''), 'Edit'),
    'xp_delete_action', COALESCE(NULLIF(trim(value->'progression'->>'xp_delete_action'), ''), 'Delete'),
    'xp_empty', COALESCE(NULLIF(trim(value->'progression'->>'xp_empty'), ''), 'No XP levels yet.'),
    'xp_dialog_close_label', COALESCE(NULLIF(trim(value->'progression'->>'xp_dialog_close_label'), ''), 'Close'),
    'xp_cancel_action', COALESCE(NULLIF(trim(value->'progression'->>'xp_cancel_action'), ''), 'Cancel'),
    'xp_save_action', COALESCE(NULLIF(trim(value->'progression'->>'xp_save_action'), ''), 'Save level'),
    'xp_save_pending', COALESCE(NULLIF(trim(value->'progression'->>'xp_save_pending'), ''), 'Saving…'),
    'xp_create_modal_title', COALESCE(NULLIF(trim(value->'progression'->>'xp_create_modal_title'), ''), 'Add XP level'),
    'xp_edit_modal_title', COALESCE(NULLIF(trim(value->'progression'->>'xp_edit_modal_title'), ''), 'Edit XP level'),
    'xp_detail_modal_title', COALESCE(NULLIF(trim(value->'progression'->>'xp_detail_modal_title'), ''), 'XP level details'),
    'xp_delete_confirm', COALESCE(NULLIF(trim(value->'progression'->>'xp_delete_confirm'), ''), 'Remove this XP level from the ladder?'),
    'xp_label_field', COALESCE(NULLIF(trim(value->'progression'->>'xp_label_field'), ''), 'Label'),
    'xp_min_xp_field', COALESCE(NULLIF(trim(value->'progression'->>'xp_min_xp_field'), ''), 'Minimum XP'),
    'campaign_create_fee_geo_blurb', COALESCE(
      NULLIF(trim(value->'progression'->>'campaign_create_fee_geo_blurb'), ''),
      'Amount is charged in the publisher regional wallet currency: {ethiopia} in Ethiopia, {global} elsewhere.'
    )
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'actions_label', COALESCE(NULLIF(trim(value->>'actions_label'), ''), 'Actions'),
  'col_title', COALESCE(NULLIF(trim(value->>'col_title'), ''), 'Tournament'),
  'col_entry', COALESCE(NULLIF(trim(value->>'col_entry'), ''), 'Entry'),
  'col_status', COALESCE(NULLIF(trim(value->>'col_status'), ''), 'Status'),
  'col_prize', COALESCE(NULLIF(trim(value->>'col_prize'), ''), 'Prize pool'),
  'col_actions', COALESCE(NULLIF(trim(value->>'col_actions'), ''), 'Actions'),
  'view_detail_action', COALESCE(NULLIF(trim(value->>'view_detail_action'), ''), 'View details'),
  'edit_action', COALESCE(NULLIF(trim(value->>'edit_action'), ''), 'Edit'),
  'delete_action', COALESCE(NULLIF(trim(value->>'delete_action'), ''), 'Delete'),
  'cancel_action', COALESCE(NULLIF(trim(value->>'cancel_action'), ''), 'Cancel'),
  'dialog_close_label', COALESCE(NULLIF(trim(value->>'dialog_close_label'), ''), 'Close'),
  'save_action', COALESCE(NULLIF(trim(value->>'save_action'), ''), 'Save'),
  'save_pending', COALESCE(NULLIF(trim(value->>'save_pending'), ''), 'Saving…'),
  'create_modal_title', COALESCE(NULLIF(trim(value->>'create_modal_title'), ''), 'Create tournament'),
  'edit_modal_title', COALESCE(NULLIF(trim(value->>'edit_modal_title'), ''), 'Edit tournament'),
  'detail_modal_title', COALESCE(NULLIF(trim(value->>'detail_modal_title'), ''), 'Tournament details'),
  'detail_close_label', COALESCE(NULLIF(trim(value->>'detail_close_label'), ''), 'Close'),
  'delete_confirm', COALESCE(NULLIF(trim(value->>'delete_confirm'), ''), 'Delete this tournament? Entries will be removed.'),
  'toast_updated', COALESCE(NULLIF(trim(value->>'toast_updated'), ''), 'Tournament updated'),
  'toast_update_failed', COALESCE(NULLIF(trim(value->>'toast_update_failed'), ''), 'Unable to update tournament'),
  'toast_deleted', COALESCE(NULLIF(trim(value->>'toast_deleted'), ''), 'Tournament deleted'),
  'toast_delete_failed', COALESCE(NULLIF(trim(value->>'toast_delete_failed'), ''), 'Unable to delete tournament'),
  'err_update_failed', COALESCE(NULLIF(trim(value->>'err_update_failed'), ''), 'Unable to update tournament'),
  'err_delete_failed', COALESCE(NULLIF(trim(value->>'err_delete_failed'), ''), 'Unable to delete tournament'),
  'search_debounce_ms', COALESCE(NULLIF(trim(value->>'search_debounce_ms'), ''), '250'),
  'status_field_label', COALESCE(NULLIF(trim(value->>'status_field_label'), ''), 'Status'),
  'created_at_label', COALESCE(NULLIF(trim(value->>'created_at_label'), ''), 'Created'),
  'empty_list', COALESCE(NULLIF(trim(value->>'empty_list'), ''), 'No tournaments yet.')
),
  updated_at = NOW()
WHERE key = 'tournament_chrome';
