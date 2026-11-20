-- Cash / RMG store compliance: age gate, jurisdiction allowlist, locate gate,
-- phone KYC for cash, per-region kill switch, payout review statuses, legal 18+.

-- ---------------------------------------------------------------------------
-- User compliance columns (fail closed until set)
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_kyc_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN users.date_of_birth IS 'Player-declared DOB; age gate for cash features.';
COMMENT ON COLUMN users.age_verified_at IS 'Set only when DOB meets cash_rmg_policy.min_age_years.';
COMMENT ON COLUMN users.phone_kyc_verified_at IS 'Set when phone-channel OTP verifies for cash KYC.';

-- ---------------------------------------------------------------------------
-- Payout review notes (operator fulfillment)
-- ---------------------------------------------------------------------------
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- Feature flags: global cash kill + phone KYC requirement
-- ---------------------------------------------------------------------------
INSERT INTO feature_flags (key, enabled, payload) VALUES
  (
    'cash_rmg_enabled',
    TRUE,
    '{
      "disabled_countries": []
    }'::jsonb
  ),
  (
    'cash_phone_kyc_required',
    TRUE,
    '{}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- Catalog toggles for admin console (merge into existing catalog)
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{toggles}',
  COALESCE(value->'toggles', '[]'::jsonb) || '[
    {
      "key": "cash_rmg_enabled",
      "title": "Cash / RMG tournaments",
      "description": "Global kill switch for paid tournament enroll, wallet cash top-up, and payouts. Payload.disabled_countries blocks specific ISO codes even when enabled.",
      "kind": "boolean",
      "state_field": "cashRmgEnabled"
    },
    {
      "key": "cash_phone_kyc_required",
      "title": "Cash phone KYC",
      "description": "Require verified phone (OTP channel=phone) before cash enroll, checkout, or payout.",
      "kind": "boolean",
      "state_field": "cashPhoneKycRequired"
    }
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
    WHERE t->>'key' = 'cash_rmg_enabled'
  );

-- ---------------------------------------------------------------------------
-- Policy (numbers / allowlists / statuses) - fail closed if incomplete
-- ---------------------------------------------------------------------------
INSERT INTO platform_settings (key, value) VALUES
  (
    'cash_rmg_policy',
    '{
      "min_age_years": 18,
      "allowed_country_codes": ["ET"],
      "locate_max_age_seconds": 900,
      "require_locate_for_cash": true,
      "payout_statuses": ["pending", "approved", "rejected", "paid"],
      "default_payout_status": "pending",
      "approvable_payout_status": "pending",
      "approved_payout_status": "approved",
      "rejected_payout_status": "rejected",
      "paid_payout_status": "paid",
      "otp_phone_channel": "phone"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Chrome (UI strings) - fail closed; no client invent
-- ---------------------------------------------------------------------------
INSERT INTO platform_settings (key, value) VALUES
  (
    'cash_rmg_chrome',
    '{
      "cash_rmg_unavailable": "Cash tournament compliance settings unavailable",
      "age_gate_title": "Confirm you are 18 or older",
      "age_gate_blurb": "Cash tournaments, wallet top-ups, and payouts require adult eligibility. Enter your date of birth. Free practice and VS-AI remain available without this step.",
      "age_gate_dob_label": "Date of birth",
      "age_gate_submit_action": "Confirm age",
      "age_gate_success": "Age verified for cash features",
      "age_gate_failed": "Unable to verify age",
      "age_gate_too_young": "You must meet the minimum age to use cash features",
      "age_required_error": "age verification required",
      "jurisdiction_blocked_error": "cash tournaments unavailable in your region",
      "cash_disabled_error": "cash tournaments temporarily disabled",
      "locate_required_error": "location verification required for cash features",
      "locate_stale_error": "refresh your location before continuing",
      "country_required_error": "country_code required",
      "phone_kyc_title": "Verify phone for cash",
      "phone_kyc_blurb": "Add and verify a phone number before cash tournaments, top-ups, or payouts.",
      "phone_kyc_phone_label": "Phone number",
      "phone_kyc_save_action": "Save phone",
      "phone_kyc_start_otp_action": "Send verification code",
      "phone_kyc_verify_action": "Verify code",
      "phone_kyc_code_label": "Verification code",
      "phone_kyc_success": "Phone verified for cash features",
      "phone_kyc_failed": "Phone verification failed",
      "phone_kyc_required_error": "phone verification required for cash features",
      "eligible_label": "Cash features available",
      "not_eligible_label": "Cash features locked",
      "payouts_section_title": "Payout requests",
      "payouts_empty": "No payout requests",
      "payout_approve_action": "Approve",
      "payout_reject_action": "Reject",
      "payout_mark_paid_action": "Mark paid",
      "payout_review_note_label": "Review note",
      "payout_review_failed": "Unable to review payout",
      "payout_reviewed": "Payout updated"
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- Admin payments chrome: payout review labels
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "payouts_section_title": "Payout requests",
    "payouts_empty": "No payout requests",
    "payout_approve_action": "Approve",
    "payout_reject_action": "Reject",
    "payout_mark_paid_action": "Mark paid",
    "payout_review_note_label": "Review note",
    "payout_review_failed": "Unable to review payout",
    "payout_reviewed": "Payout updated",
    "payout_user_prefix": "User",
    "payout_amount_prefix": "Amount",
    "payout_status_prefix": "Status",
    "payout_phone_prefix": "Phone"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

-- ---------------------------------------------------------------------------
-- Legal: cash mode 18+ (keep under-13 COPPA-style section)
-- ---------------------------------------------------------------------------
INSERT INTO site_legal_sections
  (doc_kind, sort_order, heading, body, contact_lead, contact_trail, uses_support_email)
SELECT
  'terms', 25, 'Age and cash tournaments',
  'Free practice and VS-AI play are available without a cash age check. Cash tournaments, wallet top-ups for real-money entry, and payouts are limited to users who confirm they meet the minimum age configured for cash features (18 or older in our default policy) and who pass location and phone verification where required. We may refuse or reverse cash activity that violates these rules or applicable law.',
  '', '', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM site_legal_sections
  WHERE doc_kind = 'terms' AND heading = 'Age and cash tournaments'
);

INSERT INTO site_legal_sections
  (doc_kind, sort_order, heading, body, contact_lead, contact_trail, uses_support_email)
SELECT
  'privacy', 25, 'Age verification and location for cash features',
  'When you use cash tournaments or related wallet features, we process your date of birth for adult eligibility, approximate location (IP and optional device location) to enforce regional cash rules, and phone number for cash KYC. Free practice does not require these checks. We retain verification timestamps to demonstrate compliance with store and payment partner requirements.',
  '', '', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM site_legal_sections
  WHERE doc_kind = 'privacy' AND heading = 'Age verification and location for cash features'
);

INSERT INTO site_legal_sections
  (doc_kind, sort_order, heading, body, contact_lead, contact_trail, uses_support_email)
SELECT
  'refunds', 15, 'Age-restricted cash purchases',
  'Cash tournament entry fees and wallet top-ups are available only after age, location, and phone verification succeed. Charges made in violation of those gates may be reversed or refused. Refund requests for age- or jurisdiction-blocked activity follow the same support process as other billing issues.',
  '', '', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM site_legal_sections
  WHERE doc_kind = 'refunds' AND heading = 'Age-restricted cash purchases'
);
