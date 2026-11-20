-- Heal client_enums + events_catalog after destructive full-replace mig 013.
-- Soft-fill only. Split jsonb_build_object calls (Postgres max 100 args). Idempotent.

-- Core roles / statuses / creative / campaign
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'roles', COALESCE(value->'roles', '["player","ad_publisher","admin","superadmin"]'::jsonb),
  'console_roles', COALESCE(value->'console_roles', '["admin","superadmin"]'::jsonb),
  'publisher_roles', COALESCE(value->'publisher_roles', '["ad_publisher","advertiser"]'::jsonb),
  'default_role', COALESCE(NULLIF(trim(value->>'default_role'), ''), 'player'),
  'tournament_statuses', COALESCE(value->'tournament_statuses', '["draft","open","archived"]'::jsonb),
  'default_tournament_status', COALESCE(NULLIF(trim(value->>'default_tournament_status'), ''), 'draft'),
  'enrollable_tournament_status', COALESCE(NULLIF(trim(value->>'enrollable_tournament_status'), ''), 'open'),
  'campaign_statuses', COALESCE(value->'campaign_statuses', '["draft","active","paused","archived"]'::jsonb),
  'default_campaign_status', COALESCE(NULLIF(trim(value->>'default_campaign_status'), ''), 'draft'),
  'servable_campaign_status', COALESCE(NULLIF(trim(value->>'servable_campaign_status'), ''), 'active'),
  'archived_campaign_status', COALESCE(NULLIF(trim(value->>'archived_campaign_status'), ''), 'archived'),
  'reopen_campaign_status', COALESCE(NULLIF(trim(value->>'reopen_campaign_status'), ''), 'paused'),
  'creative_types', COALESCE(value->'creative_types', '["image","video"]'::jsonb),
  'default_creative_type', COALESCE(NULLIF(trim(value->>'default_creative_type'), ''), 'image'),
  'video_creative_type', COALESCE(NULLIF(trim(value->>'video_creative_type'), ''), 'video'),
  'ethiopia_payment_modes', COALESCE(
    value->'ethiopia_payment_modes',
    '[{"mode":"local_checkout","label":"Local gateway","enabled":true},{"mode":"manual_transfer","label":"Manual transfer","enabled":false}]'::jsonb
  ),
  'unavailable', COALESCE(NULLIF(trim(value->>'unavailable'), ''), 'client enums unavailable')
)),
    updated_at = NOW()
WHERE key = 'client_enums';

-- Hosted event statuses / formats / phases
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'hosted_event_statuses', COALESCE(value->'hosted_event_statuses', '["open","full","live","finished","cancelled"]'::jsonb),
  'hosted_event_default_status', COALESCE(NULLIF(trim(value->>'hosted_event_default_status'), ''), 'open'),
  'hosted_event_joinable_statuses', COALESCE(value->'hosted_event_joinable_statuses', '["open"]'::jsonb),
  'hosted_event_full_status', COALESCE(NULLIF(trim(value->>'hosted_event_full_status'), ''), 'full'),
  'hosted_event_live_status', COALESCE(NULLIF(trim(value->>'hosted_event_live_status'), ''), 'live'),
  'hosted_event_finished_status', COALESCE(NULLIF(trim(value->>'hosted_event_finished_status'), ''), 'finished'),
  'hosted_event_cancelled_status', COALESCE(NULLIF(trim(value->>'hosted_event_cancelled_status'), ''), 'cancelled'),
  'hosted_event_formats', COALESCE(value->'hosted_event_formats', '["knockout","round_robin","groups_knockout","swiss","arena"]'::jsonb),
  'hosted_event_default_format', COALESCE(NULLIF(trim(value->>'hosted_event_default_format'), ''), 'knockout'),
  'hosted_event_knockout_format', COALESCE(NULLIF(trim(value->>'hosted_event_knockout_format'), ''), 'knockout'),
  'hosted_event_round_robin_format', COALESCE(NULLIF(trim(value->>'hosted_event_round_robin_format'), ''), 'round_robin'),
  'hosted_event_swiss_format', COALESCE(NULLIF(trim(value->>'hosted_event_swiss_format'), ''), 'swiss'),
  'hosted_event_groups_knockout_format', COALESCE(NULLIF(trim(value->>'hosted_event_groups_knockout_format'), ''), 'groups_knockout'),
  'hosted_event_arena_format', COALESCE(NULLIF(trim(value->>'hosted_event_arena_format'), ''), 'arena'),
  'hosted_event_bracket_phases', COALESCE(value->'hosted_event_bracket_phases', '["knockout","round_robin","swiss","group","arena"]'::jsonb),
  'hosted_event_phase_knockout', COALESCE(NULLIF(trim(value->>'hosted_event_phase_knockout'), ''), 'knockout'),
  'hosted_event_phase_round_robin', COALESCE(NULLIF(trim(value->>'hosted_event_phase_round_robin'), ''), 'round_robin'),
  'hosted_event_phase_swiss', COALESCE(NULLIF(trim(value->>'hosted_event_phase_swiss'), ''), 'swiss'),
  'hosted_event_phase_group', COALESCE(NULLIF(trim(value->>'hosted_event_phase_group'), ''), 'group'),
  'hosted_event_phase_arena', COALESCE(NULLIF(trim(value->>'hosted_event_phase_arena'), ''), 'arena')
)),
    updated_at = NOW()
