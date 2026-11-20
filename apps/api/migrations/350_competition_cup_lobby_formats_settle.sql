-- Competition cup professionalism foundation (tournaments + events).
-- DB-only chrome / enums / deep links. Idempotent. No client invent.
--
-- Adds: tournament format_id + bracket mirrors, check-in / ready columns,
-- prize payout ledger rows, lobby chrome, notification deep links to cup lobbies.
-- Enables catalog formats already implemented for hosted events (RR / Swiss / groups).

-- ---------------------------------------------------------------------------
-- Tournaments: competition format (reuse events_catalog format ids)
-- ---------------------------------------------------------------------------
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS format_id TEXT NOT NULL DEFAULT 'knockout',
  ADD COLUMN IF NOT EXISTS check_in_opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_in_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prize_settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_window_ends_at TIMESTAMPTZ;

UPDATE tournaments
SET format_id = 'knockout'
WHERE trim(COALESCE(format_id, '')) = '';

ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS placement INT,
  ADD COLUMN IF NOT EXISTS standings_points NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standings_played INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standings_wins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standings_losses INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standings_draws INT NOT NULL DEFAULT 0;

-- Mirror hosted_event_bracket_matches for platform tournaments (same format engines).
CREATE TABLE IF NOT EXISTS tournament_bracket_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_index INT NOT NULL CHECK (round_index >= 0),
  match_index INT NOT NULL CHECK (match_index >= 0),
  player_a_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player_b_id UUID REFERENCES users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  next_match_id UUID REFERENCES tournament_bracket_matches(id) ON DELETE SET NULL,
  next_slot TEXT CHECK (next_slot IS NULL OR next_slot IN ('a', 'b')),
  game_id UUID,
  status TEXT NOT NULL,
  is_bye BOOLEAN NOT NULL DEFAULT FALSE,
  phase TEXT NOT NULL DEFAULT '',
  group_index INT NOT NULL DEFAULT -1,
  player_a_ready_at TIMESTAMPTZ,
  player_b_ready_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_bracket_phase_group_round_match
  ON tournament_bracket_matches (tournament_id, phase, group_index, round_index, match_index);

CREATE INDEX IF NOT EXISTS idx_tournament_bracket_tournament
  ON tournament_bracket_matches (tournament_id, round_index, match_index);

CREATE INDEX IF NOT EXISTS idx_tournament_bracket_game
  ON tournament_bracket_matches (game_id)
  WHERE game_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_bracket_status
  ON tournament_bracket_matches (tournament_id, status);

-- Ready-check on hosted event matches (organizer override still allowed).
ALTER TABLE hosted_event_bracket_matches
  ADD COLUMN IF NOT EXISTS player_a_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS player_b_ready_at TIMESTAMPTZ;

ALTER TABLE hosted_event_entries
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

ALTER TABLE hosted_events
  ADD COLUMN IF NOT EXISTS check_in_opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_in_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prize_settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_window_ends_at TIMESTAMPTZ;

-- Prize settlement rows (wallet credits after dispute window). Entity = tournament|event.
CREATE TABLE IF NOT EXISTS competition_prize_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_kind TEXT NOT NULL CHECK (entity_kind IN ('tournament', 'event')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placement INT NOT NULL CHECK (placement >= 1),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ledger_tx_id UUID,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_kind, entity_id, user_id, placement)
);

CREATE INDEX IF NOT EXISTS idx_competition_prize_payouts_entity
  ON competition_prize_payouts (entity_kind, entity_id, status);

