-- Admin review conflict copy: already-reviewed receipt + invalid payout transition.
-- Fail-closed; idempotent. Used for HTTP 409 dual-actuator / stale-action responses.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'toast_receipt_already_reviewed', COALESCE(
      NULLIF(trim(value->'payments'->>'toast_receipt_already_reviewed'), ''),
      'This receipt was already reviewed.'
    ),
    'payout_transition_conflict', COALESCE(
      NULLIF(trim(value->'payments'->>'payout_transition_conflict'), ''),
      'That payout status change is not allowed anymore.'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