WHERE key = 'client_enums';

-- Hosted entry / bracket / visibility / report + tournament formats
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'hosted_event_entry_statuses', COALESCE(value->'hosted_event_entry_statuses', '["pending","approved","rejected","kicked"]'::jsonb),
  'hosted_event_entry_pending', COALESCE(NULLIF(trim(value->>'hosted_event_entry_pending'), ''), 'pending'),
  'hosted_event_entry_approved', COALESCE(NULLIF(trim(value->>'hosted_event_entry_approved'), ''), 'approved'),
  'hosted_event_entry_rejected', COALESCE(NULLIF(trim(value->>'hosted_event_entry_rejected'), ''), 'rejected'),
  'hosted_event_entry_kicked', COALESCE(NULLIF(trim(value->>'hosted_event_entry_kicked'), ''), 'kicked'),
  'hosted_event_bracket_statuses', COALESCE(value->'hosted_event_bracket_statuses', '["pending","ready","live","done","bye"]'::jsonb),
  'hosted_event_bracket_pending', COALESCE(NULLIF(trim(value->>'hosted_event_bracket_pending'), ''), 'pending'),
  'hosted_event_bracket_ready', COALESCE(NULLIF(trim(value->>'hosted_event_bracket_ready'), ''), 'ready'),
  'hosted_event_bracket_live', COALESCE(NULLIF(trim(value->>'hosted_event_bracket_live'), ''), 'live'),
  'hosted_event_bracket_done', COALESCE(NULLIF(trim(value->>'hosted_event_bracket_done'), ''), 'done'),
  'hosted_event_bracket_bye', COALESCE(NULLIF(trim(value->>'hosted_event_bracket_bye'), ''), 'bye'),
  'hosted_event_visibilities', COALESCE(value->'hosted_event_visibilities', '["private","public"]'::jsonb),
  'hosted_event_default_visibility', COALESCE(NULLIF(trim(value->>'hosted_event_default_visibility'), ''), 'private'),
  'hosted_event_public_visibility', COALESCE(NULLIF(trim(value->>'hosted_event_public_visibility'), ''), 'public'),
  'hosted_event_private_visibility', COALESCE(NULLIF(trim(value->>'hosted_event_private_visibility'), ''), 'private'),
  'hosted_event_report_statuses', COALESCE(value->'hosted_event_report_statuses', '["open","dismissed","deactivated"]'::jsonb),
  'hosted_event_report_open_status', COALESCE(NULLIF(trim(value->>'hosted_event_report_open_status'), ''), 'open'),
  'hosted_event_report_dismissed_status', COALESCE(NULLIF(trim(value->>'hosted_event_report_dismissed_status'), ''), 'dismissed'),
  'hosted_event_report_deactivated_status', COALESCE(NULLIF(trim(value->>'hosted_event_report_deactivated_status'), ''), 'deactivated'),
  'tournament_formats', COALESCE(value->'tournament_formats', '["knockout","round_robin","swiss","groups_knockout","arena"]'::jsonb),
  'tournament_default_format', COALESCE(NULLIF(trim(value->>'tournament_default_format'), ''), 'knockout'),
  'tournament_bracket_statuses', COALESCE(value->'tournament_bracket_statuses', '["pending","ready","live","done","bye"]'::jsonb),
  'tournament_bracket_pending', COALESCE(NULLIF(trim(value->>'tournament_bracket_pending'), ''), 'pending'),
  'tournament_bracket_ready', COALESCE(NULLIF(trim(value->>'tournament_bracket_ready'), ''), 'ready'),
  'tournament_bracket_live', COALESCE(NULLIF(trim(value->>'tournament_bracket_live'), ''), 'live'),
  'tournament_bracket_done', COALESCE(NULLIF(trim(value->>'tournament_bracket_done'), ''), 'done'),
  'tournament_bracket_bye', COALESCE(NULLIF(trim(value->>'tournament_bracket_bye'), ''), 'bye')
)),
    updated_at = NOW()
WHERE key = 'client_enums';

