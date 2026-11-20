-- Admin status soft-lifecycle: after start, only Archive remains (no seat refund).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'status_after_start_blurb', COALESCE(
    NULLIF(trim(value->>'status_after_start_blurb'), ''),
    'After the cup starts, only Archive is available. Archiving a started or finished cup does not refund seats.'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
