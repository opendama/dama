-- Arena format (Chess.com-style timed continuous pairing).
-- DB-driven enums, catalog, chrome, scoring, notifications. Idempotent.

-- ---------------------------------------------------------------------------
-- Entity clocks + entry arena score / queue columns
-- ---------------------------------------------------------------------------
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS arena_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arena_duration_minutes INT;

ALTER TABLE hosted_events
  ADD COLUMN IF NOT EXISTS arena_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arena_duration_minutes INT;

ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS arena_points NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_best_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_wins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_losses INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_draws INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_queue_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arena_left_at TIMESTAMPTZ;

ALTER TABLE hosted_event_entries
  ADD COLUMN IF NOT EXISTS arena_points NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_best_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_wins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_losses INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_draws INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arena_queue_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arena_left_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- client_enums: arena format id + phase + scoring / duration / pairing
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'hosted_event_arena_format', COALESCE(NULLIF(trim(value->>'hosted_event_arena_format'), ''), 'arena'),
  'hosted_event_phase_arena', COALESCE(NULLIF(trim(value->>'hosted_event_phase_arena'), ''), 'arena'),
  'tournament_default_format', COALESCE(NULLIF(trim(value->>'tournament_default_format'), ''), 'knockout'),
  'competition_arena_points_win', COALESCE(NULLIF(trim(value->>'competition_arena_points_win'), ''), '2'),
  'competition_arena_points_draw', COALESCE(NULLIF(trim(value->>'competition_arena_points_draw'), ''), '1'),
  'competition_arena_points_loss', COALESCE(NULLIF(trim(value->>'competition_arena_points_loss'), ''), '0'),
  'competition_arena_streak_second_win', COALESCE(NULLIF(trim(value->>'competition_arena_streak_second_win'), ''), '3'),
  'competition_arena_streak_third_plus_win', COALESCE(NULLIF(trim(value->>'competition_arena_streak_third_plus_win'), ''), '4'),
  'competition_arena_default_duration_minutes', COALESCE(NULLIF(trim(value->>'competition_arena_default_duration_minutes'), ''), '60'),
  'competition_arena_pairing_modes', COALESCE(value->'competition_arena_pairing_modes', '["rating","score"]'::jsonb),
  'competition_arena_default_pairing_mode', COALESCE(NULLIF(trim(value->>'competition_arena_default_pairing_mode'), ''), 'rating'),
  'competition_arena_auto_start', COALESCE(NULLIF(trim(value->>'competition_arena_auto_start'), ''), 'true'),
  'competition_arena_pair_interval_seconds', COALESCE(NULLIF(trim(value->>'competition_arena_pair_interval_seconds'), ''), '5')
),
updated_at = NOW()
WHERE key = 'client_enums';

-- Append arena to hosted_event_formats + tournament_formats arrays when missing.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{hosted_event_formats}',
  (
    SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT DISTINCT ON (v) v, ord
      FROM (
        SELECT el AS v, ordinality AS ord
        FROM jsonb_array_elements_text(COALESCE(value->'hosted_event_formats', '[]'::jsonb)) WITH ORDINALITY AS t(el, ordinality)
        UNION ALL
        SELECT 'arena', 999
      ) s
      ORDER BY v, ord
    ) d
  )
),
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{tournament_formats}',
  (
    SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT DISTINCT ON (v) v, ord
      FROM (
        SELECT el AS v, ordinality AS ord
        FROM jsonb_array_elements_text(COALESCE(value->'tournament_formats', '[]'::jsonb)) WITH ORDINALITY AS t(el, ordinality)
        UNION ALL
        SELECT 'arena', 999
      ) s
      ORDER BY v, ord
    ) d
  )
),
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{hosted_event_bracket_phases}',
  (
    SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT DISTINCT ON (v) v, ord
      FROM (
        SELECT el AS v, ordinality AS ord
        FROM jsonb_array_elements_text(COALESCE(value->'hosted_event_bracket_phases', '[]'::jsonb)) WITH ORDINALITY AS t(el, ordinality)
        UNION ALL
        SELECT COALESCE(NULLIF(trim(value->>'hosted_event_phase_arena'), ''), 'arena'), 999
      ) s
      ORDER BY v, ord
    ) d
  )
),
updated_at = NOW()
WHERE key = 'client_enums';

