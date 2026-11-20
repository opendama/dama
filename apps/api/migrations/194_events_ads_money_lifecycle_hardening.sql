-- Hosted events / ads lifecycle hardening (notif deep links).
-- Money refund/KPI/auto_closed gates are API-side (no schema change).

UPDATE notification_kinds
SET href_path = '/events/join',
    href_query_key = 'code'
WHERE code IN ('player.event_reopened', 'player.event_joined', 'player.event_entry_kicked');

UPDATE notification_kinds
SET href_path = '/events/dashboard',
    href_query_key = ''
WHERE code IN ('player.event_started', 'player.event_finished', 'player.event_auto_closed');

UPDATE notification_kinds
SET href_path = '/ads/campaigns',
    href_query_key = ''
WHERE code IN ('player.campaign_auto_closed', 'player.campaign_reopened');

-- Ensure wallet chrome event ledger labels exist (DB-only; no API soft-fill).
-- Wallet ledger kinds: Tournament wording (last Event-sport || seed before 381/387).
UPDATE platform_settings
SET value = value || '{
  "list_kind_event_host_fee": "Tournament host fee",
  "list_kind_event_entry_paid": "Tournament entry fee",
  "list_kind_event_entry_earned": "Tournament entry earned",
  "list_kind_event_entry_commission": "Tournament entry commission",
  "list_kind_event_entry_refund": "Tournament entry refund",
  "list_kind_event_entry_clawback": "Tournament entry clawback",
  "organizer_payout_section_blurb": "Request a payout of your wallet balance. Document KYC and a saved payout method are required."
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';
