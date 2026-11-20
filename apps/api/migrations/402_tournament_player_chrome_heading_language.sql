-- Mig 402: Player Community headings - Tournament wording if Event-sport regresses.
-- Soft-fill page_title / public_list_* / join_title / lobby_title / empty_* / feature_disabled.
-- Idempotent. Hosting organizer headings covered by 401. Backend tables unmerged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'page_title',
  CASE
    WHEN COALESCE(trim(value->>'page_title'), '') ~* 'event'
      THEN 'Community tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'page_title'), ''), 'Community tournaments')
  END,
  'public_list_title',
  CASE
    WHEN COALESCE(trim(value->>'public_list_title'), '') ~* 'event'
      THEN 'Community tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'public_list_title'), ''), 'Community tournaments')
  END,
  'public_list_blurb',
  CASE
    WHEN COALESCE(trim(value->>'public_list_blurb'), '') ~* 'event'
      THEN 'Open community tournaments anyone can join.'
    ELSE COALESCE(NULLIF(trim(value->>'public_list_blurb'), ''), 'Open community tournaments anyone can join.')
  END,
  'public_list_empty',
  CASE
    WHEN COALESCE(trim(value->>'public_list_empty'), '') ~* 'event'
      THEN 'No community tournaments open right now.'
    ELSE COALESCE(NULLIF(trim(value->>'public_list_empty'), ''), 'No community tournaments open right now.')
  END,
  'empty_web',
  CASE
    WHEN COALESCE(trim(value->>'empty_web'), '') ~* 'event'
      THEN 'No community tournaments open right now.'
    ELSE COALESCE(NULLIF(trim(value->>'empty_web'), ''), 'No community tournaments open right now.')
  END,
  'join_title',
  CASE
    WHEN COALESCE(trim(value->>'join_title'), '') ~* '^(Join event|Join Event|Events|Join)$'
      THEN 'Join with code'
    ELSE COALESCE(NULLIF(trim(value->>'join_title'), ''), 'Join with code')
  END,
  'lobby_title',
  CASE
    WHEN COALESCE(trim(value->>'lobby_title'), '') ~* 'event'
      THEN 'Cup lobby'
    ELSE COALESCE(NULLIF(trim(value->>'lobby_title'), ''), 'Cup lobby')
  END,
  'feature_disabled',
  CASE
    WHEN COALESCE(trim(value->>'feature_disabled'), '') ~* 'event'
      THEN 'Community tournaments are temporarily unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'feature_disabled'), ''), 'Community tournaments are temporarily unavailable')
  END,
  'page_blurb',
  CASE
    WHEN COALESCE(trim(value->>'page_blurb'), '') ~* 'event'
      THEN 'Browse community tournaments or join with a code.'
    ELSE COALESCE(NULLIF(trim(value->>'page_blurb'), ''), 'Browse community tournaments or join with a code.')
  END
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(trim(value->>'page_title'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_title'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_empty'), '') ~* 'event'
    OR COALESCE(trim(value->>'empty_web'), '') ~* 'event'
    OR COALESCE(trim(value->>'join_title'), '') ~* '^(Join event|Join Event|Events|Join)$'
    OR COALESCE(trim(value->>'lobby_title'), '') ~* 'event'
    OR COALESCE(trim(value->>'feature_disabled'), '') ~* 'event'
    OR COALESCE(trim(value->>'page_blurb'), '') ~* 'event'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'page_title',
  CASE
    WHEN COALESCE(trim(value->>'page_title'), '') ~* 'event'
      THEN 'Tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'page_title'), ''), 'Tournaments')
  END,
  'empty_community',
  CASE
    WHEN COALESCE(trim(value->>'empty_community'), '') ~* 'event'
      THEN 'No community tournaments open right now.'
    ELSE COALESCE(NULLIF(trim(value->>'empty_community'), ''), 'No community tournaments open right now.')
  END,
  'lobby_title',
  CASE
    WHEN COALESCE(trim(value->>'lobby_title'), '') ~* 'event'
      THEN 'Cup lobby'
    ELSE COALESCE(NULLIF(trim(value->>'lobby_title'), ''), 'Cup lobby')
  END
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome'
  AND (
    COALESCE(trim(value->>'page_title'), '') ~* 'event'
    OR COALESCE(trim(value->>'empty_community'), '') ~* 'event'
    OR COALESCE(trim(value->>'lobby_title'), '') ~* 'event'
  );
