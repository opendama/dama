-- Official match pause/resume (host organizer / console admin).
-- Soft-fill only. Does not change player seat pause (match_clock + play_chrome).
-- Idempotent.

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
INSERT INTO rbac_permissions (key, title, description) VALUES
  (
    'games.official_pause',
    'Official match pause',
    'Pause or resume any live board as an official (admin/console). Organizers of a hosted event can pause their own event boards without this key.'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'superadmin', 'games.official_pause'
WHERE NOT EXISTS (
  SELECT 1 FROM rbac_role_permissions
  WHERE role = 'superadmin' AND permission_key = 'games.official_pause'
);

INSERT INTO rbac_role_permissions (role, permission_key)
SELECT 'admin', 'games.official_pause'
WHERE NOT EXISTS (
  SELECT 1 FROM rbac_role_permissions
  WHERE role = 'admin' AND permission_key = 'games.official_pause'
);

-- ---------------------------------------------------------------------------
-- Audit trail (Postgres; live board pause state remains Redis/engine)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_official_pause_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL,
  actor_display_name TEXT NOT NULL DEFAULT '',
  reason_key TEXT NOT NULL DEFAULT '',
  reason_label TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  event_id UUID REFERENCES hosted_events(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT match_official_pause_events_action_ok
    CHECK (action IN ('pause', 'resume')),
  CONSTRAINT match_official_pause_events_role_ok
    CHECK (actor_role IN ('admin', 'organizer'))
);

CREATE INDEX IF NOT EXISTS idx_match_official_pause_events_game_created
  ON match_official_pause_events (game_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_official_pause_events_actor_created
  ON match_official_pause_events (actor_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Reason catalog + chrome (platform_settings)
-- ---------------------------------------------------------------------------
INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'official_pause_chrome',
  '{
    "source": "database",
    "official_pause_chrome_unavailable": "Official pause chrome unavailable",
    "pause_action": "Official pause",
    "pause_pending": "Pausing…",
    "resume_action": "Official resume",
    "resume_pending": "Resuming…",
    "reason_label": "Reason",
    "reason_placeholder": "Select a reason",
    "note_label": "Note",
    "note_placeholder": "Optional note for players",
    "confirm_pause_title": "Pause this match?",
    "confirm_pause_description": "Both clocks freeze and moves are blocked until an official resume. Players cannot clear an official pause.",
    "confirm_resume_title": "Resume this match?",
    "confirm_resume_description": "Clocks continue from remaining time. Players can move again.",
    "confirm_cancel": "Cancel",
    "confirm_pause": "Pause match",
    "confirm_resume": "Resume match",
    "toast_paused": "Match officially paused",
    "toast_resumed": "Match officially resumed",
    "toast_pause_failed": "Could not officially pause the match",
    "toast_resume_failed": "Could not officially resume the match",
    "banner_paused_fmt": "Official pause · by {role} · {name} · {reason}",
    "banner_paused_note_fmt": "Official pause · by {role} · {name} · {reason} · {note}",
    "banner_since_fmt": "since {time}",
    "banner_resumed_fmt": "Resumed by {role} · {name}",
    "activity_title": "Match control",
    "activity_empty": "No official pause history yet",
    "activity_pause_fmt": "Paused by {role} · {name} · {reason}",
    "activity_resume_fmt": "Resumed by {role} · {name}",
    "status_live": "Live",
    "status_player_pause": "Player pause",
    "status_official_pause": "Official pause",
    "status_finished": "Finished",
    "col_match": "Match",
    "col_players": "Players",
    "col_status": "Status",
    "col_clock": "Clock",
    "col_paused_by": "Paused by",
    "col_reason": "Reason",
    "col_paused_at": "Paused at",
    "col_duration": "Paused for",
    "col_actions": "Actions",
    "filter_official_paused": "Officially paused only",
    "filter_all": "All live",
    "role_admin_label": "Admin",
    "role_organizer_label": "Organizer",
    "role_player_label": "Player",
    "clock_frozen_label": "Frozen",
    "err_forbidden": "You cannot officially pause or resume this match",
    "err_reason_required": "Choose a pause reason",
    "err_reason_invalid": "That pause reason is not available",
    "err_not_live": "This match is not live",
    "err_already_official": "This match is already under an official pause",
    "err_not_official": "This match is not under an official pause",
    "err_player_resume_blocked": "An official must resume this match",
    "err_game_finished": "This match has already finished",
    "err_note_too_long": "Note is too long",
    "reasons": [
      {"key": "tech_issue", "label": "Tech issue"},
      {"key": "dispute", "label": "Dispute"},
      {"key": "stream_delay", "label": "Stream delay"},
      {"key": "fairness_review", "label": "Fairness review"},
      {"key": "other", "label": "Other"}
    ]
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = platform_settings.value || EXCLUDED.value,
    updated_at = NOW();

-- Soft-heal reason list + critical keys if an older partial doc exists.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'source', COALESCE(NULLIF(trim(value->>'source'), ''), 'database'),
  'official_pause_chrome_unavailable', COALESCE(
    NULLIF(trim(value->>'official_pause_chrome_unavailable'), ''),
    'Official pause chrome unavailable'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';

-- Player board copy for official pause banners (play_chrome).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'official_paused_blurb', COALESCE(
    NULLIF(trim(value->>'official_paused_blurb'), ''),
    'An official paused this match. The clock is frozen and moves are blocked until they resume it.'
  ),
  'official_paused_by_fmt', COALESCE(
    NULLIF(trim(value->>'official_paused_by_fmt'), ''),
    'Paused by {role} · {name}'
  ),
  'official_paused_reason_fmt', COALESCE(
    NULLIF(trim(value->>'official_paused_reason_fmt'), ''),
    '{reason}'
  ),
  'official_paused_note_fmt', COALESCE(
    NULLIF(trim(value->>'official_paused_note_fmt'), ''),
    '{note}'
  ),
  'official_resumed_toast_fmt', COALESCE(
    NULLIF(trim(value->>'official_resumed_toast_fmt'), ''),
    'Resumed by {role} · {name}'
  ),
  'err_officially_paused', COALESCE(
    NULLIF(trim(value->>'err_officially_paused'), ''),
    'An official must resume this match'
  ),
  'pause_kind_player', COALESCE(
    NULLIF(trim(value->>'pause_kind_player'), ''),
    'Player pause'
  ),
  'pause_kind_official', COALESCE(
    NULLIF(trim(value->>'pause_kind_official'), ''),
    'Official pause'
  )
),
updated_at = NOW()
WHERE key = 'play_chrome';

-- Organizer manage-event chrome.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'official_pause_action', COALESCE(
    NULLIF(trim(value->>'official_pause_action'), ''),
    'Pause board'
  ),
  'official_pause_pending', COALESCE(
    NULLIF(trim(value->>'official_pause_pending'), ''),
    'Pausing…'
  ),
  'official_resume_action', COALESCE(
    NULLIF(trim(value->>'official_resume_action'), ''),
    'Resume board'
  ),
  'official_resume_pending', COALESCE(
    NULLIF(trim(value->>'official_resume_pending'), ''),
    'Resuming…'
  ),
  'toast_official_paused', COALESCE(
    NULLIF(trim(value->>'toast_official_paused'), ''),
    'Board officially paused'
  ),
  'toast_official_resumed', COALESCE(
    NULLIF(trim(value->>'toast_official_resumed'), ''),
    'Board officially resumed'
  ),
  'toast_official_pause_failed', COALESCE(
    NULLIF(trim(value->>'toast_official_pause_failed'), ''),
    'Could not pause the board'
  ),
  'toast_official_resume_failed', COALESCE(
    NULLIF(trim(value->>'toast_official_resume_failed'), ''),
    'Could not resume the board'
  ),
  'official_pause_status_label', COALESCE(
    NULLIF(trim(value->>'official_pause_status_label'), ''),
    'Official pause'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Official tournament console chrome.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'official_pause_action', COALESCE(
    NULLIF(trim(value->>'official_pause_action'), ''),
    'Pause board'
  ),
  'official_pause_pending', COALESCE(
    NULLIF(trim(value->>'official_pause_pending'), ''),
    'Pausing…'
  ),
  'official_resume_action', COALESCE(
    NULLIF(trim(value->>'official_resume_action'), ''),
    'Resume board'
  ),
  'official_resume_pending', COALESCE(
    NULLIF(trim(value->>'official_resume_pending'), ''),
    'Resuming…'
  ),
  'toast_official_paused', COALESCE(
    NULLIF(trim(value->>'toast_official_paused'), ''),
    'Board officially paused'
  ),
  'toast_official_resumed', COALESCE(
    NULLIF(trim(value->>'toast_official_resumed'), ''),
    'Board officially resumed'
  ),
  'toast_official_pause_failed', COALESCE(
    NULLIF(trim(value->>'toast_official_pause_failed'), ''),
    'Could not pause the board'
  ),
  'toast_official_resume_failed', COALESCE(
    NULLIF(trim(value->>'toast_official_resume_failed'), ''),
    'Could not resume the board'
  ),
  'official_pause_status_label', COALESCE(
    NULLIF(trim(value->>'official_pause_status_label'), ''),
    'Official pause'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
