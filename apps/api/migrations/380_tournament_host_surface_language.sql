-- Mig 380: Host-facing chrome - Tournament language (players who host).
-- Admin events_admin_chrome stays ops. Backend tables unchanged.
-- Idempotent: force known legacy “Event(s)” sport copy.

-- ---------------------------------------------------------------------------
-- Organizer create / list / manage labels hosts see.
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'brand_name', COALESCE(NULLIF(trim(value->>'brand_name'), ''), 'Dama Hosting'),
  'title_label', COALESCE(NULLIF(trim(value->>'title_label'), ''), 'Tournament name'),
  'logo_label', COALESCE(NULLIF(trim(value->>'logo_label'), ''), 'Tournament logo'),
  'search_label', COALESCE(NULLIF(trim(value->>'search_label'), ''), 'Search tournaments'),
  'empty_list', COALESCE(NULLIF(trim(value->>'empty_list'), ''), 'No hosted tournaments yet.'),
  'analytics_title', COALESCE(NULLIF(trim(value->>'analytics_title'), ''), 'Hosting analytics'),
  'analytics_empty', COALESCE(NULLIF(trim(value->>'analytics_empty'), ''), 'No hosted tournaments yet.'),
  'public_list_title', COALESCE(NULLIF(trim(value->>'public_list_title'), ''), 'Community tournaments'),
  'public_list_empty', COALESCE(NULLIF(trim(value->>'public_list_empty'), ''), 'No community tournaments open right now.'),
  'public_disabled', COALESCE(NULLIF(trim(value->>'public_disabled'), ''), 'Community tournaments are temporarily unavailable'),
  'visibility_public_blurb', COALESCE(NULLIF(trim(value->>'visibility_public_blurb'), ''),
    'Listed under Community tournaments when public cups are enabled.'),
  'toast_created', COALESCE(NULLIF(trim(value->>'toast_created'), ''), 'Tournament created'),
  'toast_started', COALESCE(NULLIF(trim(value->>'toast_started'), ''), 'Tournament started'),
  'toast_closed', COALESCE(NULLIF(trim(value->>'toast_closed'), ''), 'Tournament closed'),
  'toast_cancelled', COALESCE(NULLIF(trim(value->>'toast_cancelled'), ''), 'Tournament cancelled'),
  'toast_reopened', COALESCE(NULLIF(trim(value->>'toast_reopened'), ''), 'Tournament reopened'),
  'close_action', COALESCE(NULLIF(trim(value->>'close_action'), ''), 'Close tournament'),
  -- Dialog dismiss label (create/report/payment) - not “cancel the cup”.
  'cancel_action', COALESCE(NULLIF(trim(value->>'cancel_action'), ''), 'Cancel'),
  'reopen_action', COALESCE(NULLIF(trim(value->>'reopen_action'), ''), 'Reopen tournament'),
  'report_action', COALESCE(NULLIF(trim(value->>'report_action'), ''), 'Report tournament'),
  'report_title', COALESCE(NULLIF(trim(value->>'report_title'), ''), 'Report this tournament'),
  'event_full', COALESCE(NULLIF(trim(value->>'event_full'), ''), 'This tournament is full'),
  'already_started', COALESCE(NULLIF(trim(value->>'already_started'), ''), 'Tournament already started'),
  'cannot_join_status', COALESCE(NULLIF(trim(value->>'cannot_join_status'), ''), 'This tournament is not open for joining'),
  'toast_create_failed', COALESCE(NULLIF(trim(value->>'toast_create_failed'), ''), 'Could not create tournament'),
  'toast_start_failed', COALESCE(NULLIF(trim(value->>'toast_start_failed'), ''), 'Could not start tournament'),
  'toast_close_failed', COALESCE(NULLIF(trim(value->>'toast_close_failed'), ''), 'Could not close tournament'),
  'toast_reopen_failed', COALESCE(NULLIF(trim(value->>'toast_reopen_failed'), ''), 'Could not reopen tournament'),
  'upload_logo_failed', COALESCE(NULLIF(trim(value->>'upload_logo_failed'), ''), 'Could not upload tournament logo'),
  'patch_title_locked', COALESCE(NULLIF(trim(value->>'patch_title_locked'), ''), 'Title can only change while the tournament is open'),
  'cannot_reopen_blurb', COALESCE(NULLIF(trim(value->>'cannot_reopen_blurb'), ''),
    'This tournament already ran or finished and cannot be reopened.')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Force known legacy Event sport copy (may already be non-empty).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'brand_name', 'Dama Hosting',
    'title_label', 'Tournament name',
    'logo_label', 'Tournament logo',
    'search_label', 'Search tournaments',
    'empty_list', 'No hosted tournaments yet.',
    'analytics_title', 'Hosting analytics',
    'analytics_empty', 'No hosted tournaments yet.',
    'public_list_title', 'Community tournaments',
    'public_list_empty', 'No community tournaments open right now.',
    'public_disabled', 'Community tournaments are temporarily unavailable',
    'visibility_public_blurb', 'Listed under Community tournaments when public cups are enabled.',
    'toast_created', 'Tournament created',
    'toast_started', 'Tournament started',
    'toast_closed', 'Tournament closed',
    'toast_cancelled', 'Tournament cancelled',
    'toast_reopened', 'Tournament reopened',
    'close_action', 'Close tournament',
    'cancel_action', 'Cancel',
    'reopen_action', 'Reopen tournament',
    'report_action', 'Report tournament',
    'report_title', 'Report this tournament',
    'event_full', 'This tournament is full',
    'already_started', 'Tournament already started',
    'cannot_join_status', 'This tournament is not open for joining',
    'toast_create_failed', 'Could not create tournament',
    'toast_start_failed', 'Could not start tournament',
    'toast_close_failed', 'Could not close tournament',
    'toast_reopen_failed', 'Could not reopen tournament',
    'upload_logo_failed', 'Could not upload tournament logo',
    'patch_title_locked', 'Title can only change while the tournament is open',
    'cannot_reopen_blurb', 'This tournament already ran or finished and cannot be reopened.'
  ),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(value->>'brand_name', '') ILIKE '%event%'
    OR COALESCE(value->>'title_label', '') ILIKE '%event%'
    OR COALESCE(value->>'search_label', '') ILIKE '%event%'
    OR COALESCE(value->>'empty_list', '') ILIKE '%event%'
    OR COALESCE(value->>'public_list_title', '') ILIKE '%event%'
    OR COALESCE(value->>'visibility_public_blurb', '') ILIKE '%event%'
    OR COALESCE(value->>'toast_created', '') ILIKE '%event%'
    OR COALESCE(value->>'close_action', '') ILIKE '%event%'
  );

