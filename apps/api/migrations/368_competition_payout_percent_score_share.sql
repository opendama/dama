-- Competition payout modes: places % of frozen pot + score-share.
-- Standings points (RR/Swiss/groups) admin-driven. Points-earned notification + chrome.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Entity payout mode + place percents (empty mode = legacy fixed/$ or winner-take-all)
-- ---------------------------------------------------------------------------
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS prize_payout_mode TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prize_place_percents JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE hosted_events
  ADD COLUMN IF NOT EXISTS prize_payout_mode TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prize_place_percents JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- client_enums: payout modes, default place %, standings points
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'competition_payout_modes', COALESCE(value->'competition_payout_modes', '["places_percent","score_share"]'::jsonb),
  'competition_payout_mode_places_percent', COALESCE(NULLIF(trim(value->>'competition_payout_mode_places_percent'), ''), 'places_percent'),
  'competition_payout_mode_score_share', COALESCE(NULLIF(trim(value->>'competition_payout_mode_score_share'), ''), 'score_share'),
  'competition_default_payout_mode_knockout', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_knockout'), ''), 'places_percent'),
  'competition_default_payout_mode_round_robin', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_round_robin'), ''), 'places_percent'),
  'competition_default_payout_mode_swiss', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_swiss'), ''), 'places_percent'),
  'competition_default_payout_mode_groups_knockout', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_groups_knockout'), ''), 'places_percent'),
  'competition_default_payout_mode_arena', COALESCE(NULLIF(trim(value->>'competition_default_payout_mode_arena'), ''), 'score_share'),
  'competition_default_place_percent_1', COALESCE(NULLIF(trim(value->>'competition_default_place_percent_1'), ''), '50'),
  'competition_default_place_percent_2', COALESCE(NULLIF(trim(value->>'competition_default_place_percent_2'), ''), '30'),
  'competition_default_place_percent_3', COALESCE(NULLIF(trim(value->>'competition_default_place_percent_3'), ''), '20'),
  'competition_standings_points_win', COALESCE(NULLIF(trim(value->>'competition_standings_points_win'), ''), '1'),
  'competition_standings_points_draw', COALESCE(NULLIF(trim(value->>'competition_standings_points_draw'), ''), '0')
),
updated_at = NOW()
WHERE key = 'client_enums';

