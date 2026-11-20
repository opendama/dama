-- Bulk round official-pause + admin live-boards chrome (soft-fill, idempotent).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'bulk_pause_action', COALESCE(
    NULLIF(trim(value->>'bulk_pause_action'), ''),
    'Pause round'
  ),
  'bulk_pause_pending', COALESCE(
    NULLIF(trim(value->>'bulk_pause_pending'), ''),
    'Pausing round…'
  ),
  'bulk_confirm_title', COALESCE(
    NULLIF(trim(value->>'bulk_confirm_title'), ''),
    'Pause all live boards in this round?'
  ),
  'bulk_confirm_description', COALESCE(
    NULLIF(trim(value->>'bulk_confirm_description'), ''),
    'Each live board in the selected round will be officially paused with the same reason. Boards already officially paused are skipped. Confirm carefully.'
  ),
  'bulk_confirm', COALESCE(
    NULLIF(trim(value->>'bulk_confirm'), ''),
    'Pause round'
  ),
  'toast_bulk_paused', COALESCE(
    NULLIF(trim(value->>'toast_bulk_paused'), ''),
    'Paused {ok} board(s)'
  ),
  'toast_bulk_partial', COALESCE(
    NULLIF(trim(value->>'toast_bulk_partial'), ''),
    'Paused {ok}; skipped {skipped}; failed {failed}'
  ),
  'toast_bulk_failed', COALESCE(
    NULLIF(trim(value->>'toast_bulk_failed'), ''),
    'Could not pause the round'
  ),
  'live_boards_title', COALESCE(
    NULLIF(trim(value->>'live_boards_title'), ''),
    'Live boards'
  ),
  'live_boards_blurb', COALESCE(
    NULLIF(trim(value->>'live_boards_blurb'), ''),
    'All unfinished boards you can officially pause. Filter to officially paused only when needed.'
  ),
  'kpi_live_official_paused', COALESCE(
    NULLIF(trim(value->>'kpi_live_official_paused'), ''),
    'Officially paused now'
  ),
  'err_bulk_round_invalid', COALESCE(
    NULLIF(trim(value->>'err_bulk_round_invalid'), ''),
    'Round is required'
  ),
  'err_bulk_empty', COALESCE(
    NULLIF(trim(value->>'err_bulk_empty'), ''),
    'No live boards in this round'
  ),
  'copy_game_id_action', COALESCE(
    NULLIF(trim(value->>'copy_game_id_action'), ''),
    'Copy match id'
  ),
  'toast_copied_game_id', COALESCE(
    NULLIF(trim(value->>'toast_copied_game_id'), ''),
    'Match id copied'
  ),
  'col_last_action', COALESCE(
    NULLIF(trim(value->>'col_last_action'), ''),
    'Last action'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