-- client_enums: tournament format keys + bracket statuses (align with hosted events).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'tournament_formats', COALESCE(value->'tournament_formats', '["knockout","round_robin","swiss","groups_knockout"]'::jsonb),
  'tournament_default_format', COALESCE(NULLIF(trim(value->>'tournament_default_format'), ''), 'knockout'),
  'tournament_bracket_statuses', COALESCE(value->'tournament_bracket_statuses', '["pending","ready","live","done","bye"]'::jsonb),
  'tournament_bracket_pending', COALESCE(NULLIF(trim(value->>'tournament_bracket_pending'), ''), 'pending'),
  'tournament_bracket_ready', COALESCE(NULLIF(trim(value->>'tournament_bracket_ready'), ''), 'ready'),
  'tournament_bracket_live', COALESCE(NULLIF(trim(value->>'tournament_bracket_live'), ''), 'live'),
  'tournament_bracket_done', COALESCE(NULLIF(trim(value->>'tournament_bracket_done'), ''), 'done'),
  'tournament_bracket_bye', COALESCE(NULLIF(trim(value->>'tournament_bracket_bye'), ''), 'bye'),
  'competition_prize_payout_statuses', COALESCE(value->'competition_prize_payout_statuses', '["pending","settled","failed","cancelled"]'::jsonb),
  'competition_prize_payout_pending', COALESCE(NULLIF(trim(value->>'competition_prize_payout_pending'), ''), 'pending'),
  'competition_prize_payout_settled', COALESCE(NULLIF(trim(value->>'competition_prize_payout_settled'), ''), 'settled'),
  'competition_prize_payout_failed', COALESCE(NULLIF(trim(value->>'competition_prize_payout_failed'), ''), 'failed'),
  'competition_prize_payout_cancelled', COALESCE(NULLIF(trim(value->>'competition_prize_payout_cancelled'), ''), 'cancelled'),
  'competition_dispute_window_hours', COALESCE(NULLIF(trim(value->>'competition_dispute_window_hours'), ''), '24')
),
updated_at = NOW()
WHERE key = 'client_enums';

-- Enable event catalog formats that already have engines (still admin-toggleable later).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{formats}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN f->>'id' IN ('knockout', 'round_robin', 'swiss', 'groups_knockout')
          THEN f || jsonb_build_object('enabled', true)
        ELSE f
      END
      ORDER BY COALESCE((f->>'sort_order')::int, 99)
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'formats', '[]'::jsonb)) AS f
  )
),
updated_at = NOW()
WHERE key = 'events_catalog'
  AND value ? 'formats';