-- ---------------------------------------------------------------------------
-- Est. share blurbs: “event ends” → “tournament ends” (player lobbies).
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{est_prize_share_blurb}',
  to_jsonb('Estimated from current pot and points. Final amount locks when the tournament ends.'::text)
),
updated_at = NOW()
WHERE key IN ('tournaments_player_chrome', 'events_player_chrome')
  AND COALESCE(value->>'est_prize_share_blurb', '') ILIKE '%event ends%';

-- Player chrome visibility blurb if still Event-worded.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{visibility_public_blurb}',
  to_jsonb('Listed under Community tournaments when public cups are enabled.'::text)
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND COALESCE(value->>'visibility_public_blurb', '') ILIKE '%event%';

-- Host API error chrome (still shown to organizers on failure).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_cannot_close', 'This tournament cannot be closed',
  'err_cannot_start', 'This tournament cannot be started',
  'err_close_failed', 'Unable to close tournament',
  'err_create_failed', 'Unable to create tournament',
  'err_event_not_editable', 'This tournament cannot be edited',
  'err_event_not_found', 'Tournament not found',
  'err_event_not_live', 'Tournament is not live',
  'err_list_failed', 'Unable to load tournaments',
  'err_start_failed', 'Unable to start tournament',
  'err_update_failed', 'Unable to update tournament'
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(value->>'err_event_not_found', '') ILIKE '%event%'
    OR COALESCE(value->>'err_list_failed', '') ILIKE '%event%'
  );

-- ---------------------------------------------------------------------------
-- events_player_chrome: Community tab / join / lobby (player-facing).
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'carousel_aria', 'Tournament media',
  'err_event_not_found', 'Tournament not found',
  'err_forbidden', 'You cannot view this tournament',
  'event_full', 'This tournament is full',
  'event_not_joinable', 'This tournament is not open for joining',
  'feature_disabled', 'Community tournaments are temporarily unavailable',
  'kicked_blurb', 'You were removed from this tournament',
  'load_failed', 'Could not load tournament',
  'lobby_title', 'Cup lobby',
  'public_disabled', 'Community tournaments are temporarily unavailable',
  'report_action', 'Report tournament',
  'report_title', 'Report this tournament',
  'search_placeholder', 'Search tournaments'
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(value->>'lobby_title', '') ILIKE '%event%'
    OR COALESCE(value->>'search_placeholder', '') ILIKE '%event%'
    OR COALESCE(value->>'report_action', '') ILIKE '%event%'
    OR COALESCE(value->>'feature_disabled', '') ILIKE '%event%'
  );
