-- Official pause: in-app notify kinds + organizer KPI chrome.
-- Soft-fill only. Idempotent.

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES
  (
    'player.official_pause',
    'player',
    'Match officially paused',
    'Your match was paused by %s (%s).',
    '/',
    'gameId'
  ),
  (
    'player.official_resume',
    'player',
    'Match officially resumed',
    'Your match was resumed by %s.',
    '/',
    'gameId'
  )
ON CONFLICT (code) DO UPDATE
SET title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    href_path = EXCLUDED.href_path,
    href_query_key = EXCLUDED.href_query_key;

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'kpi_paused_boards_label', COALESCE(
    NULLIF(trim(value->>'kpi_paused_boards_label'), ''),
    'Officially paused boards'
  ),
  'live_paused_section_title', COALESCE(
    NULLIF(trim(value->>'live_paused_section_title'), ''),
    'Live boards'
  ),
  'activity_section_title', COALESCE(
    NULLIF(trim(value->>'activity_section_title'), ''),
    'Pause activity'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
