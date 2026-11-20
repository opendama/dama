-- Mig 409: Belt-and-suspenders - force player/Hosting list chrome off Event sport.
-- Complements 187 seed hardening + 377/380/402/403 soft-fills. Idempotent.
-- Backend tables stay hosted_events / events_* keys; admin ops chrome may keep Event.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'public_list_title', 'Community tournaments',
  'public_list_blurb', 'Open community tournaments anyone can join.',
  'public_list_empty', 'No community tournaments open right now.',
  'report_action',
  CASE
    WHEN COALESCE(trim(value->>'report_action'), '') ~* 'event'
      THEN 'Report tournament'
    ELSE COALESCE(NULLIF(trim(value->>'report_action'), ''), 'Report tournament')
  END,
  'report_title',
  CASE
    WHEN COALESCE(trim(value->>'report_title'), '') ~* 'event'
      THEN 'Report this tournament'
    ELSE COALESCE(NULLIF(trim(value->>'report_title'), ''), 'Report this tournament')
  END
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(trim(value->>'public_list_title'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_empty'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_title'), '') ~* 'event'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'public_list_title', 'Community tournaments',
  'public_list_blurb', 'Open community tournaments anyone can join.',
  'public_list_empty', 'No community tournaments open right now.',
  'portal_create_label',
  CASE
    WHEN COALESCE(trim(value->>'portal_create_label'), '') ~* 'event'
      THEN 'Host a tournament'
    ELSE COALESCE(NULLIF(trim(value->>'portal_create_label'), ''), 'Host a tournament')
  END,
  'portal_public_list_label',
  CASE
    WHEN COALESCE(trim(value->>'portal_public_list_label'), '') ~* 'event'
      THEN 'Community tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'portal_public_list_label'), ''), 'Community tournaments')
  END,
  'public_disabled',
  CASE
    WHEN COALESCE(trim(value->>'public_disabled'), '') ~* 'event'
      THEN 'Community tournaments are temporarily unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'public_disabled'), ''), 'Community tournaments are temporarily unavailable')
  END,
  'visibility_public_blurb',
  CASE
    WHEN COALESCE(trim(value->>'visibility_public_blurb'), '') ~* 'event'
      THEN 'Listed in Community tournaments when public cups are enabled.'
    ELSE COALESCE(NULLIF(trim(value->>'visibility_public_blurb'), ''), 'Listed in Community tournaments when public cups are enabled.')
  END,
  'report_action',
  CASE
    WHEN COALESCE(trim(value->>'report_action'), '') ~* 'event'
      THEN 'Report tournament'
    ELSE COALESCE(NULLIF(trim(value->>'report_action'), ''), 'Report tournament')
  END,
  'report_title',
  CASE
    WHEN COALESCE(trim(value->>'report_title'), '') ~* 'event'
      THEN 'Report this tournament'
    ELSE COALESCE(NULLIF(trim(value->>'report_title'), ''), 'Report this tournament')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'public_list_title'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_empty'), '') ~* 'event'
    OR COALESCE(trim(value->>'portal_create_label'), '') ~* 'event'
    OR COALESCE(trim(value->>'portal_public_list_label'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_disabled'), '') ~* 'event'
    OR COALESCE(trim(value->>'visibility_public_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_title'), '') ~* 'event'
  );
