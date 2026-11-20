-- Admin console + auth CRUD pending labels (Trim Button isLoading + pendingLabel).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "receipt_approve_pending": "Approving…",
    "receipt_reject_pending": "Rejecting…",
    "save_currency_pending": "Saving…",
    "payout_approve_pending": "Approving…",
    "payout_reject_pending": "Rejecting…",
    "payout_mark_paid_pending": "Updating…",
    "doc_kyc_approve_pending": "Approving…",
    "doc_kyc_reject_pending": "Rejecting…"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{avatars}',
  COALESCE(value->'avatars', '{}'::jsonb) || '{
    "approve_pending": "Approving…",
    "flag_pending": "Flagging…",
    "reset_pending": "Resetting…",
    "moderation_settings_pending": "Saving…"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb) || '{
    "add_pending": "Adding…",
    "status_pending": "Updating…"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = value || '{
  "sign_out_pending": "Signing out…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'auth_providers';

UPDATE platform_settings
SET value = value || '{
  "create_pending": "Creating…",
  "status_update_pending": "Updating…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournament_chrome';
