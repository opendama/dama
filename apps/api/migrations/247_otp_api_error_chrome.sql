-- OTP API + gate middleware errors from otp_chrome (no invent unauthorized / verification English).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_unauthorized": "Sign in required",
  "err_not_required": "Verification is not required",
  "err_challenge_required": "Challenge id and code are required",
  "err_verification_required": "Verification required",
  "err_verification_unavailable": "Verification unavailable"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'otp_chrome';

-- Geo heartbeat presence failure (wallet chrome; same session path as locate).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_presence_unavailable": "Presence unavailable"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'wallet_chrome';
