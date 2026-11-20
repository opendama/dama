-- Phase C: government ID document KYC required before payout (world-standard: ID front/back + selfie + legal name).

CREATE TABLE IF NOT EXISTS kyc_document_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  id_front_url TEXT NOT NULL,
  id_back_url TEXT NOT NULL DEFAULT '',
  selfie_url TEXT NOT NULL,
  status TEXT NOT NULL,
  review_note TEXT NOT NULL DEFAULT '',
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_docs_user_created ON kyc_document_submissions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_status ON kyc_document_submissions (status, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS document_kyc_verified_at TIMESTAMPTZ;
COMMENT ON COLUMN users.document_kyc_verified_at IS 'Set when admin approves government-ID document KYC for payouts.';

-- Policy: require document KYC for payout; statuses + allowed ID types DB-driven.
UPDATE platform_settings
SET value = value || '{
  "require_document_kyc_for_payout": true,
  "document_kyc_types": ["passport", "national_id", "drivers_license"],
  "document_kyc_statuses": ["draft", "pending", "approved", "rejected"],
  "document_kyc_draft_status": "draft",
  "document_kyc_pending_status": "pending",
  "document_kyc_approved_status": "approved",
  "document_kyc_rejected_status": "rejected",
  "document_kyc_passport_type": "passport"
}'::jsonb,
updated_at = NOW()
WHERE key = 'cash_rmg_policy'
  AND COALESCE(value->>'require_document_kyc_for_payout', '') = '';

-- Player chrome for document KYC.
UPDATE platform_settings
SET value = value || '{
  "doc_kyc_title": "Identity verification for payouts",
  "doc_kyc_blurb": "Upload a government photo ID and a clear selfie. Required before cashout. Passport needs front + selfie; national ID and driver license need front, back, and selfie.",
  "doc_kyc_type_label": "ID type",
  "doc_kyc_legal_name_label": "Full legal name (as on ID)",
  "doc_kyc_front_label": "ID front photo",
  "doc_kyc_back_label": "ID back photo",
  "doc_kyc_selfie_label": "Selfie (face clear, matching ID)",
  "doc_kyc_upload_action": "Upload",
  "doc_kyc_save_draft_action": "Save draft",
  "doc_kyc_submit_action": "Submit for review",
  "doc_kyc_pending_label": "Under review",
  "doc_kyc_approved_label": "Verified",
  "doc_kyc_rejected_label": "Rejected - resubmit",
  "doc_kyc_success": "Identity documents submitted for review",
  "doc_kyc_failed": "Unable to save identity documents",
  "doc_kyc_required_error": "identity document verification required for payout",
  "doc_kyc_incomplete_error": "complete identity documents before submitting",
  "doc_kyc_type_passport": "Passport",
  "doc_kyc_type_national_id": "National ID",
  "doc_kyc_type_drivers_license": "Driver license"
}'::jsonb,
updated_at = NOW()
WHERE key = 'cash_rmg_chrome'
  AND COALESCE(value->>'doc_kyc_title', '') = '';

-- Wallet error key for payout gate.
UPDATE platform_settings
SET value = value || '{
  "document_kyc_required": "Verify your identity documents before requesting a payout"
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome'
  AND COALESCE(value->>'document_kyc_required', '') = '';

-- Admin console review chrome.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "doc_kyc_section_title": "Identity KYC reviews",
    "doc_kyc_empty": "No pending identity submissions",
    "doc_kyc_approve_action": "Approve ID",
    "doc_kyc_reject_action": "Reject ID",
    "doc_kyc_review_note_label": "KYC review note",
    "doc_kyc_reviewed": "Identity KYC updated",
    "doc_kyc_review_failed": "Unable to review identity KYC",
    "doc_kyc_user_prefix": "User",
    "doc_kyc_type_prefix": "ID type",
    "doc_kyc_name_prefix": "Name",
    "doc_kyc_status_prefix": "Status"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND COALESCE(value->'payments'->>'doc_kyc_section_title', '') = '';
