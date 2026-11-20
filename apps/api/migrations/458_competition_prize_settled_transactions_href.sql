-- Prize paid notif deep-link: open player transactions and seek the ledger row (parity wallet_credited).
-- Was /wallet with empty href_query_key → click navigated nowhere useful / no row open.

UPDATE notification_kinds
SET href_path = '/transactions',
    href_query_key = 'id'
WHERE code = 'player.competition_prize_settled';

-- Backfill prior emits that stored empty href_entity_id (ledger id was available on payouts).
UPDATE app_notifications n
SET href_entity_id = p.ledger_tx_id::text
FROM competition_prize_payouts p
WHERE n.kind_code = 'player.competition_prize_settled'
  AND n.dedupe_key = 'competition_prize_settled:' || p.id::text
  AND p.ledger_tx_id IS NOT NULL
  AND COALESCE(NULLIF(trim(n.href_entity_id), ''), '') = '';
