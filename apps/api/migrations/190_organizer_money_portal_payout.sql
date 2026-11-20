-- Organizer + publisher money portal inside Events/Ads shells (wallet / receipts /
-- transactions / payout). Platform commission ledger kind for entry fees.
-- Idempotent. No client hardcoding.

-- ---------------------------------------------------------------------------
-- client_nav: Events shell money routes
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{events}',
  COALESCE(value->'events', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'events_wallet'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Wallet', 'href', '/events/wallet', 'route_key', 'events_wallet'
    ))
  END
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'events_receipts'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Receipts', 'href', '/events/receipts', 'route_key', 'events_receipts'
    ))
  END
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'events', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'events_transactions'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Transactions', 'href', '/events/transactions', 'route_key', 'events_transactions'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{bottom_nav,events}',
  COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'events_wallet'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Wallet', 'href', '/events/wallet', 'route_key', 'events_wallet'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

-- ---------------------------------------------------------------------------
-- client_nav: Ads shell money routes
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{ads}',
  COALESCE(value->'ads', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'ads', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_wallet'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Wallet', 'href', '/ads/wallet', 'route_key', 'ads_wallet'
    ))
  END
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'ads', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_receipts'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Receipts', 'href', '/ads/receipts', 'route_key', 'ads_receipts'
    ))
  END
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'ads', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_transactions'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Transactions', 'href', '/ads/transactions', 'route_key', 'ads_transactions'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{bottom_nav,ads}',
  COALESCE(value->'bottom_nav'->'ads', '[]'::jsonb)
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'ads', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_wallet'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Wallet', 'href', '/ads/wallet', 'route_key', 'ads_wallet'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

-- ---------------------------------------------------------------------------
-- Ledger kinds (full set; jsonb || replaces this key)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "wallet_ledger_kinds": ["event_host_fee", "event_entry_paid", "event_entry_earned", "event_entry_commission"]
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_enums';

-- ---------------------------------------------------------------------------
-- Notification deep links into organizer money portal
-- ---------------------------------------------------------------------------
UPDATE notification_kinds
SET href_path = '/events/wallet',
    href_query_key = ''
WHERE code = 'player.event_entry_earned';

UPDATE notification_kinds
SET href_path = '/events/dashboard',
    href_query_key = ''
WHERE code = 'player.event_auto_closed';

-- ---------------------------------------------------------------------------
-- Organizer chrome: money portal + payout
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "portal_money_section_title": "Money",
  "portal_payout_label": "Payout",
  "portal_payout_blurb": "Cash out entry fee earnings from your wallet. Same KYC and payout method as your player account.",
  "portal_wallet_href": "/events/wallet",
  "portal_receipts_href": "/events/receipts",
  "portal_transactions_href": "/events/transactions",
  "portal_payout_href": "/events/wallet"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Ads playback chrome: money portal hrefs
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "publisher_portal_wallet_href": "/ads/wallet",
  "publisher_portal_receipts_href": "/ads/receipts",
  "publisher_portal_transactions_href": "/ads/transactions",
  "publisher_portal_payout_label": "Payout",
  "publisher_portal_payout_href": "/ads/wallet",
  "publisher_portal_payout_blurb": "Cash out from your publisher wallet using the same payout flow as players."
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

-- ---------------------------------------------------------------------------
-- Wallet chrome
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "list_kind_event_entry_commission": "Tournament entry commission",
  "link_transactions_label": "Transactions",
  "link_receipts_label": "Receipts",
  "organizer_payout_section_blurb": "Request a payout of your wallet balance. Document KYC and a saved payout method are required."
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';
