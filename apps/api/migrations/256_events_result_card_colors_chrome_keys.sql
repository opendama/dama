-- Result card palette from DB chrome (no client invent). Phase backfill from client_enums.
-- Fail closed: chrome handlers require these keys.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'result_card_bg_color', COALESCE(NULLIF(trim(value->>'result_card_bg_color'), ''), '#1a1a1a'),
  'result_card_fg_color', COALESCE(NULLIF(trim(value->>'result_card_fg_color'), ''), '#f5f5f5'),
  'result_card_muted_color', COALESCE(NULLIF(trim(value->>'result_card_muted_color'), ''), '#a3a3a3'),
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
  'result_card_bg_color', COALESCE(NULLIF(trim(value->>'result_card_bg_color'), ''), '#1a1a1a'),
  'result_card_fg_color', COALESCE(NULLIF(trim(value->>'result_card_fg_color'), ''), '#f5f5f5'),
  'result_card_muted_color', COALESCE(NULLIF(trim(value->>'result_card_muted_color'), ''), '#a3a3a3'),
  'standings_title', COALESCE(NULLIF(trim(value->>'standings_title'), ''), 'Standings'),
  'standings_played_label', COALESCE(NULLIF(trim(value->>'standings_played_label'), ''), 'P'),
  'standings_wins_label', COALESCE(NULLIF(trim(value->>'standings_wins_label'), ''), 'W'),
  'standings_losses_label', COALESCE(NULLIF(trim(value->>'standings_losses_label'), ''), 'L'),
  'standings_points_label', COALESCE(NULLIF(trim(value->>'standings_points_label'), ''), 'Pts'),
  'result_card_share_image_action', COALESCE(NULLIF(trim(value->>'result_card_share_image_action'), ''), 'Share result card image'),
  'result_card_download_action', COALESCE(NULLIF(trim(value->>'result_card_download_action'), ''), 'Download result card'),
  'result_card_image_failed', COALESCE(NULLIF(trim(value->>'result_card_image_failed'), ''), 'Could not build result card image'),
  'result_card_sponsor_prefix', COALESCE(NULLIF(trim(value->>'result_card_sponsor_prefix'), ''), 'Sponsored by')
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

-- Backfill empty phase from client_enums (not a hardcoded string in app code).
UPDATE hosted_event_bracket_matches m
SET phase = COALESCE(
  NULLIF(trim((SELECT value->>'hosted_event_phase_knockout' FROM platform_settings WHERE key = 'client_enums')), ''),
  'knockout'
)
WHERE trim(m.phase) = '';
