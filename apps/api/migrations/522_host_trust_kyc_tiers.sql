-- Host trust tiers + KYC auto-approve (default ON) + guarantee document KYC gate.
-- Escrow remains the payout safety net; this layer identity-gates create risk.

-- ---------------------------------------------------------------------------
-- Feature flag: kyc_auto_approve (default ENABLED)
-- When ON: document KYC submit auto-approves (stamps users.document_kyc_verified_at).
-- When OFF: admin manual ReviewConsole path only.
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, enabled, payload) VALUES
  ('kyc_auto_approve', TRUE, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{toggles}',
  COALESCE(value->'toggles', '[]'::jsonb) || CASE
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
      WHERE t->>'key' = 'kyc_auto_approve'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'key', 'kyc_auto_approve',
      'title', 'KYC auto-approve',
      'description', 'When on, government-ID document KYC submissions are approved automatically. When off, admins must review and approve manually.',
      'kind', 'boolean',
      'state_field', 'kycAutoApprove'
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
        WHEN elem->>'key' = 'kyc_auto_approve'
          THEN elem || jsonb_build_object(
            'state_field', 'kycAutoApprove',
            'title', COALESCE(NULLIF(trim(elem->>'title'), ''), 'KYC auto-approve'),
            'description', COALESCE(
              NULLIF(trim(elem->>'description'), ''),
              'When on, government-ID document KYC submissions are approved automatically. When off, admins must review and approve manually.'
            )
          )
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';

-- ---------------------------------------------------------------------------
-- cash_rmg_policy: host create gates + trust tier machine codes
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'host_guarantee_requires_document_kyc',
  COALESCE((value->>'host_guarantee_requires_document_kyc')::boolean, TRUE),
  'host_paid_create_requires_phone_kyc',
  COALESCE((value->>'host_paid_create_requires_phone_kyc')::boolean, TRUE),
  'host_trust_tier_unverified',
  COALESCE(NULLIF(trim(value->>'host_trust_tier_unverified'), ''), 'unverified'),
  'host_trust_tier_phone_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_tier_phone_verified'), ''), 'phone_verified'),
  'host_trust_tier_document_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_tier_document_verified'), ''), 'document_verified')
),
updated_at = NOW()
WHERE key = 'cash_rmg_policy';

-- ---------------------------------------------------------------------------
-- cash_rmg_chrome: host trust badge labels + auto-approve success copy
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'host_trust_badge_unverified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_unverified'), ''), 'Unverified host'),
  'host_trust_badge_phone_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_phone_verified'), ''), 'Phone verified'),
  'host_trust_badge_document_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_document_verified'), ''), 'Verified host'),
  'doc_kyc_auto_approved_success',
  COALESCE(
    NULLIF(trim(value->>'doc_kyc_auto_approved_success'), ''),
    'Identity verified. You can host guaranteed prize cups.'
  )
),
updated_at = NOW()
WHERE key = 'cash_rmg_chrome';

-- ---------------------------------------------------------------------------
-- Organizer create gate errors
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'err_host_guarantee_requires_document_kyc',
  COALESCE(
    NULLIF(trim(value->>'err_host_guarantee_requires_document_kyc'), ''),
    'Document identity verification is required before posting a prize guarantee.'
  ),
  'err_host_paid_requires_phone_kyc',
  COALESCE(
    NULLIF(trim(value->>'err_host_paid_requires_phone_kyc'), ''),
    'Phone verification is required before creating a paid cup.'
  ),
  'host_trust_badge_unverified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_unverified'), ''), 'Unverified host'),
  'host_trust_badge_phone_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_phone_verified'), ''), 'Phone verified'),
  'host_trust_badge_document_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_document_verified'), ''), 'Verified host')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Player lobby / card badge labels (same copy as cash chrome; fail-closed required keys)
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'host_trust_badge_unverified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_unverified'), ''), 'Unverified host'),
  'host_trust_badge_phone_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_phone_verified'), ''), 'Phone verified'),
  'host_trust_badge_document_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_document_verified'), ''), 'Verified host')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

-- Profile inspect badge labels
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'host_trust_badge_unverified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_unverified'), ''), 'Unverified host'),
  'host_trust_badge_phone_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_phone_verified'), ''), 'Phone verified'),
  'host_trust_badge_document_verified',
  COALESCE(NULLIF(trim(value->>'host_trust_badge_document_verified'), ''), 'Verified host')
),
updated_at = NOW()
WHERE key = 'profile_inspect_chrome';

-- Admin chrome for flag surface on events page (optional quick toggle parity)
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'kyc_auto_approve_flag_key', 'kyc_auto_approve',
  'kyc_auto_approve_flag_label',
  COALESCE(NULLIF(trim(value->>'kyc_auto_approve_flag_label'), ''), 'KYC auto-approve'),
  'kyc_auto_approve_flag_blurb',
  COALESCE(
    NULLIF(trim(value->>'kyc_auto_approve_flag_blurb'), ''),
    'When on, document KYC submissions are approved automatically. Turn off for manual admin review.'
  )
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';
