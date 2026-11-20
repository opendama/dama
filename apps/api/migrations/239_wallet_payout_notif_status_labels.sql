-- Wallet list_status_paid (payout notif bodies) + payout deep-link query key.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "list_status_paid": "Paid",
  "meta_separator": " · "
}'::jsonb,
    updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE notification_kinds
SET href_query_key = 'id'
WHERE code = 'player.payout_updated'
  AND COALESCE(NULLIF(TRIM(href_query_key), ''), '') = '';
