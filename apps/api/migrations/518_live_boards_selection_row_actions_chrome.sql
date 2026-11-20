-- Live boards OpsDataTable selection + row-actions menu chrome (soft-fill, idempotent).
-- ASCII only. Selection bulk pause/resume uses game_ids on existing bulk endpoints.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'actions_menu_label', COALESCE(
    NULLIF(trim(value->>'actions_menu_label'), ''),
    'Row actions'
  ),
  'select_all_label', COALESCE(
    NULLIF(trim(value->>'select_all_label'), ''),
    'Select all'
  ),
  'select_row_label', COALESCE(
    NULLIF(trim(value->>'select_row_label'), ''),
    'Select row'
  ),
  'selected_count_fmt', COALESCE(
    NULLIF(trim(value->>'selected_count_fmt'), ''),
    '{count} selected'
  ),
  'clear_selection_action', COALESCE(
    NULLIF(trim(value->>'clear_selection_action'), ''),
    'Clear selection'
  ),
  'bulk_selected_pause_action', COALESCE(
    NULLIF(trim(value->>'bulk_selected_pause_action'), ''),
    'Pause selected'
  ),
  'bulk_selected_pause_pending', COALESCE(
    NULLIF(trim(value->>'bulk_selected_pause_pending'), ''),
    'Pausing selected...'
  ),
  'bulk_selected_confirm_title', COALESCE(
    NULLIF(trim(value->>'bulk_selected_confirm_title'), ''),
    'Pause selected boards?'
  ),
  'bulk_selected_confirm_description', COALESCE(
    NULLIF(trim(value->>'bulk_selected_confirm_description'), ''),
    'Each selected live board will be officially paused with the same reason. Boards already officially paused are skipped.'
  ),
  'bulk_selected_confirm', COALESCE(
    NULLIF(trim(value->>'bulk_selected_confirm'), ''),
    'Pause selected'
  ),
  'bulk_selected_resume_action', COALESCE(
    NULLIF(trim(value->>'bulk_selected_resume_action'), ''),
    'Resume selected'
  ),
  'bulk_selected_resume_pending', COALESCE(
    NULLIF(trim(value->>'bulk_selected_resume_pending'), ''),
    'Resuming selected...'
  ),
  'bulk_selected_resume_confirm_title', COALESCE(
    NULLIF(trim(value->>'bulk_selected_resume_confirm_title'), ''),
    'Resume selected boards?'
  ),
  'bulk_selected_resume_confirm_description', COALESCE(
    NULLIF(trim(value->>'bulk_selected_resume_confirm_description'), ''),
    'Each selected officially paused board will be resumed. Boards that are not paused are skipped.'
  ),
  'bulk_selected_resume_confirm', COALESCE(
    NULLIF(trim(value->>'bulk_selected_resume_confirm'), ''),
    'Resume selected'
  ),
  'toast_bulk_resumed', COALESCE(
    NULLIF(trim(value->>'toast_bulk_resumed'), ''),
    'Resumed {ok} board(s)'
  ),
  'toast_bulk_resume_partial', COALESCE(
    NULLIF(trim(value->>'toast_bulk_resume_partial'), ''),
    'Resumed {ok}; skipped {skipped}; failed {failed}'
  ),
  'toast_bulk_resume_failed', COALESCE(
    NULLIF(trim(value->>'toast_bulk_resume_failed'), ''),
    'Could not resume selected boards'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
