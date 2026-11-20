-- Knockout cups may use score_share (same freeze → finish → pot×points/total escrow as RR/Swiss/Groups).
-- places_percent remains the KO default / optional alternate. Chrome key kept for fail-closed clients;
-- refresh legacy "places % only" copy when still present.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{err_payout_mode_score_share_knockout}',
  to_jsonb('Invalid payout mode for this format'::text),
  true
),
updated_at = NOW()
WHERE key IN ('tournament_chrome', 'events_organizer_chrome')
  AND trim(COALESCE(value->>'err_payout_mode_score_share_knockout', '')) IN (
    '',
    'Knockout cups use places % only'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_payout_mode_score_share_knockout', COALESCE(
    NULLIF(trim(value->>'err_payout_mode_score_share_knockout'), ''),
    'Invalid payout mode for this format'
  )
),
updated_at = NOW()
WHERE key IN ('tournament_chrome', 'events_organizer_chrome');
