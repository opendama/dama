-- Admin users list/detail chrome (Trim /users/{id} + smart-menu staff identity parity).
-- Nested under admin_console_chrome.users only (fail-closed; no invented client strings).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb)
    || jsonb_build_object(
    'col_phone_label', COALESCE(NULLIF(trim(value->'users'->>'col_phone_label'), ''), 'Phone'),
    'detail_phone_label', COALESCE(NULLIF(trim(value->'users'->>'detail_phone_label'), ''), 'Phone'),
    'detail_avatar_alt', COALESCE(NULLIF(trim(value->'users'->>'detail_avatar_alt'), ''), 'Avatar'),
    'detail_age_kyc_label', COALESCE(NULLIF(trim(value->'users'->>'detail_age_kyc_label'), ''), 'Age verified'),
    'detail_phone_kyc_label', COALESCE(NULLIF(trim(value->'users'->>'detail_phone_kyc_label'), ''), 'Phone KYC'),
    'detail_region_label', COALESCE(NULLIF(trim(value->'users'->>'detail_region_label'), ''), 'Region'),
    'detail_payout_section', COALESCE(NULLIF(trim(value->'users'->>'detail_payout_section'), ''), 'Payout methods'),
    'detail_payout_empty', COALESCE(NULLIF(trim(value->'users'->>'detail_payout_empty'), ''), 'No payout methods'),
    'detail_payout_provider_label', COALESCE(NULLIF(trim(value->'users'->>'detail_payout_provider_label'), ''), 'Provider'),
    'detail_payout_account_label', COALESCE(NULLIF(trim(value->'users'->>'detail_payout_account_label'), ''), 'Account'),
    'detail_payout_phone_label', COALESCE(NULLIF(trim(value->'users'->>'detail_payout_phone_label'), ''), 'Payout phone'),
    'detail_back_action', COALESCE(NULLIF(trim(value->'users'->>'detail_back_action'), ''), 'Back to users'),
    'detail_verified_yes', COALESCE(NULLIF(trim(value->'users'->>'detail_verified_yes'), ''), 'Verified'),
    'detail_verified_no', COALESCE(NULLIF(trim(value->'users'->>'detail_verified_no'), ''), 'Not verified'),
    'detail_load_failed', COALESCE(NULLIF(trim(value->'users'->>'detail_load_failed'), ''), 'Unable to load user'),
    'open_detail_pending', COALESCE(NULLIF(trim(value->'users'->>'open_detail_pending'), ''), 'Opening…'),
    'open_full_detail_action', COALESCE(NULLIF(trim(value->'users'->>'open_full_detail_action'), ''), 'Open full profile'),
    'edit_role_action', COALESCE(NULLIF(trim(value->'users'->>'edit_role_action'), ''), 'Change role')
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome' AND value ? 'users';
