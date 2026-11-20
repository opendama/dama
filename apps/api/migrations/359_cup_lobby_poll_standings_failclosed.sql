-- Cup lobby bracket poll interval + standings fail-closed chrome (idempotent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'lobby_poll_interval_ms', COALESCE(NULLIF(trim(value->>'lobby_poll_interval_ms'), ''), '8000'),
  'standings_title', COALESCE(NULLIF(trim(value->>'standings_title'), ''), 'Standings'),
  'standings_played_label', COALESCE(NULLIF(trim(value->>'standings_played_label'), ''), 'Played'),
  'standings_wins_label', COALESCE(NULLIF(trim(value->>'standings_wins_label'), ''), 'Wins'),
  'standings_losses_label', COALESCE(NULLIF(trim(value->>'standings_losses_label'), ''), 'Losses'),
  'standings_points_label', COALESCE(NULLIF(trim(value->>'standings_points_label'), ''), 'Pts'),
  'standings_table_min_width', COALESCE(NULLIF(trim(value->>'standings_table_min_width'), ''), '480'),
  'group_label_template', COALESCE(NULLIF(trim(value->>'group_label_template'), ''), 'Group {n}')
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'lobby_poll_interval_ms', COALESCE(NULLIF(trim(value->>'lobby_poll_interval_ms'), ''), '8000')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'not_enough_players', COALESCE(NULLIF(trim(value->>'not_enough_players'), ''), 'Not enough checked-in players to start'),
  'err_refund_failed', COALESCE(NULLIF(trim(value->>'err_refund_failed'), ''), 'Unable to refund entry fees'),
  'err_forfeit_failed', COALESCE(NULLIF(trim(value->>'err_forfeit_failed'), ''), 'Unable to forfeit match'),
  'err_match_not_found', COALESCE(NULLIF(trim(value->>'err_match_not_found'), ''), 'Match not found'),
  'err_match_not_ready', COALESCE(NULLIF(trim(value->>'err_match_not_ready'), ''), 'Match is not ready')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
