-- Mig 407: Hosting search_label + create_blurb + analytics_empty - Tournament wording.
-- Soft-fill if Event-sport regresses. Complements 401–406. Idempotent.
-- Backend tables unmerged. Admin Events catalog unchanged.
-- Points stay shared via ClassicCupEngagementAwards (Official + Community).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'search_label',
  CASE
    WHEN COALESCE(trim(value->>'search_label'), '') ~* 'event'
      THEN 'Search tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'search_label'), ''), 'Search tournaments')
  END,
  'create_blurb',
  CASE
    WHEN COALESCE(trim(value->>'create_blurb'), '') ~* 'event'
      THEN 'Pay the host fee to publish. Join code, link, and QR unlock after payment.'
    ELSE COALESCE(NULLIF(trim(value->>'create_blurb'), ''), 'Pay the host fee to publish. Join code, link, and QR unlock after payment.')
  END,
  'analytics_empty',
  CASE
    WHEN COALESCE(trim(value->>'analytics_empty'), '') ~* 'event'
      THEN 'No hosted tournaments yet.'
    ELSE COALESCE(NULLIF(trim(value->>'analytics_empty'), ''), 'No hosted tournaments yet.')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'search_label'), '') ~* 'event'
    OR COALESCE(trim(value->>'create_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'analytics_empty'), '') ~* 'event'
  );
