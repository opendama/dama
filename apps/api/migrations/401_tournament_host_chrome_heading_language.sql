-- Mig 401: Hosting page headings - Tournament wording if Event-sport regresses.
-- Soft-fill list_title / dashboard_title / create_* / analytics_title (nav tabs already client-remapped).
-- Idempotent. Backend tables unmerged. Admin Events catalog unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_title',
  CASE
    WHEN COALESCE(trim(value->>'list_title'), '') ~* '^(My events|Events|Event)$'
      THEN 'My hosted tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'list_title'), ''), 'My hosted tournaments')
  END,
  'dashboard_title',
  CASE
    WHEN COALESCE(trim(value->>'dashboard_title'), '') ~* '^(Events dashboard|Events|Event dashboard)$'
      THEN 'Hosting dashboard'
    ELSE COALESCE(NULLIF(trim(value->>'dashboard_title'), ''), 'Hosting dashboard')
  END,
  'create_action',
  CASE
    WHEN COALESCE(trim(value->>'create_action'), '') ~* '^(Create event|Create)$'
      THEN 'Host a tournament'
    ELSE COALESCE(NULLIF(trim(value->>'create_action'), ''), 'Host a tournament')
  END,
  'create_title',
  CASE
    WHEN COALESCE(trim(value->>'create_title'), '') ~* 'event'
      THEN 'Host a community tournament'
    ELSE COALESCE(NULLIF(trim(value->>'create_title'), ''), 'Host a community tournament')
  END,
  'analytics_title',
  CASE
    WHEN COALESCE(trim(value->>'analytics_title'), '') ~* 'event'
      THEN 'Hosting analytics'
    ELSE COALESCE(NULLIF(trim(value->>'analytics_title'), ''), 'Hosting analytics')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'list_title'), '') ~* '^(My events|Events|Event)$'
    OR COALESCE(trim(value->>'dashboard_title'), '') ~* '^(Events dashboard|Events|Event dashboard)$'
    OR COALESCE(trim(value->>'create_action'), '') ~* '^(Create event|Create)$'
    OR COALESCE(trim(value->>'create_title'), '') ~* 'event'
    OR COALESCE(trim(value->>'analytics_title'), '') ~* 'event'
  );
