-- Mig 379: Remaining player/host chrome - no “Event” sport name.
-- Idempotent soft-fill + force known legacy join/start titles.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'join_title',
  COALESCE(NULLIF(trim(value->>'join_title'), ''), 'Join with code'),
  'join_blurb',
  COALESCE(NULLIF(trim(value->>'join_blurb'), ''),
    'Enter a join code or open a shared link.')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{join_title}',
  to_jsonb('Join with code'::text)
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND COALESCE(value->>'join_title', '') IN ('Join event', 'Join Event', 'Events', 'Join');

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'start_action',
  COALESCE(NULLIF(trim(value->>'start_action'), ''), 'Start tournament')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{start_action}',
  to_jsonb('Start tournament'::text)
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND COALESCE(value->>'start_action', '') IN ('Start event', 'Start Event', 'Start');

-- ---------------------------------------------------------------------------
-- Player notification titles/hrefs: Tournament language + Community deep link.
-- Organizer money/manage hrefs (/events/events, /events/join) stay host portal.
-- ---------------------------------------------------------------------------
UPDATE notification_kinds
SET title_template = CASE code
  WHEN 'player.event_joined' THEN 'Joined tournament'
  WHEN 'player.event_started' THEN 'Tournament started'
  WHEN 'player.event_finished' THEN 'Tournament finished'
  WHEN 'player.event_cancelled' THEN 'Tournament cancelled'
  WHEN 'player.event_reopened' THEN 'Tournament reopened'
  WHEN 'player.event_auto_closed' THEN 'Tournament finished'
  WHEN 'player.event_created' THEN 'Tournament created'
  WHEN 'player.event_started_org' THEN 'Tournament started'
  WHEN 'player.event_entry_kicked' THEN 'Removed from tournament'
  WHEN 'player.event_report_received' THEN 'Report received'
  ELSE title_template
END,
href_path = CASE
  WHEN href_path = '/?view=events' THEN '/?view=tournaments&source=community'
  ELSE href_path
END
WHERE code IN (
  'player.event_joined',
  'player.event_started',
  'player.event_finished',
  'player.event_cancelled',
  'player.event_reopened',
  'player.event_auto_closed',
  'player.event_created',
  'player.event_started_org',
  'player.event_entry_kicked',
  'player.event_report_received',
  'player.competition_check_in_open',
  'player.competition_dispute_open'
);
