-- Events/Ads parity hardening: admin lifecycle notifs, analytics commission
-- chrome, wallet commission kind labels, ads bottom_nav money routes.
-- Idempotent. No client hardcoding.

-- ---------------------------------------------------------------------------
-- Admin notification kinds for hosted event lifecycle
-- ---------------------------------------------------------------------------
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('admin.event_closed', 'admin', 'Event closed', 'Organizer closed cup "%s".', '/console/events', ''),
  ('admin.event_reopened', 'admin', 'Event reopened', 'Organizer reopened cup "%s".', '/console/events', ''),
  ('admin.event_auto_closed', 'admin', 'Event finished', 'Cup "%s" finished (bracket complete).', '/console/events', '')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Organizer analytics commission labels (ensure present)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "analytics_commission_label": "Commission",
  "analytics_entry_net_label": "Entry net"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Admin catalog: force auto-approve note (join always auto-approved)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "force_auto_approve_note": "Joiners are approved automatically. Manual approve is disabled."
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- ---------------------------------------------------------------------------
-- Wallet chrome: commission kind + organizer payout blurb + list links
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

-- ---------------------------------------------------------------------------
-- Ads bottom_nav: money routes (wallet / receipts / transactions)
-- ---------------------------------------------------------------------------
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
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'ads', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_receipts'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Receipts', 'href', '/ads/receipts', 'route_key', 'ads_receipts'
    ))
  END
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'ads', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'ads_transactions'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Transactions', 'href', '/ads/transactions', 'route_key', 'ads_transactions'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';

-- ---------------------------------------------------------------------------
-- Events bottom_nav: money routes
-- ---------------------------------------------------------------------------
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
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'events_receipts'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Receipts', 'href', '/events/receipts', 'route_key', 'events_receipts'
    ))
  END
  || CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'events', '[]'::jsonb)) e
      WHERE e->>'route_key' = 'events_transactions'
    ) THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object(
      'title', 'Transactions', 'href', '/events/transactions', 'route_key', 'events_transactions'
    ))
  END
),
updated_at = NOW()
WHERE key = 'client_nav';
