-- Login success + wallet/payout UI chrome (no client string invent).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'login_success_message', COALESCE(value->>'login_success_message', 'Signed in')
),
updated_at = NOW()
WHERE key = 'auth_providers';

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'wallet_chrome',
  '{
    "source": "database",
    "payout_method_saved": "Payout details saved",
    "payout_request_submitted": "Payout request submitted",
    "payout_phone_required": "Add primary phone on payout method before requesting payout",
    "payout_method_section": "Bank / mobile money details",
    "payout_request_section": "Request payout",
    "payout_phone_label": "Primary phone",
    "payout_provider_label": "Provider",
    "payout_account_label": "Account name",
    "payout_save_action": "Save payout details",
    "payout_request_action": "Request payout",
    "payout_amount_label": "Amount",
    "payout_phone_hint": "Save your primary phone under bank / mobile money details before requesting a payout."
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();