-- ---------------------------------------------------------------------------
-- events_catalog: arena format row + min players + size allowlist
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{formats}',
  (
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(value->'formats', '[]'::jsonb)) f
        WHERE f->>'id' = 'arena'
      ) THEN (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN f->>'id' = 'arena' THEN f || jsonb_build_object(
              'enabled', true,
              'label', COALESCE(NULLIF(trim(f->>'label'), ''), 'Arena')
            )
            ELSE f
          END
          ORDER BY COALESCE((f->>'sort_order')::int, 99)
        ), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(value->'formats', '[]'::jsonb)) AS f
      )
      ELSE COALESCE(value->'formats', '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'id', 'arena',
          'label', 'Arena',
          'enabled', true,
          'sort_order', 50
        )
      )
    END
  )
),
updated_at = NOW()
WHERE key = 'events_catalog'
  AND value ? 'formats';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{min_players_to_start}',
  COALESCE(value->'min_players_to_start', '{}'::jsonb) || jsonb_build_object('arena', 2)
),
updated_at = NOW()
WHERE key = 'events_catalog';

-- Allow arena on every size that already has allowed_format_ids.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{sizes}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN s ? 'allowed_format_ids' THEN
          s || jsonb_build_object(
            'allowed_format_ids',
            (
              SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY ord), '[]'::jsonb)
              FROM (
                SELECT DISTINCT ON (v) v, ord
                FROM (
                  SELECT el AS v, ordinality AS ord
                  FROM jsonb_array_elements_text(COALESCE(s->'allowed_format_ids', '[]'::jsonb)) WITH ORDINALITY AS t(el, ordinality)
                  UNION ALL
                  SELECT 'arena', 999
                ) u
                ORDER BY v, ord
              ) d
            )
          )
        ELSE s
      END
      ORDER BY COALESCE((s->>'sort_order')::int, 99)
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'sizes', '[]'::jsonb)) AS s
  )
),
updated_at = NOW()
WHERE key = 'events_catalog'
  AND value ? 'sizes';

