-- Multi-format hosted events (RR / Swiss / groups→KO), result-card chrome, player payout history chrome.
-- Fail-closed: engines read format codes + catalog rules from platform_settings only.

-- Bracket phase / group for RR, Swiss, and groups→knockout.
ALTER TABLE hosted_event_bracket_matches
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS group_index INT NOT NULL DEFAULT -1;

-- PG truncates long constraint names to 63 chars.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'hosted_event_bracket_matches'::regclass
      AND contype = 'u'
      AND conname LIKE 'hosted_event_bracket_matches_event_id_round_index_match%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE hosted_event_bracket_matches DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'hosted_event_bracket_matches'::regclass
        AND contype = 'u'
        AND conname LIKE 'hosted_event_bracket_matches_event_id_round_index_match%'
      LIMIT 1
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hosted_event_bracket_phase_group_round_match
  ON hosted_event_bracket_matches (event_id, phase, group_index, round_index, match_index);

CREATE INDEX IF NOT EXISTS idx_hosted_event_bracket_phase
  ON hosted_event_bracket_matches (event_id, phase, group_index);

-- Existing knockout rows (pre-phase column) become phase knockout.
UPDATE hosted_event_bracket_matches
SET phase = 'knockout'
WHERE trim(phase) = '';

-- client_enums: format id keys + bracket phases (no invent in Go).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'hosted_event_round_robin_format', COALESCE(NULLIF(trim(value->>'hosted_event_round_robin_format'), ''), 'round_robin'),
  'hosted_event_swiss_format', COALESCE(NULLIF(trim(value->>'hosted_event_swiss_format'), ''), 'swiss'),
  'hosted_event_groups_knockout_format', COALESCE(NULLIF(trim(value->>'hosted_event_groups_knockout_format'), ''), 'groups_knockout'),
  'hosted_event_bracket_phases', COALESCE(value->'hosted_event_bracket_phases', '["knockout","round_robin","swiss","group"]'::jsonb),
  'hosted_event_phase_knockout', COALESCE(NULLIF(trim(value->>'hosted_event_phase_knockout'), ''), 'knockout'),
  'hosted_event_phase_round_robin', COALESCE(NULLIF(trim(value->>'hosted_event_phase_round_robin'), ''), 'round_robin'),
  'hosted_event_phase_swiss', COALESCE(NULLIF(trim(value->>'hosted_event_phase_swiss'), ''), 'swiss'),
  'hosted_event_phase_group', COALESCE(NULLIF(trim(value->>'hosted_event_phase_group'), ''), 'group')
),
    updated_at = NOW()
WHERE key = 'client_enums';

-- Catalog rules for Swiss rounds and groups→KO (admin-editable via catalog JSON).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'swiss_rounds_by_max_players', COALESCE(
    value->'swiss_rounds_by_max_players',
    '{"8":3,"16":4,"32":5,"64":6}'::jsonb
  ),
  'groups_knockout_target_group_size', COALESCE(
    NULLIF(value->>'groups_knockout_target_group_size', '')::int,
    4
  ),
  'groups_knockout_advance_per_group', COALESCE(
    NULLIF(value->>'groups_knockout_advance_per_group', '')::int,
    2
  )
),
    updated_at = NOW()
WHERE key = 'events_catalog';

-- Allow round_robin on size_8 (small groups); dedupe ids.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sizes}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'id' = 'size_8' THEN
          elem || jsonb_build_object(
            'allowed_format_ids',
            (
              SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
              FROM (
                SELECT DISTINCT trim(x) AS x
                FROM jsonb_array_elements_text(
                  COALESCE(elem->'allowed_format_ids', '[]'::jsonb) || '["round_robin"]'::jsonb
                ) AS x
                WHERE trim(x) <> ''
              ) d
            )
          )
        ELSE elem
      END
      ORDER BY (elem->>'sort_order')::int NULLS LAST
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) AS elem
  )
),
    updated_at = NOW()
WHERE key = 'events_catalog';

