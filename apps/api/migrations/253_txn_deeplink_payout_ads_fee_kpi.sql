-- Payout notif → transactions deep-link; publisher create-fee KPI chrome.
UPDATE notification_kinds
SET href_path = '/transactions',
    href_query_key = 'id'
WHERE code = 'player.payout_updated';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "publisher_stat_create_fee": "Create fees spent"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
