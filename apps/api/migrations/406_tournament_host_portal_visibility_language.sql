-- Mig 406: Hosting portal Community label + analytics/visibility blurbs - Tournament wording.
-- Soft-fill if Event-sport regresses. Complements 401–405. Idempotent.
-- Backend tables unmerged. Admin Events catalog unchanged.
-- Points stay shared via ClassicCupEngagementAwards (Official + Community).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'portal_public_list_label',
  CASE
    WHEN COALESCE(trim(value->>'portal_public_list_label'), '') ~* 'event'
      THEN 'Community tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'portal_public_list_label'), ''), 'Community tournaments')
  END,
  'analytics_blurb',
  CASE
    WHEN COALESCE(trim(value->>'analytics_blurb'), '') ~* 'event'
      THEN 'Joins, completions, and fees for cups you host.'
    ELSE COALESCE(NULLIF(trim(value->>'analytics_blurb'), ''), 'Joins, completions, and fees for cups you host.')
  END,
  'visibility_public_blurb',
  CASE
    WHEN COALESCE(trim(value->>'visibility_public_blurb'), '') ~* 'event'
      THEN 'Listed under Community tournaments when public cups are enabled.'
    ELSE COALESCE(NULLIF(trim(value->>'visibility_public_blurb'), ''), 'Listed under Community tournaments when public cups are enabled.')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'portal_public_list_label'), '') ~* 'event'
    OR COALESCE(trim(value->>'analytics_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'visibility_public_blurb'), '') ~* 'event'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'visibility_public_blurb',
  CASE
    WHEN COALESCE(trim(value->>'visibility_public_blurb'), '') ~* 'event'
      THEN 'Listed under Community tournaments when public cups are enabled.'
    ELSE COALESCE(NULLIF(trim(value->>'visibility_public_blurb'), ''), 'Listed under Community tournaments when public cups are enabled.')
  END
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND COALESCE(trim(value->>'visibility_public_blurb'), '') ~* 'event';
