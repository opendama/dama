-- Ads pay-to-create (parity with hosted event host fee): DB-priced create fee + chrome + ledger kind.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "campaign_create_fee_amount": 25,
  "campaign_create_fee_currency": "ETB"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_pricing';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{wallet_ledger_kinds}',
  COALESCE(value->'wallet_ledger_kinds', '[]'::jsonb) || '["campaign_create_fee"]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_enums'
  AND NOT COALESCE(value->'wallet_ledger_kinds', '[]'::jsonb) ? 'campaign_create_fee';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "list_kind_campaign_create_fee": "Campaign create fee"
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "portal_overview_href": "/dashboard",
  "portal_create_href": "/events/list",
  "portal_public_list_href": "/events/public"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "campaign_create_fee_label": "Create fee",
  "campaign_create_fee_blurb": "Pay once from your wallet to publish this campaign. No pay, no campaign.",
  "insufficient_campaign_create_fee": "Insufficient wallet balance for the campaign create fee.",
  "publisher_portal_overview_href": "/dashboard",
  "publisher_portal_create_href": "/ads/campaigns"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "campaign_create_fee_label": "Campaign create fee",
    "campaign_create_fee_currency_label": "Campaign create fee currency",
    "err_campaign_create_fee": "Campaign create fee amount and currency are required"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