-- Arena / payout / prize settle
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'competition_arena_points_win', COALESCE(NULLIF(trim(value->>'competition_arena_points_win'), ''), '2'),
  'competition_arena_points_draw', COALESCE(NULLIF(trim(value->>'competition_arena_points_draw'), ''), '1'),
  'competition_arena_points_loss', COALESCE(NULLIF(trim(value->>'competition_arena_points_loss'), ''), '0'),
  'competition_arena_streak_second_win', COALESCE(NULLIF(trim(value->>'competition_arena_streak_second_win'), ''), '1'),
  'competition_arena_streak_third_plus_win', COALESCE(NULLIF(trim(value->>'competition_arena_streak_third_plus_win'), ''), '2'),
  'competition_arena_default_duration_minutes', COALESCE(NULLIF(trim(value->>'competition_arena_default_duration_minutes'), ''), '60'),
  'competition_arena_pairing_modes', COALESCE(value->'competition_arena_pairing_modes', '["rating","score","random"]'::jsonb),
  'competition_arena_default_pairing_mode', COALESCE(NULLIF(trim(value->>'competition_arena_default_pairing_mode'), ''), 'rating'),
  'competition_arena_auto_start', COALESCE(NULLIF(trim(value->>'competition_arena_auto_start'), ''), 'true'),
  'competition_arena_pair_interval_seconds', COALESCE(NULLIF(trim(value->>'competition_arena_pair_interval_seconds'), ''), '5'),
  'competition_arena_allow_join_while_live', COALESCE(NULLIF(trim(value->>'competition_arena_allow_join_while_live'), ''), 'true'),
  'competition_payout_modes', COALESCE(value->'competition_payout_modes', '["places_percent","score_share","dual_purse"]'::jsonb),
  'competition_payout_mode_places_percent', COALESCE(NULLIF(trim(value->>'competition_payout_mode_places_percent'), ''), 'places_percent'),
  'competition_payout_mode_score_share', COALESCE(NULLIF(trim(value->>'competition_payout_mode_score_share'), ''), 'score_share'),
  'competition_payout_mode_dual_purse', COALESCE(NULLIF(trim(value->>'competition_payout_mode_dual_purse'), ''), 'dual_purse'),
  'competition_dual_purse_place_percent', COALESCE(NULLIF(trim(value->>'competition_dual_purse_place_percent'), ''), '50'),
  'competition_default_payout_mode_knockout', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_knockout'), ''), 'places_percent'),
  'competition_default_payout_mode_round_robin', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_round_robin'), ''), 'score_share'),
  'competition_default_payout_mode_swiss', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_swiss'), ''), 'score_share'),
  'competition_default_payout_mode_groups_knockout', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_groups_knockout'), ''), 'places_percent'),
  'competition_default_payout_mode_arena', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_arena'), ''), 'score_share'),
  'competition_default_place_percent_1', COALESCE(NULLIF(trim(value->>'competition_default_place_percent_1'), ''), '50'),
  'competition_default_place_percent_2', COALESCE(NULLIF(trim(value->>'competition_default_place_percent_2'), ''), '30'),
  'competition_default_place_percent_3', COALESCE(NULLIF(trim(value->>'competition_default_place_percent_3'), ''), '20'),
  'competition_standings_points_win', COALESCE(NULLIF(trim(value->>'competition_standings_points_win'), ''), '1'),
  'competition_standings_points_draw', COALESCE(NULLIF(trim(value->>'competition_standings_points_draw'), ''), '0'),
  'competition_prize_payout_statuses', COALESCE(value->'competition_prize_payout_statuses', '["pending","settled","failed","cancelled"]'::jsonb),
  'competition_prize_payout_pending', COALESCE(NULLIF(trim(value->>'competition_prize_payout_pending'), ''), 'pending'),
  'competition_prize_payout_settled', COALESCE(NULLIF(trim(value->>'competition_prize_payout_settled'), ''), 'settled'),
  'competition_prize_payout_failed', COALESCE(NULLIF(trim(value->>'competition_prize_payout_failed'), ''), 'failed'),
  'competition_prize_payout_cancelled', COALESCE(NULLIF(trim(value->>'competition_prize_payout_cancelled'), ''), 'cancelled'),
  'competition_dispute_window_hours', COALESCE(NULLIF(trim(value->>'competition_dispute_window_hours'), ''), '24'),
  'competition_prize_settle_interval_minutes', COALESCE(NULLIF(trim(value->>'competition_prize_settle_interval_minutes'), ''), '5'),
  'competition_prize_auto_settle', COALESCE(NULLIF(trim(value->>'competition_prize_auto_settle'), ''), 'true')
)),
    updated_at = NOW()
WHERE key = 'client_enums';

