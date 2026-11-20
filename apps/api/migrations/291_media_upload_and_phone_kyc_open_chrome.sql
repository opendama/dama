-- Shared media upload dropzone chrome (web/admin/Flutter) + wallet phone KYC open CTA.
-- Placeholders / copy are DB-owned for worldwide localization.

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'media_upload_chrome',
  '{
    "media_upload_unavailable": "Media upload unavailable",
    "drop_title": "Drop image here",
    "drop_hint": "Drag and drop, or click to browse",
    "browse_action": "Browse files",
    "replace_action": "Replace",
    "remove_action": "Remove",
    "uploading_label": "Uploading…",
    "selected_label": "Selected"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = COALESCE(platform_settings.value, '{}'::jsonb) || EXCLUDED.value,
  updated_at = NOW();

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'phone_kyc_open_action',
  COALESCE(
    NULLIF(trim(value->>'phone_kyc_open_action'), ''),
    'Verify phone'
  )
),
    updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'phone_kyc_required_error',
  COALESCE(
    NULLIF(trim(value->>'phone_kyc_required_error'), ''),
    'Verify your phone number to use cash features'
  )
),
    updated_at = NOW()
WHERE key = 'cash_rmg_chrome'
  AND (
    COALESCE(trim(value->>'phone_kyc_required_error'), '') = ''
    OR trim(value->>'phone_kyc_required_error') = 'phone verification required for cash features'
  );
