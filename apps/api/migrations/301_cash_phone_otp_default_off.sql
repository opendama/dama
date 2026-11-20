-- One-shot: seed cash_phone_otp_required OFF without fighting later admin toggles.
-- Marker in payload survives re-runs of idempotent Migrate().

UPDATE feature_flags
SET
  enabled = FALSE,
  payload = COALESCE(payload, '{}'::jsonb) || '{"seed_default":"off"}'::jsonb,
  updated_at = NOW()
WHERE key = 'cash_phone_otp_required'
  AND COALESCE(payload->>'seed_default', '') IS DISTINCT FROM 'off';