-- ---------------------------------------------------------------------------
-- Player / admin / organizer chrome (fail-closed keys)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'arena_lobby_title', COALESCE(NULLIF(trim(value->>'arena_lobby_title'), ''), 'Arena lobby'),
  'arena_lobby_blurb', COALESCE(NULLIF(trim(value->>'arena_lobby_blurb'), ''), 'Play as many games as you can before the arena clock ends. Points and win streaks decide the standings.'),
  'arena_queue_action', COALESCE(NULLIF(trim(value->>'arena_queue_action'), ''), 'Find game'),
  'arena_queue_pending', COALESCE(NULLIF(trim(value->>'arena_queue_pending'), ''), 'Joining queue'),
  'arena_queue_done', COALESCE(NULLIF(trim(value->>'arena_queue_done'), ''), 'In queue'),
  'arena_leave_queue_action', COALESCE(NULLIF(trim(value->>'arena_leave_queue_action'), ''), 'Leave queue'),
  'arena_leave_queue_pending', COALESCE(NULLIF(trim(value->>'arena_leave_queue_pending'), ''), 'Leaving'),
  'arena_clock_label', COALESCE(NULLIF(trim(value->>'arena_clock_label'), ''), 'Arena ends'),
  'arena_points_label', COALESCE(NULLIF(trim(value->>'arena_points_label'), ''), 'Points'),
  'arena_streak_label', COALESCE(NULLIF(trim(value->>'arena_streak_label'), ''), 'Streak'),
  'arena_standings_title', COALESCE(NULLIF(trim(value->>'arena_standings_title'), ''), 'Arena standings'),
  'arena_waiting_pair', COALESCE(NULLIF(trim(value->>'arena_waiting_pair'), ''), 'Looking for an opponent'),
  'arena_finished_blurb', COALESCE(NULLIF(trim(value->>'arena_finished_blurb'), ''), 'Arena finished. Final standings are locked.'),
  'arena_not_started_blurb', COALESCE(NULLIF(trim(value->>'arena_not_started_blurb'), ''), 'Arena has not started yet.'),
  'arena_left_blurb', COALESCE(NULLIF(trim(value->>'arena_left_blurb'), ''), 'You left the arena queue.')
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'arena_lobby_title', COALESCE(NULLIF(trim(value->>'arena_lobby_title'), ''), 'Arena lobby'),
  'arena_lobby_blurb', COALESCE(NULLIF(trim(value->>'arena_lobby_blurb'), ''), 'Play as many games as you can before the arena clock ends. Points and win streaks decide the standings.'),
  'arena_queue_action', COALESCE(NULLIF(trim(value->>'arena_queue_action'), ''), 'Find game'),
  'arena_queue_pending', COALESCE(NULLIF(trim(value->>'arena_queue_pending'), ''), 'Joining queue'),
  'arena_queue_done', COALESCE(NULLIF(trim(value->>'arena_queue_done'), ''), 'In queue'),
  'arena_leave_queue_action', COALESCE(NULLIF(trim(value->>'arena_leave_queue_action'), ''), 'Leave queue'),
  'arena_leave_queue_pending', COALESCE(NULLIF(trim(value->>'arena_leave_queue_pending'), ''), 'Leaving'),
  'arena_clock_label', COALESCE(NULLIF(trim(value->>'arena_clock_label'), ''), 'Arena ends'),
  'arena_points_label', COALESCE(NULLIF(trim(value->>'arena_points_label'), ''), 'Points'),
  'arena_streak_label', COALESCE(NULLIF(trim(value->>'arena_streak_label'), ''), 'Streak'),
  'arena_standings_title', COALESCE(NULLIF(trim(value->>'arena_standings_title'), ''), 'Arena standings'),
  'arena_waiting_pair', COALESCE(NULLIF(trim(value->>'arena_waiting_pair'), ''), 'Looking for an opponent'),
  'arena_finished_blurb', COALESCE(NULLIF(trim(value->>'arena_finished_blurb'), ''), 'Arena finished. Final standings are locked.'),
  'arena_not_started_blurb', COALESCE(NULLIF(trim(value->>'arena_not_started_blurb'), ''), 'Arena has not started yet.'),
  'arena_left_blurb', COALESCE(NULLIF(trim(value->>'arena_left_blurb'), ''), 'You left the arena queue.')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'arena_duration_label', COALESCE(NULLIF(trim(value->>'arena_duration_label'), ''), 'Arena duration (minutes)'),
  'arena_duration_required', COALESCE(NULLIF(trim(value->>'arena_duration_required'), ''), 'Enter arena duration in minutes'),
  'err_arena_start_failed', COALESCE(NULLIF(trim(value->>'err_arena_start_failed'), ''), 'Unable to start arena'),
  'err_arena_queue_failed', COALESCE(NULLIF(trim(value->>'err_arena_queue_failed'), ''), 'Unable to join arena queue')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'arena_duration_label', COALESCE(NULLIF(trim(value->>'arena_duration_label'), ''), 'Arena duration (minutes)'),
  'arena_duration_required', COALESCE(NULLIF(trim(value->>'arena_duration_required'), ''), 'Enter arena duration in minutes'),
  'toast_arena_start_failed', COALESCE(NULLIF(trim(value->>'toast_arena_start_failed'), ''), 'Unable to start arena'),
  'toast_arena_queue_failed', COALESCE(NULLIF(trim(value->>'toast_arena_queue_failed'), ''), 'Unable to join arena queue')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Notification kinds (deep link to cup / arena lobby)
-- ---------------------------------------------------------------------------
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES
  (
    'player.arena_started',
    'player',
    'Arena started',
    'Arena "%s" is live. Join the queue and play until the clock ends.',
    '/',
    'view'
  ),
  (
    'player.arena_finished',
    'player',
    'Arena finished',
    'Arena "%s" ended. Final standings are locked.',
    '/',
    'view'
  ),
  (
    'player.arena_matched',
    'player',
    'Arena match found',
    'You were paired in arena "%s". Open your board.',
    '/',
    'view'
  )
ON CONFLICT (code) DO UPDATE SET
  audience = EXCLUDED.audience,
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template,
  href_path = EXCLUDED.href_path,
  href_query_key = EXCLUDED.href_query_key;
