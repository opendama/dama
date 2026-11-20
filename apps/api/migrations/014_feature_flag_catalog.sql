-- Console feature-flag UI catalog (keys, labels, modes) from DB only.
INSERT INTO platform_settings (key, value) VALUES
  (
    'feature_flag_catalog',
    '{
      "toggles": [
        {
          "key": "vs_ai_practice_mode",
          "title": "VS-AI practice mode",
          "description": "Non-monetary Play Against Computer menu across web and mobile.",
          "kind": "boolean",
          "state_field": "vsAiEnabled"
        },
        {
          "key": "global_otp_verification",
          "title": "Global OTP verification",
          "description": "Require OTP gate on authentication flows.",
          "kind": "boolean",
          "state_field": "otpRequired"
        },
        {
          "key": "ethiopian_payment_mode",
          "title": "Ethiopian payment mode",
          "description": "Domestic gateway mode for Ethiopia (local checkout vs manual transfer).",
          "kind": "mode",
          "state_field": "ethiopiaPaymentMode"
        }
      ],
      "ai_depths_flag_key": "vs_ai_practice_mode"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