-- ---------------------------------------------------------------------------
-- Player chrome: cup lobby + check-in + ready + prize (fail-closed keys)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'lobby_title', COALESCE(NULLIF(trim(value->>'lobby_title'), ''), 'Cup lobby'),
  'lobby_blurb', COALESCE(NULLIF(trim(value->>'lobby_blurb'), ''), 'Check in, watch the bracket, and open your next match here.'),
  'lobby_unavailable', COALESCE(NULLIF(trim(value->>'lobby_unavailable'), ''), 'Cup lobby unavailable'),
  'lobby_roster_title', COALESCE(NULLIF(trim(value->>'lobby_roster_title'), ''), 'Players'),
  'lobby_bracket_title', COALESCE(NULLIF(trim(value->>'lobby_bracket_title'), ''), 'Bracket'),
  'lobby_standings_title', COALESCE(NULLIF(trim(value->>'lobby_standings_title'), ''), 'Standings'),
  'lobby_next_match_title', COALESCE(NULLIF(trim(value->>'lobby_next_match_title'), ''), 'Your next match'),
  'lobby_waiting_start', COALESCE(NULLIF(trim(value->>'lobby_waiting_start'), ''), 'Waiting for the cup to start.'),
  'lobby_open_play_action', COALESCE(NULLIF(trim(value->>'lobby_open_play_action'), ''), 'Open board'),
  'lobby_spectate_action', COALESCE(NULLIF(trim(value->>'lobby_spectate_action'), ''), 'Spectate'),
  'check_in_action', COALESCE(NULLIF(trim(value->>'check_in_action'), ''), 'Check in'),
  'check_in_pending', COALESCE(NULLIF(trim(value->>'check_in_pending'), ''), 'Checking in'),
  'check_in_done', COALESCE(NULLIF(trim(value->>'check_in_done'), ''), 'Checked in'),
  'check_in_closed', COALESCE(NULLIF(trim(value->>'check_in_closed'), ''), 'Check-in is closed.'),
  'check_in_not_open', COALESCE(NULLIF(trim(value->>'check_in_not_open'), ''), 'Check-in is not open yet.'),
  'check_in_success', COALESCE(NULLIF(trim(value->>'check_in_success'), ''), 'You are checked in.'),
  'ready_action', COALESCE(NULLIF(trim(value->>'ready_action'), ''), 'Ready'),
  'ready_pending', COALESCE(NULLIF(trim(value->>'ready_pending'), ''), 'Marking ready'),
  'ready_done', COALESCE(NULLIF(trim(value->>'ready_done'), ''), 'Ready'),
  'ready_waiting_opponent', COALESCE(NULLIF(trim(value->>'ready_waiting_opponent'), ''), 'Waiting for opponent'),
  'ready_success', COALESCE(NULLIF(trim(value->>'ready_success'), ''), 'Marked ready. Match starts when both players are ready.'),
  'format_label', COALESCE(NULLIF(trim(value->>'format_label'), ''), 'Format'),
  'prize_settled_blurb', COALESCE(NULLIF(trim(value->>'prize_settled_blurb'), ''), 'Prize payout settled to wallets.'),
  'prize_pending_blurb', COALESCE(NULLIF(trim(value->>'prize_pending_blurb'), ''), 'Prize payout pending dispute window.'),
  'dispute_window_blurb', COALESCE(NULLIF(trim(value->>'dispute_window_blurb'), ''), 'Results are in review before prizes pay out.')
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'lobby_title', COALESCE(NULLIF(trim(value->>'lobby_title'), ''), 'Event lobby'),
  'lobby_blurb', COALESCE(NULLIF(trim(value->>'lobby_blurb'), ''), 'Check in, watch the bracket, and open your next match here.'),
  'lobby_unavailable', COALESCE(NULLIF(trim(value->>'lobby_unavailable'), ''), 'Event lobby unavailable'),
  'lobby_roster_title', COALESCE(NULLIF(trim(value->>'lobby_roster_title'), ''), 'Players'),
  'lobby_bracket_title', COALESCE(NULLIF(trim(value->>'lobby_bracket_title'), ''), 'Bracket'),
  'lobby_standings_title', COALESCE(NULLIF(trim(value->>'lobby_standings_title'), ''), 'Standings'),
  'lobby_next_match_title', COALESCE(NULLIF(trim(value->>'lobby_next_match_title'), ''), 'Your next match'),
  'lobby_waiting_start', COALESCE(NULLIF(trim(value->>'lobby_waiting_start'), ''), 'Waiting for the organizer to start the cup.'),
  'lobby_open_play_action', COALESCE(NULLIF(trim(value->>'lobby_open_play_action'), ''), 'Open board'),
  'check_in_action', COALESCE(NULLIF(trim(value->>'check_in_action'), ''), 'Check in'),
  'check_in_pending', COALESCE(NULLIF(trim(value->>'check_in_pending'), ''), 'Checking in'),
  'check_in_done', COALESCE(NULLIF(trim(value->>'check_in_done'), ''), 'Checked in'),
  'check_in_closed', COALESCE(NULLIF(trim(value->>'check_in_closed'), ''), 'Check-in is closed.'),
  'check_in_not_open', COALESCE(NULLIF(trim(value->>'check_in_not_open'), ''), 'Check-in is not open yet.'),
  'check_in_success', COALESCE(NULLIF(trim(value->>'check_in_success'), ''), 'You are checked in.'),
  'ready_action', COALESCE(NULLIF(trim(value->>'ready_action'), ''), 'Ready'),
  'ready_pending', COALESCE(NULLIF(trim(value->>'ready_pending'), ''), 'Marking ready'),
  'ready_done', COALESCE(NULLIF(trim(value->>'ready_done'), ''), 'Ready'),
  'ready_waiting_opponent', COALESCE(NULLIF(trim(value->>'ready_waiting_opponent'), ''), 'Waiting for opponent'),
  'ready_success', COALESCE(NULLIF(trim(value->>'ready_success'), ''), 'Marked ready. Match starts when both players are ready.'),
  'prize_settled_blurb', COALESCE(NULLIF(trim(value->>'prize_settled_blurb'), ''), 'Prize payout settled to wallets.'),
  'prize_pending_blurb', COALESCE(NULLIF(trim(value->>'prize_pending_blurb'), ''), 'Prize payout pending dispute window.'),
  'dispute_window_blurb', COALESCE(NULLIF(trim(value->>'dispute_window_blurb'), ''), 'Results are in review before prizes pay out.')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'format_label', COALESCE(NULLIF(trim(value->>'format_label'), ''), 'Format'),
  'format_required', COALESCE(NULLIF(trim(value->>'format_required'), ''), 'Select a format'),
  'start_cup_action', COALESCE(NULLIF(trim(value->>'start_cup_action'), ''), 'Start cup'),
  'start_cup_pending', COALESCE(NULLIF(trim(value->>'start_cup_pending'), ''), 'Starting'),
  'force_start_match_action', COALESCE(NULLIF(trim(value->>'force_start_match_action'), ''), 'Force start match'),
  'settle_prizes_action', COALESCE(NULLIF(trim(value->>'settle_prizes_action'), ''), 'Settle prizes'),
  'settle_prizes_pending', COALESCE(NULLIF(trim(value->>'settle_prizes_pending'), ''), 'Settling'),
  'control_room_title', COALESCE(NULLIF(trim(value->>'control_room_title'), ''), 'Control room'),
  'check_in_window_label', COALESCE(NULLIF(trim(value->>'check_in_window_label'), ''), 'Check-in window')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'force_start_match_action', COALESCE(NULLIF(trim(value->>'force_start_match_action'), ''), 'Force start match'),
  'settle_prizes_action', COALESCE(NULLIF(trim(value->>'settle_prizes_action'), ''), 'Settle prizes'),
  'settle_prizes_pending', COALESCE(NULLIF(trim(value->>'settle_prizes_pending'), ''), 'Settling'),
  'control_room_title', COALESCE(NULLIF(trim(value->>'control_room_title'), ''), 'Control room'),
  'check_in_window_label', COALESCE(NULLIF(trim(value->>'check_in_window_label'), ''), 'Check-in window'),
  'ready_waiting_opponent', COALESCE(NULLIF(trim(value->>'ready_waiting_opponent'), ''), 'Waiting for opponent')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Notifications: cup lobby deep links + new kinds