-- Status labels (object merge)
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'hosted_event_status_labels', COALESCE(value->'hosted_event_status_labels', '{}'::jsonb) || '{
      "open":"Open","full":"Full","live":"Live","finished":"Finished","cancelled":"Cancelled"
    }'::jsonb,
    'hosted_event_entry_status_labels', COALESCE(value->'hosted_event_entry_status_labels', '{}'::jsonb) || '{
      "pending":"Pending","approved":"Approved","rejected":"Rejected","kicked":"Kicked"
    }'::jsonb,
    'hosted_event_bracket_status_labels', COALESCE(value->'hosted_event_bracket_status_labels', '{}'::jsonb) || '{
      "pending":"Pending","ready":"Ready","live":"Live","done":"Done","bye":"Bye"
    }'::jsonb,
    'campaign_status_labels', COALESCE(value->'campaign_status_labels', '{}'::jsonb) || '{
      "draft":"Draft","active":"Active","paused":"Paused","archived":"Archived"
    }'::jsonb,
    'tournament_status_labels', COALESCE(value->'tournament_status_labels', '{}'::jsonb) || '{
      "draft":"Draft","open":"Open","archived":"Archived"
    }'::jsonb,
    'tournament_bracket_status_labels', COALESCE(value->'tournament_bracket_status_labels', '{}'::jsonb) || '{
      "pending":"Pending","ready":"Ready","live":"Live","done":"Done","bye":"Bye"
    }'::jsonb,
    'creative_type_labels', COALESCE(value->'creative_type_labels', '{}'::jsonb) || '{
      "image":"Image","video":"Video"
    }'::jsonb,
    'hosted_event_report_status_labels', COALESCE(value->'hosted_event_report_status_labels', '{}'::jsonb) || '{
      "open":"Open","dismissed":"Dismissed","deactivated":"Deactivated"
    }'::jsonb,
    'hosted_event_visibility_labels', COALESCE(value->'hosted_event_visibility_labels', '{}'::jsonb) || '{
      "private":"Private","public":"Public"
    }'::jsonb
  ),
    updated_at = NOW()
WHERE key = 'client_enums';

-- wallet_ledger_kinds union (never shrink)
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{wallet_ledger_kinds}',
  (
    SELECT COALESCE(jsonb_agg(to_jsonb(k) ORDER BY k), '[]'::jsonb)
    FROM (
      SELECT DISTINCT trim(x) AS k
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(value->'wallet_ledger_kinds', '[]'::jsonb)) AS x
        UNION ALL
        SELECT unnest(ARRAY[
          'event_host_fee',
          'event_entry_paid',
          'event_entry_earned',
          'event_entry_commission',
          'event_entry_refund',
          'event_entry_clawback',
          'campaign_create_fee',
          'prize_pool_guarantee_hold',
          'prize_pool_guarantee_release',
          'prize_pool_guarantee_capture',
          'competition_prize_payout',
          'tournament_entry_refund'
        ])
      ) u
      WHERE trim(x) <> ''
    ) d
  )
),
    updated_at = NOW()
WHERE key = 'client_enums';

-- events_catalog soft keys (numeric JSON types must stay numbers for Go unmarshal)
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'source', COALESCE(NULLIF(trim(value->>'source'), ''), 'database'),
  'share_path_template', COALESCE(
    NULLIF(trim(value->>'share_path_template'), ''),
    '/?view=tournaments&source=community&code={code}'
  ),
  'qr_filename_prefix', COALESCE(NULLIF(trim(value->>'qr_filename_prefix'), ''), 'dama-host'),
  'default_visibility', COALESCE(NULLIF(trim(value->>'default_visibility'), ''), 'private')
)),
    updated_at = NOW()
WHERE key = 'events_catalog';

-- Coerce numeric fields if a prior heal wrote them as strings.
UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value,
      '{join_code_length}',
      to_jsonb(
        CASE
          WHEN jsonb_typeof(value->'join_code_length') = 'number' THEN (value->>'join_code_length')::int
          WHEN NULLIF(trim(value->>'join_code_length'), '') ~ '^[0-9]+$' THEN (trim(value->>'join_code_length'))::int
          ELSE 6
        END
      ),
      true
    ),
    '{public_host_fee_multiplier}',
    to_jsonb(
      CASE
        WHEN jsonb_typeof(value->'public_host_fee_multiplier') = 'number' THEN (value->>'public_host_fee_multiplier')::float8
        WHEN NULLIF(trim(value->>'public_host_fee_multiplier'), '') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (trim(value->>'public_host_fee_multiplier'))::float8
        ELSE 1::float8
      END
    ),
    true
  ),
  '{entry_fee_commission_percent}',
  to_jsonb(
    CASE
      WHEN jsonb_typeof(value->'entry_fee_commission_percent') = 'number' THEN (value->>'entry_fee_commission_percent')::float8
      WHEN NULLIF(trim(value->>'entry_fee_commission_percent'), '') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (trim(value->>'entry_fee_commission_percent'))::float8
      ELSE 10::float8
    END
  ),
  true
),
    updated_at = NOW()
WHERE key = 'events_catalog';
