-- Mig 403: Residual Event-sport player/organizer action chrome → Tournament.
-- Soft-fill search/report/start/close/feature_disabled/public_*/empty_official.
-- Complements 401 (Hosting headings) + 402 (Community headings). Idempotent.
-- Backend tables unmerged. Admin Events catalog unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'feature_disabled',
  CASE
    WHEN COALESCE(trim(value->>'feature_disabled'), '') ~* 'event'
      THEN 'Community tournaments are temporarily unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'feature_disabled'), ''), 'Community tournaments are temporarily unavailable')
  END,
  'public_disabled',
  CASE
    WHEN COALESCE(trim(value->>'public_disabled'), '') ~* 'event'
      THEN 'Community tournaments are temporarily unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'public_disabled'), ''), 'Community tournaments are temporarily unavailable')
  END,
  'public_list_empty',
  CASE
    WHEN COALESCE(trim(value->>'public_list_empty'), '') ~* 'event'
      THEN 'No community tournaments open right now.'
    ELSE COALESCE(NULLIF(trim(value->>'public_list_empty'), ''), 'No community tournaments open right now.')
  END,
  'search_placeholder',
  CASE
    WHEN COALESCE(trim(value->>'search_placeholder'), '') ~* 'event'
      THEN 'Search tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'search_placeholder'), ''), 'Search tournaments')
  END,
  'search_label',
  CASE
    WHEN COALESCE(trim(value->>'search_label'), '') ~* 'event'
      THEN 'Search'
    ELSE COALESCE(NULLIF(trim(value->>'search_label'), ''), 'Search')
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
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(trim(value->>'feature_disabled'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_disabled'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_empty'), '') ~* 'event'
    OR COALESCE(trim(value->>'search_placeholder'), '') ~* 'event'
    OR COALESCE(trim(value->>'search_label'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_title'), '') ~* 'event'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'empty_official',
  CASE
    WHEN COALESCE(trim(value->>'empty_official'), '') ~* 'event'
      THEN 'No official tournaments open right now.'
    ELSE COALESCE(NULLIF(trim(value->>'empty_official'), ''), 'No official tournaments open right now.')
  END,
  'empty',
  CASE
    WHEN COALESCE(trim(value->>'empty'), '') ~* 'event'
      THEN 'No tournaments yet.'
    ELSE COALESCE(NULLIF(trim(value->>'empty'), ''), 'No tournaments yet.')
  END,
  'search_placeholder',
  CASE
    WHEN COALESCE(trim(value->>'search_placeholder'), '') ~* 'event'
      THEN 'Search tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'search_placeholder'), ''), 'Search tournaments')
  END,
  'search_label',
  CASE
    WHEN COALESCE(trim(value->>'search_label'), '') ~* 'event'
      THEN 'Search'
    ELSE COALESCE(NULLIF(trim(value->>'search_label'), ''), 'Search')
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
WHERE key = 'tournaments_player_chrome'
  AND (
    COALESCE(trim(value->>'empty_official'), '') ~* 'event'
    OR COALESCE(trim(value->>'empty'), '') ~* 'event'
    OR COALESCE(trim(value->>'search_placeholder'), '') ~* 'event'
    OR COALESCE(trim(value->>'search_label'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_title'), '') ~* 'event'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'feature_disabled',
  CASE
    WHEN COALESCE(trim(value->>'feature_disabled'), '') ~* 'event'
      THEN 'Community tournaments are temporarily unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'feature_disabled'), ''), 'Community tournaments are temporarily unavailable')
  END,
  'public_disabled',
  CASE
    WHEN COALESCE(trim(value->>'public_disabled'), '') ~* 'event'
      THEN 'Community tournaments are temporarily unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'public_disabled'), ''), 'Community tournaments are temporarily unavailable')
  END,
  'public_list_empty',
  CASE
    WHEN COALESCE(trim(value->>'public_list_empty'), '') ~* 'event'
      THEN 'No community tournaments open right now.'
    ELSE COALESCE(NULLIF(trim(value->>'public_list_empty'), ''), 'No community tournaments open right now.')
  END,
  'start_action',
  CASE
    WHEN COALESCE(trim(value->>'start_action'), '') ~* 'event'
      THEN 'Start tournament'
    ELSE COALESCE(NULLIF(trim(value->>'start_action'), ''), 'Start tournament')
  END,
  'close_action',
  CASE
    WHEN COALESCE(trim(value->>'close_action'), '') ~* 'event'
      THEN 'Close tournament'
    ELSE COALESCE(NULLIF(trim(value->>'close_action'), ''), 'Close tournament')
  END,
  'search_placeholder',
  CASE
    WHEN COALESCE(trim(value->>'search_placeholder'), '') ~* 'event'
      THEN 'Search by name or code'
    ELSE COALESCE(NULLIF(trim(value->>'search_placeholder'), ''), 'Search by name or code')
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
    COALESCE(trim(value->>'feature_disabled'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_disabled'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_list_empty'), '') ~* 'event'
    OR COALESCE(trim(value->>'start_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'close_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'search_placeholder'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'report_title'), '') ~* 'event'
  );
