-- Optional cash phone OTP: when OFF, saving a phone marks phone KYC verified
-- without the OTP challenge. Default OFF (admin Feature Flags can enable).
-- Distinct from cash_phone_kyc_required (whether phone KYC is required at all)
-- and from session otp_required (email/login OTP).
-- Existing DBs that already inserted TRUE are corrected once by mig 301.

INSERT INTO feature_flags (key, enabled, payload) VALUES
  ('cash_phone_otp_required', FALSE, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{toggles}',
  COALESCE(value->'toggles', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
      WHERE t->>'key' = 'cash_phone_otp_required'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'key', 'cash_phone_otp_required',
      'title', 'Cash phone OTP',
      'description', 'When on, players must verify the phone OTP after saving a number for cash KYC. When off, saving a phone marks KYC verified immediately.',
      'kind', 'boolean',
      'state_field', 'cashPhoneOtpRequired'
    ))
  END
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{toggles}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'key' = 'cash_phone_otp_required'
          THEN elem || jsonb_build_object('state_field', 'cashPhoneOtpRequired')
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';