-- Organizer chrome: standings + richer result card share.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'standings_title', COALESCE(NULLIF(trim(value->>'standings_title'), ''), 'Standings'),
  'standings_played_label', COALESCE(NULLIF(trim(value->>'standings_played_label'), ''), 'P'),
  'standings_wins_label', COALESCE(NULLIF(trim(value->>'standings_wins_label'), ''), 'W'),
  'standings_losses_label', COALESCE(NULLIF(trim(value->>'standings_losses_label'), ''), 'L'),
  'standings_points_label', COALESCE(NULLIF(trim(value->>'standings_points_label'), ''), 'Pts'),
  'group_label_template', COALESCE(NULLIF(trim(value->>'group_label_template'), ''), 'Group {n}'),
  'swiss_round_label_template', COALESCE(NULLIF(trim(value->>'swiss_round_label_template'), ''), 'Round {n}'),
  'result_card_share_image_action', COALESCE(NULLIF(trim(value->>'result_card_share_image_action'), ''), 'Share result card image'),
  'result_card_download_action', COALESCE(NULLIF(trim(value->>'result_card_download_action'), ''), 'Download result card'),
  'result_card_image_failed', COALESCE(NULLIF(trim(value->>'result_card_image_failed'), ''), 'Could not build result card image'),
  'result_card_sponsor_prefix', COALESCE(NULLIF(trim(value->>'result_card_sponsor_prefix'), ''), 'Sponsored by'),
  'phase_group_label', COALESCE(NULLIF(trim(value->>'phase_group_label'), ''), 'Group stage'),
  'phase_knockout_label', COALESCE(NULLIF(trim(value->>'phase_knockout_label'), ''), 'Knockout'),
  'admin_formats_blurb', COALESCE(NULLIF(trim(value->>'admin_formats_blurb'), ''), 'Enable formats organizers may pick. Engines run only for enabled formats.')
),
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'standings_title', COALESCE(NULLIF(trim(value->>'standings_title'), ''), 'Standings'),
  'standings_played_label', COALESCE(NULLIF(trim(value->>'standings_played_label'), ''), 'P'),
  'standings_wins_label', COALESCE(NULLIF(trim(value->>'standings_wins_label'), ''), 'W'),
  'standings_losses_label', COALESCE(NULLIF(trim(value->>'standings_losses_label'), ''), 'L'),
  'standings_points_label', COALESCE(NULLIF(trim(value->>'standings_points_label'), ''), 'Pts'),
  'group_label_template', COALESCE(NULLIF(trim(value->>'group_label_template'), ''), 'Group {n}'),
  'swiss_round_label_template', COALESCE(NULLIF(trim(value->>'swiss_round_label_template'), ''), 'Round {n}'),
  'result_card_share_image_action', COALESCE(NULLIF(trim(value->>'result_card_share_image_action'), ''), 'Share result card image'),
  'result_card_download_action', COALESCE(NULLIF(trim(value->>'result_card_download_action'), ''), 'Download result card'),
  'result_card_image_failed', COALESCE(NULLIF(trim(value->>'result_card_image_failed'), ''), 'Could not build result card image'),
  'result_card_sponsor_prefix', COALESCE(NULLIF(trim(value->>'result_card_sponsor_prefix'), ''), 'Sponsored by'),
  'phase_group_label', COALESCE(NULLIF(trim(value->>'phase_group_label'), ''), 'Group stage'),
  'phase_knockout_label', COALESCE(NULLIF(trim(value->>'phase_knockout_label'), ''), 'Knockout')
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'formats_engine_blurb', COALESCE(NULLIF(trim(value->>'formats_engine_blurb'), ''), 'Toggle formats on when ready. Organizers only see enabled formats. Knockout, round robin, Swiss, and groups to knockout are supported.'),
  'swiss_rounds_label', COALESCE(NULLIF(trim(value->>'swiss_rounds_label'), ''), 'Swiss rounds by max players'),
  'groups_size_label', COALESCE(NULLIF(trim(value->>'groups_size_label'), ''), 'Target group size'),
  'groups_advance_label', COALESCE(NULLIF(trim(value->>'groups_advance_label'), ''), 'Advance per group')
),
    updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- Wallet chrome: dedicated player payout history list.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'payout_history_title', COALESCE(NULLIF(trim(value->>'payout_history_title'), ''), 'Payout history'),
  'payout_history_empty', COALESCE(NULLIF(trim(value->>'payout_history_empty'), ''), 'No payout requests yet'),
  'payout_history_amount_label', COALESCE(NULLIF(trim(value->>'payout_history_amount_label'), ''), 'Amount'),
  'payout_history_status_label', COALESCE(NULLIF(trim(value->>'payout_history_status_label'), ''), 'Status'),
  'payout_history_date_label', COALESCE(NULLIF(trim(value->>'payout_history_date_label'), ''), 'Requested'),
  'payout_history_load_failed', COALESCE(NULLIF(trim(value->>'payout_history_load_failed'), ''), 'Could not load payout history'),
  'payout_history_page_size', COALESCE(NULLIF(trim(value->>'payout_history_page_size'), ''), '20')
),
    updated_at = NOW()
WHERE key = 'wallet_chrome';
