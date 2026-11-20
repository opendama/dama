-- When cash phone OTP is off, a saved primary_phone completes KYC.
-- Heal rows where payout mirroring (or similar) left phone set but stamp NULL.

UPDATE users u
SET phone_kyc_verified_at = NOW(),
    updated_at = NOW()
WHERE NULLIF(trim(COALESCE(u.primary_phone, '')), '') IS NOT NULL
  AND u.phone_kyc_verified_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM feature_flags f
    WHERE f.key = 'cash_phone_otp_required'
      AND f.enabled = FALSE
  );
