-- Mig 392: Player-facing hosted-cup API errors missing from events_player_chrome.
-- writeEventsPlayerErr reads player chrome only; without these keys players fall back
-- to events_player_chrome_unavailable (or empty) on report/match/QR paths.
-- Soft-fill empty/missing; force known legacy Event wording. Idempotent.
-- Admin/ops Event language unchanged. Backend tables unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_catalog_unavailable',
  COALESCE(NULLIF(trim(value->>'err_catalog_unavailable'), ''), 'Tournament catalog unavailable'),
  'err_event_not_live',
  COALESCE(NULLIF(trim(value->>'err_event_not_live'), ''), 'Tournament is not live'),
  'err_match_not_found',
  COALESCE(NULLIF(trim(value->>'err_match_not_found'), ''), 'Match not found'),
  'err_match_not_ready',
  COALESCE(NULLIF(trim(value->>'err_match_not_ready'), ''), 'Match is not ready'),
  'err_players_missing',
  COALESCE(NULLIF(trim(value->>'err_players_missing'), ''), 'Players are missing for this match'),
  'qr_unavailable',
  COALESCE(NULLIF(trim(value->>'qr_unavailable'), ''), 'QR unavailable')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_catalog_unavailable', 'Tournament catalog unavailable',
  'err_event_not_live', 'Tournament is not live'
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(value->>'err_catalog_unavailable', '') ILIKE '%event%'
    OR COALESCE(value->>'err_event_not_live', '') ILIKE '%event%'
  );
