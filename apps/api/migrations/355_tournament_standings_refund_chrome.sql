-- Tournament standings table chrome, archive refund ledger kind, console start copy (idempotent).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{wallet_ledger_kinds}',
  (
    SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(value->'wallet_ledger_kinds', '[]'::jsonb)) AS x
      UNION
      SELECT unnest(ARRAY['tournament_entry_refund'])
    ) k
  )
),
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_kind_tournament_entry_refund', COALESCE(NULLIF(trim(value->>'list_kind_tournament_entry_refund'), ''), 'Tournament entry refund')
),
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
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
SET value = value || jsonb_build_object(
  'not_enough_players', COALESCE(NULLIF(trim(value->>'not_enough_players'), ''), 'Not enough checked-in players to start'),
  'err_refund_failed', COALESCE(NULLIF(trim(value->>'err_refund_failed'), ''), 'Unable to refund entry fees')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