-- ---------------------------------------------------------------------------
-- Admin / organizer chrome
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'payout_mode_label', COALESCE(NULLIF(trim(value->>'payout_mode_label'), ''), 'Prize payout mode'),
  'payout_mode_blurb', COALESCE(NULLIF(trim(value->>'payout_mode_blurb'), ''), 'Places % splits the frozen pot by rank. Score-share splits by points earned.'),
  'payout_mode_places_percent_label', COALESCE(NULLIF(trim(value->>'payout_mode_places_percent_label'), ''), 'Places %'),
  'payout_mode_score_share_label', COALESCE(NULLIF(trim(value->>'payout_mode_score_share_label'), ''), 'Score-share'),
  'prize_place_percents_section_label', COALESCE(NULLIF(trim(value->>'prize_place_percents_section_label'), ''), 'Place percentages'),
  'prize_place_percents_blurb', COALESCE(NULLIF(trim(value->>'prize_place_percents_blurb'), ''), 'Must sum to 100. Applied to the frozen pot at start (fees + guarantee).'),
  'prize_place_percent_1_label', COALESCE(NULLIF(trim(value->>'prize_place_percent_1_label'), ''), '1st %'),
  'prize_place_percent_2_label', COALESCE(NULLIF(trim(value->>'prize_place_percent_2_label'), ''), '2nd %'),
  'prize_place_percent_3_label', COALESCE(NULLIF(trim(value->>'prize_place_percent_3_label'), ''), '3rd %'),
  'err_prize_place_percents_sum', COALESCE(NULLIF(trim(value->>'err_prize_place_percents_sum'), ''), 'Place percentages must sum to 100'),
  'err_payout_mode_invalid', COALESCE(NULLIF(trim(value->>'err_payout_mode_invalid'), ''), 'Invalid prize payout mode'),
  'err_payout_mode_score_share_knockout', COALESCE(NULLIF(trim(value->>'err_payout_mode_score_share_knockout'), ''), 'Knockout cups use places % only'),
  'standings_settings_title', COALESCE(NULLIF(trim(value->>'standings_settings_title'), ''), 'Standings points'),
  'standings_settings_blurb', COALESCE(NULLIF(trim(value->>'standings_settings_blurb'), ''), 'Points awarded per game result in Swiss, round robin, and group stages.'),
  'standings_settings_label_points_win', COALESCE(NULLIF(trim(value->>'standings_settings_label_points_win'), ''), 'Points per win'),
  'standings_settings_label_points_draw', COALESCE(NULLIF(trim(value->>'standings_settings_label_points_draw'), ''), 'Points per draw'),
  'standings_settings_save_action', COALESCE(NULLIF(trim(value->>'standings_settings_save_action'), ''), 'Save standings points'),
  'standings_settings_save_pending', COALESCE(NULLIF(trim(value->>'standings_settings_save_pending'), ''), 'Saving'),
  'standings_settings_toast_saved', COALESCE(NULLIF(trim(value->>'standings_settings_toast_saved'), ''), 'Standings points saved'),
  'standings_settings_toast_failed', COALESCE(NULLIF(trim(value->>'standings_settings_toast_failed'), ''), 'Unable to save standings points'),
  'payout_settings_title', COALESCE(NULLIF(trim(value->>'payout_settings_title'), ''), 'Default prize payout'),
  'payout_settings_blurb', COALESCE(NULLIF(trim(value->>'payout_settings_blurb'), ''), 'Platform defaults for place % and payout mode by format.'),
  'payout_settings_save_action', COALESCE(NULLIF(trim(value->>'payout_settings_save_action'), ''), 'Save payout defaults'),
  'payout_settings_save_pending', COALESCE(NULLIF(trim(value->>'payout_settings_save_pending'), ''), 'Saving'),
  'payout_settings_toast_saved', COALESCE(NULLIF(trim(value->>'payout_settings_toast_saved'), ''), 'Payout defaults saved'),
  'payout_settings_toast_failed', COALESCE(NULLIF(trim(value->>'payout_settings_toast_failed'), ''), 'Unable to save payout defaults')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'payout_mode_label', COALESCE(NULLIF(trim(value->>'payout_mode_label'), ''), 'Prize payout mode'),
  'payout_mode_blurb', COALESCE(NULLIF(trim(value->>'payout_mode_blurb'), ''), 'Places % splits the frozen pot by rank. Score-share splits by points earned.'),
  'payout_mode_places_percent_label', COALESCE(NULLIF(trim(value->>'payout_mode_places_percent_label'), ''), 'Places %'),
  'payout_mode_score_share_label', COALESCE(NULLIF(trim(value->>'payout_mode_score_share_label'), ''), 'Score-share'),
  'prize_place_percents_section_label', COALESCE(NULLIF(trim(value->>'prize_place_percents_section_label'), ''), 'Place percentages'),
  'prize_place_percents_blurb', COALESCE(NULLIF(trim(value->>'prize_place_percents_blurb'), ''), 'Must sum to 100. Applied to the frozen pot at start (fees + guarantee).'),
  'prize_place_percent_1_label', COALESCE(NULLIF(trim(value->>'prize_place_percent_1_label'), ''), '1st %'),
  'prize_place_percent_2_label', COALESCE(NULLIF(trim(value->>'prize_place_percent_2_label'), ''), '2nd %'),
  'prize_place_percent_3_label', COALESCE(NULLIF(trim(value->>'prize_place_percent_3_label'), ''), '3rd %'),
  'err_prize_place_percents_sum', COALESCE(NULLIF(trim(value->>'err_prize_place_percents_sum'), ''), 'Place percentages must sum to 100'),
  'err_payout_mode_invalid', COALESCE(NULLIF(trim(value->>'err_payout_mode_invalid'), ''), 'Invalid prize payout mode'),
  'err_payout_mode_score_share_knockout', COALESCE(NULLIF(trim(value->>'err_payout_mode_score_share_knockout'), ''), 'Knockout cups use places % only'),
  'toast_arena_start_failed', COALESCE(NULLIF(trim(value->>'toast_arena_start_failed'), ''), 'Unable to start arena'),
  'toast_arena_queue_failed', COALESCE(NULLIF(trim(value->>'toast_arena_queue_failed'), ''), 'Unable to join arena queue')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Player chrome: points-earned toast + estimated share
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_points_awarded_fmt', COALESCE(NULLIF(trim(value->>'toast_points_awarded_fmt'), ''), '+{points} {label}'),
  'est_prize_share_label', COALESCE(NULLIF(trim(value->>'est_prize_share_label'), ''), 'Est. share'),
  'est_prize_share_blurb', COALESCE(NULLIF(trim(value->>'est_prize_share_blurb'), ''), 'Estimated from current pot and points. Final amount locks when the event ends.')
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_points_awarded_fmt', COALESCE(NULLIF(trim(value->>'toast_points_awarded_fmt'), ''), '+{points} {label}'),
  'est_prize_share_label', COALESCE(NULLIF(trim(value->>'est_prize_share_label'), ''), 'Est. share'),
  'est_prize_share_blurb', COALESCE(NULLIF(trim(value->>'est_prize_share_blurb'), ''), 'Estimated from current pot and points. Final amount locks when the event ends.')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_points_awarded_fmt', COALESCE(NULLIF(trim(value->>'toast_points_awarded_fmt'), ''), '+{points} {label}')
),
updated_at = NOW()
WHERE key = 'play_chrome';

-- ---------------------------------------------------------------------------
-- Notification: competition points awarded (bell + clients may toast)
-- ---------------------------------------------------------------------------
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES
  (
    'player.competition_points_awarded',
    'player',
    'Points earned',
    'You earned +%s %s in "%s".',
    '/',
    'view'
  )
ON CONFLICT (code) DO UPDATE SET
  audience = EXCLUDED.audience,
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  href_path = EXCLUDED.href_path,
  href_query_key = EXCLUDED.href_query_key;
