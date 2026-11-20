-- Players need join+code deep links for started/finished (organizer auto_closed stays dashboard).
UPDATE notification_kinds
SET href_path = '/events/join',
    href_query_key = 'code'
WHERE code IN ('player.event_started', 'player.event_finished');

-- Keep organizer auto-close notice on the host dashboard (no join code).
UPDATE notification_kinds
SET href_path = '/events/dashboard',
    href_query_key = ''
WHERE code = 'player.event_auto_closed';

-- Player-facing career/rated copy for public cups (DB chrome only).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'public_rated_on_blurb',
    COALESCE(
      NULLIF(trim(value->>'public_rated_on_blurb'), ''),
      'Wins and losses in this public cup count toward career XP, W-L, and rating.'
    ),
    'public_rated_off_blurb',
    COALESCE(
      NULLIF(trim(value->>'public_rated_off_blurb'), ''),
      'Cup matches are for the bracket only. Career rating stays unchanged.'
    )
  ),
  updated_at = NOW()
WHERE key = 'events_player_chrome';
