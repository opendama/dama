-- Money notification deep-links: entry earned → organizer transactions; wallet credited → player transactions.
UPDATE notification_kinds
SET href_path = '/events/transactions',
    href_query_key = 'id'
WHERE code = 'player.event_entry_earned';

UPDATE notification_kinds
SET href_path = '/transactions',
    href_query_key = 'id'
WHERE code = 'player.wallet_credited';
