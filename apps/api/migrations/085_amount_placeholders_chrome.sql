-- Professional amount-field placeholders (Trim Field/Input parity).
-- Required by fail-closed isPaymentModalChromeReady / isWalletChromeReady.
UPDATE platform_settings
SET value = value || '{
  "amount_placeholder": "0.00",
  "balance_pending": "Loading balance...",
  "country_required_hint": "Confirm your country in Wallet to continue checkout.",
  "confirm_pending": "Enrolling...",
  "checkout_pending": "Opening checkout..."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'payment_modal_chrome';

UPDATE platform_settings
SET value = value || '{
  "top_up_amount_placeholder": "0.00",
  "payout_amount_placeholder": "0.00"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || '{
  "prize_placeholder": "0.00"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || '{
  "phone_kyc_code_placeholder": "000000"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'cash_rmg_chrome';