-- ---------------------------------------------------------------------------
UPDATE notification_kinds
SET href_path = '/?view=tournaments',
    href_query_key = 'id'
WHERE code IN ('player.tournament_status', 'player.tournament_created');

UPDATE notification_kinds
SET href_path = '/?view=events',
    href_query_key = 'id'
WHERE code IN (
  'player.event_joined',
  'player.event_started',
  'player.event_finished',
  'player.event_report_received'
);

UPDATE notification_kinds
SET href_path = '/',
    href_query_key = 'gameId'
WHERE code = 'player.event_match_ready';

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.tournament_match_ready', 'player', 'Match ready', 'Your match in "%s" is ready to play.', '/', 'gameId'),
  ('player.tournament_started', 'player', 'Tournament started', 'Cup "%s" has started. Open the lobby.', '/?view=tournaments', 'id'),
  ('player.tournament_finished', 'player', 'Tournament finished', 'Cup "%s" is finished.', '/?view=tournaments', 'id'),
  ('player.competition_check_in_open', 'player', 'Check-in open', 'Check in for "%s" before it starts.', '/?view=events', 'id'),
  ('player.competition_prize_settled', 'player', 'Prize paid', 'Your prize for "%s" was credited to your wallet.', '/wallet', ''),
  ('player.competition_dispute_open', 'player', 'Results in review', '"%s" is in the dispute window before prizes pay out.', '/?view=events', 'id')
ON CONFLICT (code) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  href_path = EXCLUDED.href_path,
  href_query_key = EXCLUDED.href_query_key;
