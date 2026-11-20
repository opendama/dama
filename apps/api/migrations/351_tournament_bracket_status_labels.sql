-- Tournament bracket display labels + player play error chrome (mirrors hosted bracket labels).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{tournament_bracket_status_labels}',
  COALESCE(value->'tournament_bracket_status_labels', '{}'::jsonb) || '{
    "pending": "Pending",
    "ready": "Ready",
    "live": "Live",
    "done": "Done",
    "bye": "Bye"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_tournament_not_found', COALESCE(NULLIF(trim(value->>'err_tournament_not_found'), ''), 'Tournament not found'),
  'err_bracket_failed', COALESCE(NULLIF(trim(value->>'err_bracket_failed'), ''), 'Unable to load bracket'),
  'err_bracket_exists', COALESCE(NULLIF(trim(value->>'err_bracket_exists'), ''), 'Bracket already exists'),
  'err_start_failed', COALESCE(NULLIF(trim(value->>'err_start_failed'), ''), 'Unable to start cup'),
  'err_match_not_found', COALESCE(NULLIF(trim(value->>'err_match_not_found'), ''), 'Match not found'),
  'err_match_not_ready', COALESCE(NULLIF(trim(value->>'err_match_not_ready'), ''), 'Match is not ready'),
  'err_players_missing', COALESCE(NULLIF(trim(value->>'err_players_missing'), ''), 'Players missing'),
  'err_cup_already_started', COALESCE(NULLIF(trim(value->>'err_cup_already_started'), ''), 'Cup already started'),
  'err_not_enrolled', COALESCE(NULLIF(trim(value->>'err_not_enrolled'), ''), 'Not enrolled in this cup'),
  'err_check_in_closed', COALESCE(NULLIF(trim(value->>'check_in_closed'), ''), 'Check-in is closed.'),
  'err_check_in_not_open', COALESCE(NULLIF(trim(value->>'check_in_not_open'), ''), 'Check-in is not open yet.')
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_cup_already_started', COALESCE(NULLIF(trim(value->>'err_cup_already_started'), ''), 'Cup already started'),
  'err_bracket_exists', COALESCE(NULLIF(trim(value->>'err_bracket_exists'), ''), 'Bracket already exists'),
  'err_start_failed', COALESCE(NULLIF(trim(value->>'err_start_failed'), ''), 'Unable to start cup')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
