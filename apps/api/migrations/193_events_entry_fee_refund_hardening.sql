-- Entry fee refund ledger kinds + kick notif + fix admin lifecycle hrefs.
-- Idempotent. No client hardcoding.

-- ---------------------------------------------------------------------------
-- Ledger kinds
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = value || '{
  "wallet_ledger_kinds": ["event_host_fee", "event_entry_paid", "event_entry_earned", "event_entry_commission", "event_entry_refund", "event_entry_clawback"]
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = value || '{
  "list_kind_event_entry_refund": "Tournament entry refund",
  "list_kind_event_entry_clawback": "Tournament entry clawback",
  "list_kind_event_entry_commission": "Tournament entry commission",
  "link_transactions_label": "Transactions",
  "link_receipts_label": "Receipts",
  "organizer_payout_section_blurb": "Request a payout of your wallet balance. Document KYC and a saved payout method are required."
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';

-- ---------------------------------------------------------------------------
-- Kick notification
-- ---------------------------------------------------------------------------
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.event_entry_kicked', 'player', 'Removed from event', 'You were removed from cup "%s". Entry fee was refunded if charged.', '/events/join', 'code')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Admin lifecycle hrefs: admin SPA routes are /events and /ads (not /console/...)
-- ---------------------------------------------------------------------------
UPDATE notification_kinds
SET href_path = '/events',
    href_query_key = COALESCE(NULLIF(TRIM(href_query_key), ''), href_query_key)
WHERE code IN ('admin.event_closed', 'admin.event_reopened', 'admin.event_auto_closed', 'admin.event_report_pending');

UPDATE notification_kinds
SET href_path = '/ads'
WHERE code = 'admin.campaign_auto_closed';

-- Keep report deep-link query key
UPDATE notification_kinds
SET href_query_key = 'report'
WHERE code = 'admin.event_report_pending';
